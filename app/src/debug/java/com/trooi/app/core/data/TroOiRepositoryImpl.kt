package com.trooi.app.core.data

import com.trooi.app.core.demo.DemoData
import com.trooi.app.core.model.AccessCapabilities
import com.trooi.app.core.model.FrontendReadSnapshot
import com.trooi.app.core.model.NotificationCard
import com.trooi.app.core.model.PublicListingCard
import com.trooi.app.core.model.*
import com.google.gson.Gson
import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Isolated fixture identity and local product metadata; rental finance is never mutated here. */
/** Debug-only fixture repository; never bundled in release. */
class FixtureTroOiRepository internal constructor(private val prefs: android.content.SharedPreferences?, private val payments: com.trooi.app.core.demo.DemoPaymentClient? = null) : TroOiRepository {
    constructor(context: Context) : this(context.getSharedPreferences("trooi_debug_session", Context.MODE_PRIVATE), com.trooi.app.core.demo.DemoPaymentClient())
    internal constructor() : this(null)
    private var session: UserSession? = null
    private val gson = Gson()
    private val memoryManagement = mutableMapOf(DemoData.accounts[1].userId to DemoData.ownerManagement)
    private val memoryOrganizations = mutableMapOf<String, String>()
    private var confirmedFinance: TenantFinanceProjection? = null
    private val memoryMessages = java.util.concurrent.ConcurrentHashMap<String, List<ConversationMessage>>()
    // ponytail: one local-write lock; use account locks only if concurrent local writes become frequent.
    private val messageWrites = Mutex()
    private fun localMessages(userId: String): List<ConversationMessage> = prefs?.getString("messages:$userId", null)?.let {
        gson.fromJson(it, Array<ConversationMessage>::class.java).toList()
    } ?: memoryMessages[userId].orEmpty()
    private fun management(userId: String): LocalManagement {
        val saved = prefs?.getString("management:$userId", null)
            ?.let { gson.fromJson(it, LocalManagement::class.java) } ?: memoryManagement[userId] ?: LocalManagement()
        // Preserve existing capacity, media and user-created assets when adopting the shared PostgreSQL IDs.
        val normalized = saved.copy(assets = saved.assets.map { asset -> asset.copy(
            id = if (asset.id == "fixture-room-a02") DemoData.ROOM else asset.id,
            propertyId = if (asset.propertyId == "fixture-property-phunhuan") DemoData.PROPERTY else asset.propertyId,
        ) })
        return if (userId == DemoData.accounts[1].userId && prefs?.contains("management:$userId") == true)
            com.trooi.app.core.demo.DemoRentalGraph.reconcileSavedOwner(normalized) else normalized
    }
    private fun localOrganization(userId: String): String? = prefs?.getString("organization:$userId", null) ?: memoryOrganizations[userId]
    private fun withLocalOperator(account: UserSession): UserSession = localOrganization(account.userId)?.let {
        account.copy(access = account.access.copy(operatedOrganizationIds = account.access.operatedOrganizationIds + it))
    } ?: account
    private fun publicListings(): List<PublicListingCard> {
        val listings = com.trooi.app.core.demo.DemoRentalGraph.all
        .filter { it.ownerId != DemoData.accounts[1].userId && it.asset.listingStatus == ListingVisibility.PUBLISHED && !it.asset.occupied }
        .map { com.trooi.app.core.demo.DemoRentalGraph.publicListing(it) } + DemoData.accounts.flatMap { account -> management(account.userId).assets
        .filter { it.status == ManagedAssetStatus.ACTIVE && it.listingStatus == ListingVisibility.PUBLISHED && !it.occupied }
        .map { asset -> com.trooi.app.core.demo.DemoRentalGraph.all.firstOrNull { it.asset.id == asset.id }?.let {
            com.trooi.app.core.demo.DemoRentalGraph.publicListing(it, asset)
        } ?: PublicListingCard(asset.listingId, asset.name, asset.publicArea, null, "${asset.monthlyRent}đ/tháng", ListingVisibility.PUBLISHED, asset.amenities,
            rentalDetails = asset.publicDetails(account.displayName)) } }
        return listings.sortedBy { listing ->
            com.trooi.app.core.demo.DemoRentalGraph.all.indexOfFirst { it.asset.listingId == listing.listingId }
                .takeIf { it >= 0 } ?: Int.MAX_VALUE
        }
    }
    private fun authorizedRead(access: AccessCapabilities): FrontendReadSnapshot {
        val account = currentSession()
        val organization = account?.access?.operatedOrganizationIds?.singleOrNull()?.takeIf { it in access.operatedOrganizationIds }
        val allAssets = DemoData.accounts.flatMap { management(it.userId).assets }
        val catalog = if (organization != null) management(account.userId) else null
        val additional = catalog?.assets.orEmpty().filter { it.id != DemoData.ROOM && it.status != ManagedAssetStatus.DRAFT }
        val base = DemoData.authorizedRead(access)
        val read = base.copy(localManagement = catalog, publicListings = publicListings(),
            conversations = account?.let { user -> DemoData.conversations(user.userId).map { conversation ->
                val asset = allAssets.firstOrNull { it.id == conversation.contextId }
                conversation.copy(messages = conversation.messages + localMessages(user.userId).filter { it.id.startsWith("${conversation.id}:") },
                    rentalLabel = asset?.name ?: conversation.rentalLabel,
                    photoResource = asset?.photoResources?.firstOrNull() ?: conversation.photoResource,
                    photoUri = asset?.photoUris?.firstOrNull())
            } }.orEmpty(),
            organizations = base.organizations + if (organization != null && organization != DemoData.ORGANIZATION) listOf(OrganizationCard(organization, "Tài sản của ${account!!.displayName}")) else emptyList(),
            tenancies = base.tenancies.map { tenancy -> allAssets.firstOrNull { it.id == tenancy.roomId }?.let { tenancy.copy(roomLabel = it.name) } ?: tenancy },
            rentalAssetPresentationByRoom = base.rentalAssetPresentationByRoom.mapValues { (roomId, presentation) ->
                allAssets.firstOrNull { it.id == roomId }?.let { RentalAssetPresentation(it.type, it.publicArea, it.photoResources, it.photoUris) } ?: presentation
            } + catalog?.assets.orEmpty().filter { it.status != ManagedAssetStatus.DRAFT }.associate { it.id to RentalAssetPresentation(it.type, it.publicArea, it.photoResources, it.photoUris) },
            properties = base.properties + additional.map { PropertyCard(it.propertyId, organization!!, it.name) }.distinctBy { it.propertyId },
            operationalRooms = base.operationalRooms.map { room ->
                // Management entitlement does not end an existing tenancy or change its occupancy.
                val asset = catalog?.assets?.firstOrNull { it.id == room.roomId }
                if (asset == null) room else room.copy(label = asset.name)
            } + additional.map { OperationalRoomCard(it.id, it.propertyId, it.name,
                if (it.occupied) RoomOperationalState.OCCUPIED else if (it.status == ManagedAssetStatus.ARCHIVED) RoomOperationalState.INACTIVE else RoomOperationalState.VACANT,
                if (it.status == ManagedAssetStatus.ARCHIVED) RecordLifecycle.ARCHIVED else RecordLifecycle.ACTIVE) },
            operatorListings = base.operatorListings.map { listing ->
                val asset = catalog?.assets?.firstOrNull { it.id == listing.roomId }
                if (asset == null) listing else listing.copy(title = asset.name, visibility = asset.listingStatus)
            } + additional.map { OperatorListingCard(it.listingId, it.id, it.name, it.listingStatus) })
        return if (payments == null) read else withFinance(read, access, confirmedFinance)
    }
    private fun withFinance(read: FrontendReadSnapshot, access: AccessCapabilities, finance: TenantFinanceProjection?): FrontendReadSnapshot {
        val operator = finance?.let { OperatorFinanceProjection(it.charges, it.payments, deposits = it.deposits) }
        return read.copy(
            tenantFinanceByTenancy = if (DemoData.TENANCY in access.linkedTenancyIds && finance != null) mapOf(DemoData.TENANCY to finance) else emptyMap(),
            operatorFinanceByOrganization = if (DemoData.ORGANIZATION in access.operatedOrganizationIds && operator != null) mapOf(DemoData.ORGANIZATION to operator) else emptyMap(),
            operatorFinanceByRoom = if (DemoData.ORGANIZATION in access.operatedOrganizationIds && operator != null) mapOf(DemoData.ROOM to operator) else emptyMap(),
            // No allocation read contract is available; never infer a balance from Payment.
            dashboardByOrganization = read.dashboardByOrganization.mapValues { (_, dashboard) -> dashboard.copy(outstandingReceivableLabel = null, confirmedPaymentTotalLabel = null) },
        )
    }
    private fun validateCatalog(userId: String, next: LocalManagement) {
        check(next.assets.map { it.listingId }.distinct().size == next.assets.size) { "Tin đăng đã được liên kết với tài sản khác." }
        check(next.assets.all { asset -> com.trooi.app.core.demo.DemoRentalGraph.all.none {
            it.ownerId != userId && (it.asset.id == asset.id || it.asset.propertyId == asset.propertyId || it.asset.listingId == asset.listingId)
        } }) { "Tài sản không thuộc tài khoản này." }
        check(next.assets.all { asset -> asset.publicListingId == null || com.trooi.app.core.demo.DemoRentalGraph.all.any {
            it.ownerId == userId && it.asset.id == asset.id && it.asset.propertyId == asset.propertyId && it.asset.listingId == asset.listingId
        } }) { "Tin đăng không thuộc tài sản này." }
        check(next.assets.all { candidate -> DemoData.accounts.filter { it.userId != userId }.none { other -> management(other.userId).assets.any {
            it.id == candidate.id || it.propertyId == candidate.propertyId || it.listingId == candidate.listingId
        } } }) { "Tài sản không thuộc tài khoản hiện tại." }
    }
    private fun updateManagement(change: (LocalManagement) -> LocalManagement): Result<FrontendReadSnapshot> = runCatching {
        val account = currentSession() ?: error("Vui lòng đăng nhập lại.")
        check(account.access.operatedOrganizationIds.isNotEmpty()) { "Tài khoản chưa có quyền quản lý tài sản." }
        val next = change(management(account.userId))
        validateCatalog(account.userId, next)
        check(prefs == null || prefs.edit().putString("management:${account.userId}", gson.toJson(next)).commit()) { "Chưa lưu được dữ liệu. Vui lòng thử lại." }
        memoryManagement[account.userId] = next
        authorizedRead(account.access)
    }
    override suspend fun saveLocalMessage(expectedUserId: String, conversationId: String, text: String): Result<FrontendReadSnapshot> = messageWrites.withLock { runCatching {
        val account = currentSession() ?: error("Vui lòng đăng nhập lại.")
        check(account.userId == expectedUserId) { "Phiên đăng nhập đã thay đổi." }
        require(DemoData.conversations(account.userId).any { it.id == conversationId }) { "Cuộc trò chuyện không thuộc tài khoản này." }
        val clean = text.trim()
        require(clean.isNotEmpty() && clean.length <= 500) { "Nội dung tối đa 500 ký tự." }
        val saved = localMessages(account.userId)
        // ponytail: cap local drafts at 100 per account; add a drafts manager before increasing storage.
        check(saved.size < 100) { "Đã đạt giới hạn tin nhắn lưu trên thiết bị." }
        val next = saved + ConversationMessage("$conversationId:${java.util.UUID.randomUUID()}", account.userId, clean, java.time.Instant.now().toString(), localOnly = true)
        check(prefs == null || prefs.edit().putString("messages:${account.userId}", gson.toJson(next)).commit()) { "Chưa lưu được tin nhắn." }
        memoryMessages[account.userId] = next
        authorizedRead(account.access)
    } }
    override suspend fun loadLocalConversations(): Result<List<ConversationCard>> = runCatching {
        val account = currentSession() ?: error("Vui lòng đăng nhập lại.")
        authorizedRead(account.access).conversations
    }
    override suspend fun saveLocalAsset(asset: LocalRentalAsset, activate: Boolean, publish: Boolean) =
        updateManagement { it.save(asset, activate, publish) }
    override suspend fun purchaseLocalCapacity(purchaseId: String) = updateManagement { it.purchase(purchaseId) }
    override suspend fun archiveLocalAsset(assetId: String) = updateManagement { it.archive(assetId) }
    override suspend fun completeLocalLandlordOnboarding(application: LocalLandlordApplication): Result<UserSession> = runCatching {
        val account = currentSession() ?: error("Vui lòng đăng nhập lại.")
        check(account.access.operatedOrganizationIds.isEmpty()) { "Tài khoản đã có quyền quản lý." }
        require(application.valid()) { "Hoàn tất thông tin trước khi tiếp tục." }
        application.firstAsset?.let { asset ->
            require(DemoData.accounts.none { other ->
                management(other.userId).assets.any { it.id == asset.id || it.propertyId == asset.propertyId }
            }) { "Tài sản đã được liên kết." }
        }
        val organization = "local-organization-${account.userId}"
        val catalog = application.firstAsset?.let { LocalManagement().save(it, true, application.publish) }
            ?: LocalManagement()
        validateCatalog(account.userId, catalog)
        check(prefs == null || prefs.edit().putString("organization:${account.userId}", organization)
            .putString("management:${account.userId}", gson.toJson(catalog)).commit()) { "Chưa lưu được thông tin." }
        memoryOrganizations[account.userId] = organization
        memoryManagement[account.userId] = catalog
        withLocalOperator(account).also { session = it }
    }
    private fun currentSession() = (session ?: DemoData.accounts.firstOrNull { it.userId == prefs?.getString("userId", null) })?.let(::withLocalOperator)
    override fun initialSnapshot() = TroOiSnapshot(read = FrontendReadSnapshot(publicListings = publicListings()), demoPreview = true)
    override fun clearSession() { session = null; confirmedFinance = null; prefs?.edit()?.remove("userId")?.apply() }

