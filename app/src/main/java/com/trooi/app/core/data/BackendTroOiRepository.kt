package com.trooi.app.core.data

import android.content.Context
import android.net.Uri
import dagger.hilt.android.qualifiers.ApplicationContext
import com.trooi.app.core.model.*
import com.trooi.app.core.auth.RefreshCredentialStore
import com.trooi.app.core.network.AuthTokenProvider
import com.trooi.app.core.network.BackendApi
import com.trooi.app.core.network.dto.*
import javax.inject.Inject
import java.io.File
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Backend-backed repository. All authorization and canonical writes remain server-side. */
class BackendTroOiRepository @Inject constructor(
    private val api: BackendApi,
    private val tokens: AuthTokenProvider,
    @param:ApplicationContext private val context: Context? = null,
) : TroOiRepository {
    private val refreshCredentials by lazy { context?.let(::RefreshCredentialStore) }
    private val messageCacheLock = Any()
    private var messageCards: List<ConversationCard> = emptyList()
    override suspend fun loadLocalConversations(): Result<List<ConversationCard>> = runCatching {
        val credential = requireNotNull(tokens.token()).also { require(it.isNotBlank()) }
        val userId = api.getSessionContext().required("messaging identity").userId
        api.messagingConversations().required("conversations").map { conversation ->
            val others = conversation.participants.filter { it.userId != userId }
            val page = api.messagingMessages(conversation.id).required("messages")
            ConversationCard(id = conversation.id, counterpartUserId = others.first().userId,
                counterpartName = others.joinToString { it.displayName }, rentalLabel = conversation.contextType,
                contextId = conversation.contextId, photoResource = null, lastReadAt = conversation.lastReadAt,
                messages = page.messages.map { message ->
                    check(message.delivery == "server" && message.conversationId == conversation.id)
                    ConversationMessage(message.id, message.senderUserId, message.text, message.createdAt,
                        attachmentIds = message.attachments.map { it.id })
                }, olderMessagesCursor = page.nextCursor)
        }.let { refreshed -> synchronized(messageCacheLock) {
            check(tokens.token() == credential)
            // Messages are immutable: a refresh started before send must retain its server acknowledgement.
            messageCards = refreshed.map { card ->
                val cached = messageCards.firstOrNull { it.id == card.id }
                card.copy(
                    messages = (card.messages + cached?.messages.orEmpty())
                        .distinctBy { it.id }.sortedWith(compareBy<ConversationMessage> { it.createdAt }.thenBy { it.id }),
                    olderMessagesCursor = cached?.olderMessagesCursor ?: card.olderMessagesCursor,
                )
            }
            messageCards
        } }
    }
    override suspend fun loadOlderMessages(conversationId: String): Result<ConversationCard> = runCatching {
        val credential = requireNotNull(tokens.token()).also { require(it.isNotBlank()) }
        val current = synchronized(messageCacheLock) { messageCards.firstOrNull { it.id == conversationId } }
            ?: error("Conversation is no longer available")
        val cursor = current.olderMessagesCursor ?: return@runCatching current
        val page = api.messagingMessages(conversationId, cursor).required("older messages")
        check(tokens.token() == credential)
        page.messages.forEach { message ->
            check(message.delivery == "server" && message.conversationId == conversationId)
        }
        synchronized(messageCacheLock) {
            check(tokens.token() == credential)
            val latest = messageCards.firstOrNull { it.id == conversationId }
                ?: error("Conversation is no longer available")
            val updated = latest.copy(
                messages = (page.messages.map { message -> ConversationMessage(
                    message.id, message.senderUserId, message.text, message.createdAt,
                    attachmentIds = message.attachments.map { it.id },
                ) } + latest.messages).distinctBy { it.id }
                    .sortedWith(compareBy<ConversationMessage> { it.createdAt }.thenBy { it.id }),
                olderMessagesCursor = page.nextCursor,
                loadingOlderMessages = false,
                olderMessagesLoadFailed = false,
            )
            messageCards = messageCards.map { if (it.id == conversationId) updated else it }
            updated
        }
    }
    override suspend fun sendMessage(expectedUserId: String, conversationId: String, text: String,
        images: List<LocalMessageImage>): Result<List<ConversationCard>> = runCatching {
        val credential = requireNotNull(tokens.token()).also { require(it.isNotBlank()) }
        check(api.getSessionContext().required("messaging identity").userId == expectedUserId)
        val sent = api.messagingSend(conversationId, text, images.map { it.jpegBytes }, credential).required("send message")
        check(sent.delivery == "server" && sent.senderUserId == expectedUserId)
        synchronized(messageCacheLock) {
            check(tokens.token() == credential)
            messageCards = messageCards.map { card -> if (card.id != conversationId) card else card.copy(
                messages = (card.messages + ConversationMessage(sent.id, sent.senderUserId, sent.text, sent.createdAt,
                    attachmentIds = sent.attachments.map { it.id })).distinctBy { it.id }.sortedBy { it.createdAt }) }
            messageCards
        }
    }
    override suspend fun openConversation(contextType: String, contextId: String): Result<String> = runCatching {
        require(contextType in listOf("inquiry", "tenancy"))
        require(java.util.UUID.fromString(contextId).toString().equals(contextId, ignoreCase = true))
        api.messagingOpen(contextType, contextId).required("open conversation").id
    }
    override suspend fun readConversation(id: String): Result<Unit> = runCatching { api.messagingRead(id).required("read conversation") }
    override suspend fun messageAttachment(conversationId: String, attachmentId: String): Result<ByteArray> = runCatching {
        require(java.util.UUID.fromString(conversationId).toString().equals(conversationId, true))
        require(java.util.UUID.fromString(attachmentId).toString().equals(attachmentId, true))
        val image = api.messagingAttachment(conversationId, attachmentId).required("private image")
        require(image.contentType == "image/jpeg" && image.base64.length <= 2_666_668)
        java.util.Base64.getDecoder().decode(image.base64).also { require(it.size <= 2_000_000) }
    }
    override fun initialSnapshot() = TroOiSnapshot()
    override fun clearSession() { synchronized(messageCacheLock) { messageCards = emptyList(); tokens.clear(); refreshCredentials?.clear() } }

    override suspend fun revokeCurrentBackendSession() {
        try { api.logoutIdentitySession().required("logout identity session") } finally { clearSession() }
    }

    suspend fun probePublicTransport(): TransportOutcome = api.getPublicListingsRaw()

    override suspend fun refreshSessionContext(): Result<UserSession> = try {
        refreshCredentials?.let { store ->
            val refresh = store.read() ?: throw IllegalStateException("Không có refresh credential đã bảo vệ.")
            val rotated = api.refreshIdentitySession(refresh).required("refresh identity session")
            tokens.setToken(rotated.accessToken)
            store.write(rotated.refreshToken)
        }
        val session = api.getSessionContext().required("session context")
        Result.success(UserSession(
            userId = session.userId,
            displayName = session.name ?: session.email ?: session.userId,
            email = session.email,
            pictureUrl = session.pictureUrl,
            access = AccessCapabilities(
                linkedTenancyIds = session.linkedTenancyIds.toSet(),
                operatedOrganizationIds = session.operatedOrganizationIds.toSet(),
            ),
        ))
    } catch (error: RuntimeException) { Result.failure(error) }

    override suspend fun updateDisplayName(displayName: String): Result<UserSession> = try {
        require(displayName.isNotBlank() && displayName.length <= 80) { "Tên hiển thị không hợp lệ" }
        val session = api.updateOwnDisplayName(displayName.trim()).required("update display name")
        Result.success(UserSession(
            userId = session.userId,
            displayName = session.name ?: displayName.trim(),
            email = session.email,
            pictureUrl = session.pictureUrl,
            access = AccessCapabilities(
                linkedTenancyIds = session.linkedTenancyIds.toSet(),
                operatedOrganizationIds = session.operatedOrganizationIds.toSet(),
            ),
        ))
    } catch (error: RuntimeException) { Result.failure(error) }

    override suspend fun loadOwnAvatar(expectedUserId: String): Result<ProfileAvatarImage?> = runCatching {
        val credential = requireNotNull(tokens.token()).also { require(it.isNotBlank()) }
        val session = api.getSessionContext(credential).required("avatar identity")
        check(session.userId == expectedUserId) { "Authenticated User changed before avatar read" }
        val content = when (val result = api.getOwnAvatar(credential)) {
            is ApiOutcome.Data -> result.value
            is ApiOutcome.Failure -> if (result.httpStatus == 404) null else error("Avatar read failed: ${result.kind}")
        } ?: return@runCatching null
        require(content.contentType in listOf("image/jpeg", "image/png"))
        require(content.byteSize in 1..(2 * 1024 * 1024) && content.base64.length <= 2_796_204)
        val bytes = java.util.Base64.getDecoder().decode(content.base64)
        require(bytes.size == content.byteSize && tokens.token() == credential)
        ProfileAvatarImage(content.contentType, bytes)
    }

    override suspend fun updateOwnAvatar(expectedUserId: String, contentType: String, bytes: ByteArray): Result<ProfileAvatarImage> = runCatching {
        require(contentType in listOf("image/jpeg", "image/png") && bytes.isNotEmpty() && bytes.size <= 2 * 1024 * 1024)
        val credential = requireNotNull(tokens.token()).also { require(it.isNotBlank()) }
        val session = api.getSessionContext(credential).required("avatar identity")
        check(session.userId == expectedUserId) { "Authenticated User changed before avatar upload" }
        val stored = api.uploadOwnAvatar(contentType, bytes, credential).required("avatar upload")
        require(stored.contentType == contentType && stored.byteSize == bytes.size)
        check(tokens.token() == credential) { "Authenticated User changed during avatar upload" }
        val readBack = loadOwnAvatar(expectedUserId).getOrThrow() ?: error("Avatar upload returned no persisted image")
        check(readBack.contentType == contentType && readBack.bytes.contentEquals(bytes)) { "Avatar readback did not match uploaded bytes" }
        readBack
    }

    override suspend fun refreshPublicListings(): Result<List<PublicListingCard>> = try {
        Result.success(mapPublicListings(api.getPublicListings().required("public listings")))
    } catch (error: RuntimeException) {
        Result.failure(error)
    }

    override suspend fun loadPublicListingPhotos(listingId: String, mediaIds: List<String>): Result<List<String>> = runCatching {
        require(mediaIds.size <= 10 && mediaIds.distinct().size == mediaIds.size)
        mediaIds.map { mediaId ->
            UUID.fromString(mediaId)
            val content = api.getPublicListingMediaContent(listingId, mediaId).required("public listing photo")
            require(content.contentType in listOf("image/jpeg", "image/png"))
            val bytes = java.util.Base64.getDecoder().decode(content.base64)
            require(bytes.isNotEmpty() && bytes.size <= 5 * 1024 * 1024)
            val suffix = if (content.contentType == "image/png") "png" else "jpg"
            withContext(Dispatchers.IO) {
                val directory = File(requireNotNull(context) { "Ảnh Backend không khả dụng trong kiểm thử JVM." }.cacheDir, "public-listing-media")
                    .apply { check(exists() || mkdirs()) }
                val file = File(directory, "$mediaId.$suffix")
                val temporary = File(directory, "$mediaId.$suffix.tmp")
                temporary.writeBytes(bytes)
                check(temporary.renameTo(file) || (temporary.delete() && file.exists()))
                Uri.fromFile(file).toString()
            }
        }
    }

    override suspend fun searchPublicListings(
        latitude: Double,
        longitude: Double,
        radiusMeters: Double,
        minPrice: String?,
        maxPrice: String?,
    ): Result<List<PublicListingCard>> = try {
        require(latitude in -90.0..90.0 && longitude in -180.0..180.0) { "Tọa độ tìm kiếm không hợp lệ" }
        require(radiusMeters > 0.0) { "Bán kính tìm kiếm phải lớn hơn 0" }
        Result.success(
            api.searchPublicListings(latitude, longitude, radiusMeters, minPrice, maxPrice)
                .required("public listing search")
                .map(::mapPublicSearchResult),
        )
    } catch (error: RuntimeException) {
        Result.failure(error)
    }

    override suspend fun authenticateWithGoogleIdToken(idToken: String, nonce: String): Result<UserSession> {
        if (idToken.isBlank()) return Result.failure(IllegalArgumentException("Google ID Token trống"))
        return try {
            val identitySession = api.authenticateGoogle(idToken, nonce).required("Google authentication")
            require(identitySession.accessToken.isNotBlank() && identitySession.refreshToken.isNotBlank())
            tokens.setToken(identitySession.accessToken)
            refreshCredentials?.write(identitySession.refreshToken)
            val session = api.getSessionContext().required("session context")
            check(session.userId == identitySession.userId) { "Authenticated User does not match issued session" }
            val displayName = session.name ?: session.email ?: session.userId
            Result.success(
                UserSession(
                    userId = session.userId,
                    displayName = displayName,
                    email = session.email,
                    pictureUrl = session.pictureUrl,
                    access = AccessCapabilities(
                        linkedTenancyIds = session.linkedTenancyIds.toSet(),
                        operatedOrganizationIds = session.operatedOrganizationIds.toSet(),
                    ),
                ),
            )
        } catch (error: RuntimeException) {
            tokens.clear()
            Result.failure(error)
        }
    }

    override suspend fun refreshAuthorizedRead(access: AccessCapabilities): Result<FrontendReadSnapshot> = try {
        val credential = requireNotNull(tokens.token()).also { require(it.isNotBlank()) }
        Result.success(loadAuthorizedRead(access).also { check(tokens.token() == credential) { "Phiên đăng nhập đã thay đổi." } })
    } catch (error: RuntimeException) {
        Result.failure(error)
    }

    override suspend fun loadNotification(notificationId: String): Result<NotificationCard> = try {
        require(notificationId.matches(Regex("[A-Za-z0-9_-]{1,128}"))) { "Notification ID không hợp lệ" }
        Result.success(mapNotification(api.getNotification(notificationId).required("notification detail")))
    } catch (error: RuntimeException) {
        Result.failure(error)
    }

    override suspend fun markNotificationRead(notificationId: String): Result<Unit> = try {
        require(notificationId.matches(Regex("[A-Za-z0-9_-]{1,128}"))) { "Notification ID không hợp lệ" }
        api.markNotificationRead(notificationId).required("mark notification read")
        Result.success(Unit)
    } catch (error: RuntimeException) {
        Result.failure(error)
    }

    override suspend fun submitInquiry(listingId: String, message: String): Result<String> = try {
        Result.success(api.createInquiry(listingId, message).required("inquiry").id)
    } catch (error: RuntimeException) {
        Result.failure(error)
    }

    override suspend fun saveLocalAsset(asset: LocalRentalAsset, activate: Boolean, publish: Boolean): Result<FrontendReadSnapshot> = runCatching {
        require(asset.photoResources.isEmpty()) { "Ảnh mẫu trong Debug không thể lưu vào tài khoản Backend. Hãy chọn ảnh JPEG hoặc PNG từ thiết bị." }
        require(asset.id.isNotBlank() && asset.propertyId.isNotBlank()) { "Thiếu ID ổn định của tài sản." }
        val credential = requireNotNull(tokens.token()).also { require(it.isNotBlank()) }
        val session = api.getSessionContext(credential).required("session context")
        val ownedProperties = session.operatedOrganizationIds.flatMap { orgId ->
            api.getProperties(orgId, credential).required("properties")
        }
        val existingProperty = ownedProperties.singleOrNull { it.id == asset.propertyId }
        val latitude = asset.operationalLatitude.toDoubleOrNull() ?: existingProperty?.operationalLocation?.latitude
            ?: error("Cần tọa độ vận hành hợp lệ để lưu Property.")
        val longitude = asset.operationalLongitude.toDoubleOrNull() ?: existingProperty?.operationalLocation?.longitude
            ?: error("Cần tọa độ vận hành hợp lệ để lưu Property.")
        val property = if (existingProperty != null) {
            api.updatePropertyLocation(asset.propertyId, asset.name, asset.operationalAddress, latitude, longitude, credential)
                .required("update Property")
        } else {
            val organizationId = session.operatedOrganizationIds.singleOrNull()
                ?: error("Không thể chọn Organization an toàn. Cần đúng một Organization đang được phép quản lý.")
            api.createProperty(asset.propertyId, organizationId, asset.name, asset.operationalAddress, latitude, longitude, credential)
                .required("create Property")
        }
        val existingRoom = api.getRooms(property.id, credential).required("rooms")
            .singleOrNull { it.id == asset.id }
        if (existingRoom != null) {
            require(existingRoom.propertyId == property.id) { "Room ID thuộc Property khác." }
            api.updateRoom(asset.id, asset.name, credential).required("update Room")
        } else {
            api.createRoom(asset.id, property.id, asset.name, credential).required("create Room")
        }

        val currentListing = api.getCurrentListing(asset.id, credential).optionalNotFound("current listing")
        val listingId = currentListing?.id ?: asset.publicListingId ?: java.util.UUID.nameUUIDFromBytes(
            "trooi-listing:${asset.propertyId}:${asset.id}".toByteArray(Charsets.UTF_8),
        ).toString()
        if (currentListing?.status == "published") api.unpublishListing(listingId, credential).required("unpublish Listing before edit")
        val listingLatitude = property.publicLocationProjection?.latitude ?: kotlin.math.round(latitude * 100) / 100
        val listingLongitude = property.publicLocationProjection?.longitude ?: kotlin.math.round(longitude * 100) / 100
        if (currentListing == null) {
            api.createListing(listingId, asset.id, asset.name, asset.description, asset.monthlyRent, listingLatitude, listingLongitude, credential)
                .required("create Listing")
        } else {
            api.updateListing(listingId, asset.name, asset.description, asset.monthlyRent, listingLatitude, listingLongitude, credential)
                .required("update Listing")
        }
        val details = ListingAssetDetailsTransport(
            listingId = listingId,
            managementStatus = if (activate) "ACTIVE" else "DRAFT",
            assetType = asset.type.ifBlank { null }, publicAreaLabel = asset.publicArea.ifBlank { null },
            areaSquareMeters = asset.area.ifBlank { null }, advertisedDeposit = asset.advertisedDeposit.ifBlank { null },
            bedrooms = asset.bedrooms.toOptionalInt("số phòng ngủ"), bathrooms = asset.bathrooms.toOptionalInt("số phòng tắm"),
            furnishing = asset.furnishing.ifBlank { null }, amenityIds = asset.amenities, rules = asset.rules,
            electricityOffer = asset.electricityOffer.ifBlank { null }, waterOffer = asset.waterOffer.ifBlank { null },
            serviceOffer = asset.serviceOffer.ifBlank { null }, minimumTermMonths = asset.minimumTermMonths.toOptionalInt("thời hạn thuê tối thiểu"),
            availableFrom = asset.availableFrom.ifBlank { null }, bathroomArrangement = asset.bathroomArrangement?.name,
            maxOccupants = asset.maxOccupants, floorLabel = asset.floorLabel?.ifBlank { null },
        )
        val saved = api.saveListingAssetDetails(listingId, details, credential).required("save Asset details")
        val currentMedia = api.getListingAssetMedia(listingId, credential).required("asset photos")
        val desiredIds = asset.photoUris.mapIndexed { index, uri ->
            val mediaId = asset.photoMediaIds.getOrElse(index) { "" }.ifBlank {
                UUID.nameUUIDFromBytes("trooi-asset-photo:$listingId:$uri".toByteArray(Charsets.UTF_8)).toString()
            }
            if (currentMedia.none { it.id == mediaId }) {
                val bytes = readAssetPhoto(uri)
                val type = when {
                    bytes.size >= 3 && bytes[0] == 0xff.toByte() && bytes[1] == 0xd8.toByte() && bytes[2] == 0xff.toByte() -> "image/jpeg"
                    bytes.size >= 8 && bytes.take(8).toByteArray().contentEquals(byteArrayOf(137.toByte(), 80, 78, 71, 13, 10, 26, 10)) -> "image/png"
                    else -> error("Chỉ hỗ trợ ảnh JPEG hoặc PNG.")
                }
                api.uploadListingAssetMedia(listingId, mediaId, type, bytes, credential).required("upload asset photo")
            }
            mediaId
        }
        currentMedia.filterNot { it.id in desiredIds }.forEach { api.removeListingAssetMedia(listingId, it.id, credential).required("remove asset photo") }
        require(asset.publicPhotoMediaIds.all { it in desiredIds }) { "Quyền công khai chỉ áp dụng cho ảnh của tài sản này." }
        if (desiredIds.isNotEmpty()) api.reorderListingAssetMedia(listingId, desiredIds, credential).required("order asset photos")
        val currentAfterSave = api.getListingAssetMedia(listingId, credential).required("asset photo visibility")
        currentAfterSave.filter { it.isPublic != (it.id in asset.publicPhotoMediaIds) }.forEach { media ->
            api.setListingAssetMediaPublic(listingId, media.id, media.id in asset.publicPhotoMediaIds, credential).required("save asset photo visibility")
        }
        if (publish) {
            require(asset.readyToPublish()) { "Hoàn tất mô tả, giá, ảnh và thông tin tài sản trước khi đăng." }
            api.publishListing(listingId, credential).required("publish Listing")
        }
        check(tokens.token() == credential) { "Phiên đăng nhập đã thay đổi; dữ liệu đã lưu dưới tài khoản ban đầu, hãy tải lại trước khi tiếp tục." }
        refreshAuthorizedRead(AccessCapabilities(
            linkedTenancyIds = session.linkedTenancyIds.toSet(), operatedOrganizationIds = session.operatedOrganizationIds.toSet(),
        )).getOrThrow().also { snapshot ->
            check(tokens.token() == credential) { "Phiên đăng nhập đã thay đổi; không thể áp dụng kết quả cũ cho tài khoản mới." }
            check(snapshot.localManagement?.assets.orEmpty().any { it.id == asset.id && it.publicListingId == saved.listingId }) {
                "Backend chưa trả lại tài sản đã lưu. Hãy tải lại Ledger trước khi tiếp tục."
            }
        }
    }

    override suspend fun archiveLocalAsset(assetId: String): Result<FrontendReadSnapshot> = runCatching {
        val credential = requireNotNull(tokens.token()).also { require(it.isNotBlank()) }
        val session = api.getSessionContext(credential).required("session context")
        val properties = session.operatedOrganizationIds.flatMap { orgId -> api.getProperties(orgId, credential).required("properties") }
        var room: RoomTransport? = null
        for (property in properties) {
            room = api.getRooms(property.id, credential).required("rooms").firstOrNull { it.id == assetId }
            if (room != null) break
        }
        val ownedRoom = room ?: error("Không tìm thấy Room thuộc Organization bạn được quyền quản lý.")
        api.archiveRoom(ownedRoom.id, credential).required("archive room")
        check(tokens.token() == credential) { "Phiên đăng nhập đã thay đổi." }
        refreshAuthorizedRead(AccessCapabilities(
            linkedTenancyIds = session.linkedTenancyIds.toSet(), operatedOrganizationIds = session.operatedOrganizationIds.toSet(),
        )).getOrThrow()
    }

    private fun readAssetPhoto(rawUri: String): ByteArray {
        val uri = Uri.parse(rawUri)
        require(uri.scheme == "file") { "Chọn lại ảnh từ thiết bị để tải ảnh lên." }
        val file = File(requireNotNull(uri.path)).canonicalFile
        val appContext = requireNotNull(context) { "Ảnh thiết bị không khả dụng trong kiểm thử JVM." }
        val sourceDirectory = File(appContext.filesDir, "rental-media").canonicalFile
        require(file.path.startsWith(sourceDirectory.path + File.separator) && file.isFile) { "Ảnh nháp không còn khả dụng. Hãy chọn lại ảnh." }
        return file.inputStream().use { input ->
            val output = java.io.ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            var total = 0
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                total += count
                require(total <= 5 * 1024 * 1024) { "Ảnh phải nhỏ hơn 5 MB." }
                output.write(buffer, 0, count)
            }
            output.toByteArray()
        }
    }

    override suspend fun login(identifier: String, password: String): Result<UserSession> = unsupportedAuth()
    override suspend fun signUp(fullName: String, phone: String, email: String, password: String): Result<UserSession> = unsupportedAuth()
    override suspend fun requestPasswordReset(identifier: String): Result<Unit> = unsupportedAuth()

    private fun <T> unsupportedAuth(): Result<T> = Result.failure(
        IllegalStateException("Backend-backed build chỉ hỗ trợ Google Credential Manager."),
    )

    private suspend fun loadAuthorizedRead(access: AccessCapabilities): FrontendReadSnapshot {
        val publicListings = mapPublicListings(api.getPublicListings().required("public listings"))
        val organizationRows = api.getOrganizations().required("organizations")
            .filter { it.id in access.operatedOrganizationIds }

        val properties = mutableListOf<PropertyTransport>()
        val rooms = mutableListOf<RoomTransport>()
        val managedAssets = mutableListOf<LocalRentalAsset>()
        val incidents = linkedMapOf<String, IncidentTransport>()
        val incidentEvents = mutableMapOf<String, List<IncidentEventTransport>>()
        val tenancies = linkedMapOf<String, TenancyTransport>()
        val operatorListings = mutableListOf<OperatorListingCard>()
        val dashboardByOrganization = mutableMapOf<String, DashboardReadModel>()
        val paymentsById = linkedMapOf<String, PaymentTransport>()
        val operatorCharges = mutableMapOf<String, MutableList<ChargeCard>>()
        val operatorPayments = mutableMapOf<String, MutableList<PaymentCard>>()
        val operatorDeposits = mutableMapOf<String, MutableList<DepositCard>>()
        val operatorTenancyToOrganization = mutableMapOf<String, String>()
        val operatorReceipts = mutableMapOf<String, MutableList<ReceiptCard>>()
        val financeReadErrors = mutableListOf<String>()

        for (organization in organizationRows) {
            dashboardByOrganization[organization.id] = mapDashboard(
                api.getDashboard(organization.id).required("organization dashboard"),
            )
            val scopedProperties = api.getProperties(organization.id).required("properties")
                .filter { it.organizationId == organization.id }
            properties += scopedProperties
            val chargeBucket = operatorCharges.getOrPut(organization.id) { mutableListOf() }
            val paymentBucket = operatorPayments.getOrPut(organization.id) { mutableListOf() }
            val depositBucket = operatorDeposits.getOrPut(organization.id) { mutableListOf() }
            for (property in scopedProperties) {
                val scopedRooms = api.getRooms(property.id).required("rooms")
                    .filter { it.propertyId == property.id }
                rooms += scopedRooms
                for (room in scopedRooms) {
                    val currentListing = api.getCurrentListing(room.id).optionalNotFound("current listing")
                        ?.takeIf { it.roomId == room.id }
                    currentListing?.let { operatorListings += mapOperatorListing(it) }
                    val assetDetails = currentListing?.let { api.getListingAssetDetails(it.id).optionalNotFound("Asset details") }
                    val media = currentListing?.let { api.getListingAssetMedia(it.id).optionalNotFound("asset photos") }.orEmpty()
                    val downloadedPhotos = media.sortedBy { it.position }.map { item ->
                        require(item.byteSize in 1..(5 * 1024 * 1024) && item.contentType in listOf("image/jpeg", "image/png"))
                        val content = api.getListingAssetMediaContent(currentListing!!.id, item.id).required("asset photo")
                        require(content.contentType == item.contentType)
                        val bytes = java.util.Base64.getDecoder().decode(content.base64)
                        require(bytes.size == item.byteSize)
                        val suffix = if (item.contentType == "image/png") "png" else "jpg"
                        val directory = File(requireNotNull(context) { "Ảnh Backend không khả dụng trong kiểm thử JVM." }.cacheDir, "rental-backend-media").apply { check(exists() || mkdirs()) }
                        val file = File(directory, "${item.id}.$suffix")
                        val temporary = File(directory, "${item.id}.$suffix.tmp")
                        temporary.writeBytes(bytes)
                        check(temporary.renameTo(file) || (temporary.delete() && file.exists()))
                        "${Uri.fromFile(file)}"
                    }
                    val point = property.operationalLocation
                    managedAssets += LocalRentalAsset(
                        id = room.id,
                        propertyId = property.id,
                        type = assetDetails?.assetType.orEmpty(),
                        name = room.nameOrLabel,
                        operationalAddress = property.operationalAddressText.orEmpty(),
                        publicArea = assetDetails?.publicAreaLabel.orEmpty(),
                        area = assetDetails?.areaSquareMeters.orEmpty(),
                        monthlyRent = currentListing?.publicPriceProjection.orEmpty(),
                        advertisedDeposit = assetDetails?.advertisedDeposit.orEmpty(),
                        description = currentListing?.publicDescription.orEmpty(),
                        bedrooms = assetDetails?.bedrooms?.toString().orEmpty(),
                        bathrooms = assetDetails?.bathrooms?.toString().orEmpty(),
                        furnishing = assetDetails?.furnishing.orEmpty(),
                        amenities = assetDetails?.amenityIds.orEmpty(),
                        rules = assetDetails?.rules.orEmpty(),
                        photoUris = downloadedPhotos,
                        photoMediaIds = media.sortedBy { it.position }.map { it.id },
                        publicPhotoMediaIds = media.filter { it.isPublic }.mapTo(mutableSetOf()) { it.id },
                        status = if (room.recordLifecycle == "archived" || property.lifecycleStatus == "archived") ManagedAssetStatus.ARCHIVED
                            else if (assetDetails?.managementStatus == "ACTIVE" || currentListing?.status == "published") ManagedAssetStatus.ACTIVE
                            else ManagedAssetStatus.DRAFT,
                        listingStatus = currentListing?.status?.let(::listingVisibility) ?: ListingVisibility.DRAFT,
                        occupied = room.operationalState == "occupied",
                        electricityOffer = assetDetails?.electricityOffer.orEmpty(),
                        waterOffer = assetDetails?.waterOffer.orEmpty(),
                        serviceOffer = assetDetails?.serviceOffer.orEmpty(),
                        minimumTermMonths = assetDetails?.minimumTermMonths?.toString().orEmpty(),
                        availableFrom = assetDetails?.availableFrom.orEmpty(),
                        operationalLatitude = point?.latitude?.toString().orEmpty(),
                        operationalLongitude = point?.longitude?.toString().orEmpty(),
                        bathroomArrangement = assetDetails?.bathroomArrangement?.let { runCatching { BathroomArrangement.valueOf(it) }.getOrNull() },
                        maxOccupants = assetDetails?.maxOccupants,
                        floorLabel = assetDetails?.floorLabel,
                        publicListingId = currentListing?.id,
                    )

                    for (incident in api.getIncidents(room.id).required("incidents")) {
                        if (incident.roomId != room.id) continue
                        incidents[incident.id] = incident
                        incidentEvents[incident.id] = api.getIncidentEvents(incident.id)
                            .required("incident events")
                            .filter { it.incidentId == incident.id }
                    }

                    for (tenancy in api.getTenancies(room.id).required("tenancies")) {
                        if (tenancy.roomId != room.id) continue
                        tenancies[tenancy.id] = tenancy
                        operatorTenancyToOrganization[tenancy.id] = organization.id
                        try {
                            api.getBillingCycles(tenancy.id).required("billing cycles")
                                .filter { it.tenancyId == tenancy.id }.flatMap { it.charges }.mapTo(chargeBucket, ::mapCharge)
                        } catch (_: RuntimeException) { financeReadErrors += "Chưa tải được khoản thu của ${room.nameOrLabel}." }
                        try {
                            val payments = api.getPayments(tenancy.id).required("operator payments").filter { it.tenancyId == tenancy.id }
                            payments.forEach { paymentsById[it.id] = it }
                            payments.mapTo(paymentBucket, ::mapPayment)
                        } catch (_: RuntimeException) { financeReadErrors += "Chưa tải được thanh toán của ${room.nameOrLabel}." }
                        try {
                            api.getDeposit(tenancy.id).optionalNotFound("operator deposit")
                                ?.takeIf { it.tenancyId == tenancy.id }?.let { depositBucket += mapDeposit(it) }
                        } catch (_: RuntimeException) { financeReadErrors += "Chưa tải được tiền cọc của ${room.nameOrLabel}." }
                    }
                }
            }
        }

        val termsByTenancy = mutableMapOf<String, List<TenancyTermsTransport>>()
        val noticesByTenancy = mutableMapOf<String, List<TenancyNoticeCard>>()
        val tenantFinance = mutableMapOf<String, TenantFinanceProjection>()
        for (tenancyId in access.linkedTenancyIds) {
            val tenancy = api.getTenancy(tenancyId).required("tenant tenancy")
            if (tenancy.id != tenancyId) continue
            tenancies[tenancy.id] = tenancy
            for (incident in api.getIncidents(tenancy.roomId).required("tenant incidents")) {
                if (incident.roomId != tenancy.roomId) continue
                incidents[incident.id] = incident
                incidentEvents[incident.id] = api.getIncidentEvents(incident.id)
                    .required("tenant incident events")
                    .filter { it.incidentId == incident.id }
            }
            val terms = api.getTerms(tenancyId).required("tenancy terms")
                .filter { it.tenancyId == tenancyId }
            termsByTenancy[tenancyId] = terms
            noticesByTenancy[tenancyId] = api.getNotices(tenancyId).required("tenancy notices")
                .filter { it.tenancyId == tenancyId }
                .map(::mapNotice)
            val charges = try {
                api.getBillingCycles(tenancyId).required("tenant billing cycles").filter { it.tenancyId == tenancyId }
                    .flatMap { it.charges }.map(::mapCharge).distinctBy { it.chargeId }
            } catch (_: RuntimeException) { financeReadErrors += "Chưa tải được các khoản cần thanh toán."; emptyList() }
            val payments = try { api.getPayments(tenancyId).required("tenant payments").filter { it.tenancyId == tenancyId } }
                catch (_: RuntimeException) { financeReadErrors += "Chưa tải được thanh toán."; emptyList() }
            payments.forEach { paymentsById[it.id] = it }
            val paymentCards = payments.map(::mapPayment).distinctBy { it.paymentId }
            val deposit = try {
                api.getDeposit(tenancyId).optionalNotFound("tenant deposit")?.takeIf { it.tenancyId == tenancyId }?.let(::mapDeposit)
            } catch (_: RuntimeException) { financeReadErrors += "Chưa tải được tiền cọc."; null }
            tenantFinance[tenancyId] = TenantFinanceProjection(
                tenancyId = tenancyId,
                charges = charges,
                payments = paymentCards,
                deposits = listOfNotNull(deposit),
            )
        }

        val receipts = try { api.getReceipts().required("receipts") }
            catch (_: RuntimeException) { financeReadErrors += "Chưa tải được biên nhận."; emptyList() }
        for (receipt in receipts) {
            val payment = paymentsById[receipt.paymentId] ?: continue
            val receiptCard = ReceiptCard(
                receiptId = receipt.id,
                confirmedPaymentId = receipt.paymentId,
                issuedAtLabel = "${receipt.issuedAt} \u00B7 ${receipt.status}",
            )
            tenantFinance[payment.tenancyId]?.let { current ->
                tenantFinance[payment.tenancyId] = current.copy(
                    receipts = (current.receipts + receiptCard).distinctBy { it.receiptId },
                )
            }
            operatorTenancyToOrganization[payment.tenancyId]?.let { organizationId ->
                operatorReceipts.getOrPut(organizationId) { mutableListOf() }.add(receiptCard)
            }
        }

        val notifications = api.getNotifications().required("notifications")
            .map(::mapNotification)

        val roomLabels = rooms.associate { it.id to it.nameOrLabel }
        val tenancyCards = tenancies.values.map { tenancy ->
            val latestTerms = termsByTenancy[tenancy.id]?.maxByOrNull { it.version }
            TenancyCard(
                tenancyId = tenancy.id,
                roomId = tenancy.roomId,
                roomLabel = roomLabels[tenancy.roomId] ?: "Phòng",
                lifecycle = tenancyLifecycle(tenancy.status),
                termsVersionLabel = latestTerms?.let { "Terms v${it.version}" },
            )
        }

        return FrontendReadSnapshot(
            localManagement = LocalManagement(assets = managedAssets.distinctBy { it.id }),
            publicListings = publicListings,
            organizations = organizationRows.map { OrganizationCard(it.id, it.name) },
            properties = properties.distinctBy { it.id }.map { PropertyCard(it.id, it.organizationId, it.name) },
            operationalRooms = rooms.distinctBy { it.id }.map(::mapRoom),
            operatorListings = operatorListings.distinctBy { it.listingId },
            tenancies = tenancyCards.distinctBy { it.tenancyId },
            tenantFinanceByTenancy = tenantFinance,
            noticesByTenancy = noticesByTenancy,
            operatorFinanceByOrganization = organizationRows.associate { organization ->
                organization.id to OperatorFinanceProjection(
                    charges = operatorCharges[organization.id].orEmpty().distinctBy { it.chargeId },
                    confirmedPayments = operatorPayments[organization.id].orEmpty().distinctBy { it.paymentId },
                    deposits = operatorDeposits[organization.id].orEmpty().distinctBy { it.depositId },
                    receipts = operatorReceipts[organization.id].orEmpty().distinctBy { it.receiptId },
                )
            },
            incidents = incidents.values.map { incident ->
                mapIncident(incident, incidentEvents[incident.id].orEmpty())
            },
            dashboardByOrganization = dashboardByOrganization,
            notifications = notifications,
            recoverableReadErrors = financeReadErrors.distinct(),
        )
    }

    private fun mapPublicListings(values: List<PublicListingTransport>): List<PublicListingCard> =
        values.mapNotNull { listing ->
            val visibility = listingVisibility(listing.status)
            if (visibility != ListingVisibility.PUBLISHED) return@mapNotNull null
            PublicListingCard(
                listingId = listing.id,
                title = listing.publicTitle,
                publicAreaLabel = "Vị trí công khai",
                publicGeoPoint = PublicGeoPoint(listing.publicLocation.latitude, listing.publicLocation.longitude),
                askingPriceLabel = listing.publicPriceProjection,
                visibility = visibility,
                publicPhotoIds = listing.publicPhotoIds,
                amenities = listing.publicAmenityIds.map(AmenityCatalog::label),
            )
        }

    private fun mapPublicSearchResult(value: PublicListingSearchResultTransport) = PublicListingCard(
        listingId = value.listingId,
        title = value.publicTitle,
        publicAreaLabel = "Vị trí công khai",
        publicGeoPoint = PublicGeoPoint(value.publicLocation.latitude, value.publicLocation.longitude),
        askingPriceLabel = value.publicPriceProjection,
        visibility = ListingVisibility.PUBLISHED,
        distanceMeters = value.distanceMeters,
        publicPhotoIds = value.publicPhotoIds,
        amenities = value.publicAmenityIds.map(AmenityCatalog::label),
    )

    private fun mapRoom(room: RoomTransport) = OperationalRoomCard(
        roomId = room.id,
        propertyId = room.propertyId,
        label = room.nameOrLabel,
        operationalState = roomOperationalState(room.operationalState),
        lifecycle = recordLifecycle(room.recordLifecycle),
    )

    private fun mapOperatorListing(listing: ListingTransport) = OperatorListingCard(
        listingId = listing.id,
        roomId = listing.roomId,
        title = listing.publicTitle,
        visibility = listingVisibility(listing.status),
    )

    private fun mapDashboard(dashboard: DashboardTransport) = DashboardReadModel(
        roomsByState = mapOf(
            RoomOperationalState.VACANT to dashboard.roomsByState.vacant,
            RoomOperationalState.OCCUPIED to dashboard.roomsByState.occupied,
            RoomOperationalState.MAINTENANCE to dashboard.roomsByState.maintenance,
            RoomOperationalState.INACTIVE to dashboard.roomsByState.inactive,
        ),
        activeTenancyCount = dashboard.activeTenancyCount,
        outstandingReceivableLabel = dashboard.outstandingReceivable,
        confirmedPaymentTotalLabel = dashboard.confirmedPaymentTotal,
        openIncidentCount = dashboard.openIncidentCount,
    )

    private fun mapCharge(charge: ChargeTransport) = ChargeCard(
        chargeId = charge.id,
        label = charge.type,
        amountLabel = charge.amount,
        outstandingLabel = charge.outstandingAmount,
    )

    private fun mapPayment(payment: PaymentTransport) = PaymentCard(
        paymentId = payment.id,
        amountLabel = payment.amount,
        confirmationLabel = "${rentalDate(payment.confirmedAt, includeTime = true)} · ${paymentVerificationLabel(payment.verification)}",
    )

    private fun mapDeposit(deposit: DepositProjectionTransport) = DepositCard(
        tenancyId = deposit.tenancyId,
        requiredLabel = deposit.requirementAmount,
        fundedLabel = deposit.fundedAmount,
        settlementLabel = deposit.settledAmount,
        depositId = deposit.id,
        heldLabel = deposit.heldAmount,
        state = deposit.state,
        blockedByOpenPolicy = deposit.blockedByOpenPolicy,
    )

    private fun mapNotice(notice: TenancyNoticeTransport) = TenancyNoticeCard(
        noticeId = notice.id,
        tenancyId = notice.tenancyId,
        type = notice.noticeType,
        content = notice.contentOrNote,
        issuedAtLabel = notice.issuedAt,
        acknowledgedAtLabel = notice.acknowledgedAt,
    )

    private fun mapNotification(notification: NotificationTransport) = NotificationCard(
        notificationId = notification.id,
        category = notification.category,
        message = notification.messageOrPayloadReference,
        deliveryStatus = notification.deliveryStatus,
        createdAtLabel = notification.createdAt,
        readAtLabel = notification.readAt?.let { value ->
            if (value.isJsonPrimitive) value.asString else value.toString()
        },
        sourceType = notification.sourceType,
        sourceId = notification.sourceId,
    )

    private fun mapIncident(
        incident: IncidentTransport,
        events: List<IncidentEventTransport>,
    ) = IncidentCard(
        incidentId = incident.id,
        roomId = incident.roomId,
        title = incident.category,
        lifecycle = incidentLifecycle(incident.status),
        timeline = events.map(::mapIncidentEvent),
        serverActions = emptyList(),
    )

    private fun mapIncidentEvent(event: IncidentEventTransport) = IncidentEventCard(
        eventId = event.id,
        description = buildString {
            append(event.eventType)
            if (event.fromStatus != null || event.toStatus != null) {
                append(": ")
                append(event.fromStatus ?: "-")
                append(" → ")
                append(event.toStatus ?: "-")
            }
            event.note?.takeIf { it.isNotBlank() }?.let {
                append(" · ")
                append(it)
            }
        },
        occurredAtLabel = event.occurredAt,
    )

    private fun listingVisibility(value: String) = enumValue<ListingVisibility>(value)
    private fun roomOperationalState(value: String) = enumValue<RoomOperationalState>(value)
    private fun recordLifecycle(value: String) = enumValue<RecordLifecycle>(value)
    private fun tenancyLifecycle(value: String) = enumValue<TenancyLifecycle>(value)
    private fun incidentLifecycle(value: String) = enumValue<IncidentLifecycle>(value)

    private fun String.toOptionalInt(field: String): Int? {
        if (isBlank()) return null
        return toIntOrNull() ?: error("Giá trị $field không hợp lệ; dữ liệu đã nhập được giữ lại.")
    }

    private inline fun <reified T : Enum<T>> enumValue(value: String): T = try {
        enumValueOf<T>(value.uppercase())
    } catch (error: IllegalArgumentException) {
        throw IllegalStateException("Backend trả enum không hỗ trợ: $value", error)
    }

    private fun <T> ApiOutcome<T>.required(operation: String): T = when (this) {
        is ApiOutcome.Data -> value
        is ApiOutcome.Failure -> throw IllegalStateException(
            "$operation thất bại: $kind" + (httpStatus?.let { " (HTTP $it)" } ?: ""),
        )
    }

    private fun <T> ApiOutcome<T>.optionalNotFound(operation: String): T? = when (this) {
        is ApiOutcome.Data -> value
        is ApiOutcome.Failure -> if (httpStatus == 404) null else throw IllegalStateException(
            "$operation thất bại: $kind" + (httpStatus?.let { " (HTTP $it)" } ?: ""),
        )
    }
}