    override suspend fun refreshSessionContext(): Result<UserSession> = currentSession()?.let { Result.success(it) } ?: Result.failure(IllegalStateException("Vui lòng đăng nhập lại."))

    override suspend fun refreshPublicListings(): Result<List<PublicListingCard>> =
        runCatching { publicListings() }

    override suspend fun searchPublicListings(
        latitude: Double,
        longitude: Double,
        radiusMeters: Double,
        minPrice: String?,
        maxPrice: String?,
    ): Result<List<PublicListingCard>> = runCatching { publicListings() }

    override suspend fun authenticateWithGoogleIdToken(idToken: String): Result<UserSession> =
        Result.failure(IllegalStateException("Preview debug không dùng Google runtime authentication."))

    override suspend fun refreshAuthorizedRead(access: AccessCapabilities): Result<FrontendReadSnapshot> =
        runCatching {
            val account = currentSession() ?: error("Vui lòng đăng nhập lại.")
            check(account.access == access) { "Quyền truy cập không thuộc tài khoản hiện tại." }
            if (payments != null && (DemoData.TENANCY in access.linkedTenancyIds || DemoData.ORGANIZATION in access.operatedOrganizationIds)) {
                val finance = payments.finance(account.userId)
                check(currentSession()?.userId == account.userId) { "Phiên đăng nhập đã thay đổi." }
                confirmedFinance = finance
                // Read local messages/catalog after network IO so a concurrent local save remains visible.
                withFinance(authorizedRead(access), access, finance)
            } else authorizedRead(access)
        }

    override suspend fun createDemoCheckout(tenancyId: String, amount: String, key: String) = runCatching {
        val account = currentSession() ?: error("Vui lòng đăng nhập lại.")
        check(tenancyId in account.access.linkedTenancyIds && tenancyId == DemoData.TENANCY)
        requireNotNull(payments).create(account.userId, tenancyId, amount, key)
    }
    override suspend fun getDemoCheckout(id: String) = runCatching {
        val account = currentSession() ?: error("Vui lòng đăng nhập lại.")
        check(DemoData.TENANCY in account.access.linkedTenancyIds)
        requireNotNull(payments).get(account.userId, id)
    }

    override suspend fun login(identifier: String, password: String): Result<UserSession> {
        val session = DemoData.authenticate(identifier, password)?.let(::withLocalOperator)
            ?: return Result.failure(IllegalArgumentException("Email hoặc mật khẩu chưa đúng."))
        this.session = session
        prefs?.edit()?.putString("userId", session.userId)?.apply()
        return Result.success(session)
    }

    override suspend fun signUp(fullName: String, phone: String, email: String, password: String): Result<UserSession> =
        Result.failure(IllegalStateException("Hiện chưa thể tạo tài khoản. Vui lòng thử lại sau."))

    override suspend fun requestPasswordReset(identifier: String): Result<Unit> =
        Result.failure(IllegalStateException("Preview chỉ hiển thị giao diện; chưa gửi yêu cầu khôi phục."))

    override suspend fun submitInquiry(listingId: String, message: String): Result<Unit> =
        Result.failure(IllegalStateException("Preview không tạo Inquiry thật."))

    override suspend fun loadNotification(notificationId: String): Result<NotificationCard> =
        Result.failure(IllegalStateException("Preview không tải Notification thật."))

    override suspend fun markNotificationRead(notificationId: String): Result<Unit> =
        Result.failure(IllegalStateException("Preview không cập nhật Notification thật."))
}
