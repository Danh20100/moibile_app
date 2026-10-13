package com.trooi.app.features.profile

import com.trooi.app.ui.components.TroOiPage
import com.trooi.app.ui.components.TroOiListRow
import com.trooi.app.ui.components.TroOiInformationRow
import com.trooi.app.ui.components.TroOiPageHeader
import com.trooi.app.ui.components.TroOiConfirmDialog
import com.trooi.app.ui.components.TroOiButtonStyle
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.*
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.material3.*
import com.trooi.app.ui.components.TroOiFormField
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.material.icons.automirrored.rounded.ReceiptLong
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.features.auth.isValidIdentifier
import com.trooi.app.features.auth.isValidEmail
import com.trooi.app.features.auth.EmailOtpPanel
import com.trooi.app.features.auth.rememberContactOtpForm
import com.trooi.app.ui.components.TroOiButton
import kotlinx.coroutines.launch

private val settingsPages = linkedMapOf(
    "personal" to "Thông tin cá nhân", "security" to "Đăng nhập và bảo mật",
    "privacy" to "Quyền riêng tư", "notifications" to "Thông báo",
    "payments" to "Thanh toán và chi trả", "language" to "Ngôn ngữ và bản dịch",
)
private val operationalNotificationGroups = listOf("Bảo mật và xác thực", "Công nợ và biên nhận", "Sự cố và hoạt động thuê trọ")

fun marketingOptOutChannels(channels: String): String = channels.split(',').filter { it in operationalNotificationGroups }.joinToString(",")

private val personalFields = listOf("Tên pháp lý", "Số điện thoại", "Địa chỉ cư trú")

fun personalInputValid(label: String, value: String): Boolean = when (label) {
    "Tên pháp lý" -> false
    "Số điện thoại" -> !value.contains('@') && isValidIdentifier(value)
    "Email" -> isValidEmail(value)
    else -> value.trim().length >= 5
}

/** Preview drafts never mutate account, payment or privacy records. Both privacy entries use this flow. */
@Composable
fun AccountSettingsFlow(
    state: TroOiUiState,
    onBack: () -> Unit,
    initialPage: String = "settings",
    onSaveDisplayName: suspend (String) -> Result<Unit> = {
        Result.failure(IllegalStateException("Cập nhật hồ sơ chưa khả dụng."))
    },
    onOpenOperatorWorkspace: () -> Unit = {},
    onStartLandlordOnboarding: () -> Unit = {},
) {
    var path by rememberSaveable(state.backendUserId, initialPage) { mutableStateOf(initialPage) }
    LaunchedEffect(initialPage) {
        if (path.substringBefore('|') != initialPage) path = initialPage
    }
    val page = path.substringAfterLast('|')
    fun navigate(next: String) { if (next != "edit:Tên pháp lý") path += "|$next" }
    var editGrant by rememberSaveable(state.backendUserId, state.demoPreview) { mutableStateOf<String?>(null) }
    fun back() { editGrant = null; if ('|' in path) path = path.substringBeforeLast('|') else onBack() }

    var boundary by rememberSaveable { mutableStateOf<String?>(null) }
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var visibility by rememberSaveable { mutableStateOf("Thành viên có liên hệ thuê trọ") }
    var receipts by rememberSaveable { mutableStateOf(true) }
    var listingSearch by rememberSaveable { mutableStateOf(true) }
    var publicArea by rememberSaveable { mutableStateOf(false) }
    var channelApps by rememberSaveable { mutableStateOf("Ưu đãi,Cập nhật ứng dụng,Nhắc việc thuê trọ,Tin tức dịch vụ,Phản hồi") }
    var channelEmails by rememberSaveable { mutableStateOf("") }
    val initialDraft = if (page == "edit:Tên hiển thị") state.displayName else if (state.demoPreview) MockPersonalInfo.value(state.backendUserId, page.removePrefix("edit:")) else ""
    var draft by rememberSaveable(state.backendUserId, page) { mutableStateOf(initialDraft) }
    var saveError by rememberSaveable(state.backendUserId, page) { mutableStateOf<String?>(null) }
    var savingProfile by remember(state.backendUserId, page) { mutableStateOf(false) }
    val profileScope = rememberCoroutineScope()
    var passwordDirty by rememberSaveable(page) { mutableStateOf(false) }
    var discard by rememberSaveable(page) { mutableStateOf(false) }
    val preferences = arrayListOf(visibility, receipts.toString(), listingSearch.toString(), publicArea.toString(), channelApps, channelEmails)
    val preferenceForm = page in listOf("privacy", "visibility") || page.startsWith("channel:")
    val preferenceBaselines = rememberSaveable(state.backendUserId) { hashMapOf<String, ArrayList<String>>() }
    val originalPreferences = if (preferenceForm) preferenceBaselines.getOrPut(page) { preferences } else preferences
    val dirty = (preferenceForm && preferences != originalPreferences) || ((page.startsWith("edit:") || page == "contact") && draft != initialDraft) || (page in listOf("password", "pin") && passwordDirty)
    fun requestBack() { if (savingProfile) return; if (dirty) discard = true else { preferenceBaselines.remove(page); back() } }
    BackHandler { requestBack() }
    if (discard) TroOiConfirmDialog(
        onDismissRequest = { discard = false }, title = "Bỏ thay đổi chưa lưu?",
        text = "Thông tin bạn vừa sửa sẽ không được lưu.",
        confirmLabel = "Bỏ thay đổi", destructive = true, onConfirm = {
            if (preferenceForm) {
                visibility = originalPreferences[0]; receipts = originalPreferences[1].toBoolean()
                listingSearch = originalPreferences[2].toBoolean(); publicArea = originalPreferences[3].toBoolean()
                channelApps = originalPreferences[4]; channelEmails = originalPreferences[5]
            }
            preferenceBaselines.remove(page); discard = false; back()
        }, dismissLabel = "Tiếp tục chỉnh sửa",
    )
    var confirmation by rememberSaveable { mutableStateOf(false) }
    val context = LocalContext.current
    val profileCatalog = remember(context) { loadProfileCatalog(context) }
    val title = settingsPages[page] ?: when {
        page.startsWith("help:") -> profileCatalog?.help?.firstOrNull { it.id == page.removePrefix("help:") }?.title ?: "Hướng dẫn"
        page == "settings" -> "Cài đặt tài khoản"
        page.startsWith("edit:") -> page.removePrefix("edit:")
        page.startsWith("channel:") -> page.removePrefix("channel:")
        else -> mapOf("visibility" to "Chế độ hiển thị hồ sơ", "delete" to "Xóa tài khoản của tôi",
            "identity" to "Xác minh danh tính", "password" to "Mật khẩu", "pin" to "Mã PIN bảo mật",
            "privacy-legal" to "Quyền riêng tư & Pháp lý", "login-email" to "Email đăng nhập",
            "google" to "Tài khoản liên kết", "method" to "Phương thức thanh toán", "paid" to "Các khoản thanh toán của bạn",
            "payout" to "Phương thức nhận tiền", "transactions" to "Lịch sử giao dịch / biên nhận",
            "operator-transactions" to "Lịch sử giao dịch", "operator-receipts" to "Biên nhận",
            "tenant-receipts" to "Biên nhận tiền thuê",
            "help" to "Nhận trợ giúp", "contact" to "Liên hệ hỗ trợ", "host" to "Giới thiệu chủ nhà", "legal" to "Pháp lý")[page] ?: LegalDocumentType.fromRoute(page)?.title ?: page
    }
    val method = if (state.demoPreview) MockAccountSecurity.method(state.backendUserId) else ReauthenticationMethod.UNKNOWN
    var pending by remember(state.backendUserId, state.demoPreview, page) { mutableStateOf<(() -> Unit)?>(null) }
    var retry by remember(state.backendUserId) { mutableStateOf(SecurityRetry()) }
    var recovery by remember { mutableStateOf(false) }
    fun protect(afterCheck: () -> Unit = { boundary = title }) {
        when (method) {
            ReauthenticationMethod.PIN, ReauthenticationMethod.PASSWORD -> pending = afterCheck
            ReauthenticationMethod.RECOVERY -> recovery = true
            ReauthenticationMethod.UNKNOWN -> boundary = title
        }
    }
    // Unlocks a Debug Mock draft only; persistence still requires the official backend contract.
    val canEdit = state.demoPreview && editGrant == page
    fun open(next: String) {
        if (requiresEditReauthentication(next)) protect { editGrant = next; navigate(next) }
        else navigate(next)
    }
    if (pending != null) ReauthenticationDialog(state.backendUserId, method,
        onDismiss = { pending = null }, onRecovery = { pending = null; recovery = true },
        onChecked = { val action = pending; pending = null; action?.invoke() }, retry = retry, onRetry = { retry = it })
    if (recovery) TroOiConfirmDialog(onDismissRequest = { recovery = false }, title = "Khôi phục quyền truy cập",
        text = "Cần xác minh quyền sở hữu tài khoản để khôi phục phương thức bảo mật. Hiện chưa thể thực hiện; mã PIN và thông tin tài khoản của bạn chưa được thay đổi.",
        confirmLabel = "Đã hiểu", onConfirm = { recovery = false }, dismissLabel = null)
    if (boundary != null) TroOiConfirmDialog(
        onDismissRequest = { boundary = null }, title = "Chưa thể thực hiện",
        text = "$title hiện chưa thể hoàn tất yêu cầu này. Vui lòng thử lại sau; thông tin của bạn chưa được thay đổi.",
        confirmLabel = "Đã hiểu", onConfirm = { boundary = null }, dismissLabel = null,
    )
    if (confirmation) TroOiConfirmDialog(
        onDismissRequest = { confirmation = false }, title = "Xác nhận yêu cầu xóa?",
        text = "Bạn có muốn tiếp tục yêu cầu xóa tài khoản? Hồ sơ cần lưu giữ sẽ được xử lý theo chính sách áp dụng.",
        confirmLabel = "Tiếp tục", onConfirm = { confirmation = false; protect() }, destructive = true,
    )
    TroOiPage(Modifier.fillMaxSize()) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
    key(state.backendUserId, state.demoPreview, page) {
    LazyColumn(
        Modifier.fillMaxHeight().widthIn(max = 840.dp).fillMaxWidth().imePadding().testTag("account-page-$page"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        sectionItem { TroOiPageHeader(title, onBack = { requestBack() }) }
        when {
            requiresEditReauthentication(page) && !canEdit -> sectionItem {
                Text("Xác thực bảo mật trước khi chỉnh sửa thông tin.")
                TroOiButton("Xác thực để chỉnh sửa", { protect { editGrant = page } }, modifier = Modifier.fillMaxWidth())
            }
            page == "settings" -> {
                sectionItem {
                    SettingsOverviewIntro(
                        "Mọi thiết lập trong một nơi",
                        "Thông tin cá nhân tách biệt với danh tính đăng nhập. Quyền vận hành và dữ liệu thuê tuân theo từng quan hệ của bạn.",
                    )
                }
                sectionItem {
                    SettingsGroup("Hồ sơ & truy cập") {
                        SettingsNavRow(Icons.Rounded.PersonOutline, "Thông tin cá nhân", "Tên hiển thị, liên hệ và xác minh danh tính", { open("personal") })
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        SettingsNavRow(Icons.Rounded.Lock, "Đăng nhập và bảo mật", "Mật khẩu, PIN, email đăng nhập và Google", { open("security") })
                    }
                }
                sectionItem {
                    SettingsGroup("Quyền riêng tư & thông báo") {
                        SettingsNavRow(Icons.Rounded.Shield, "Quyền riêng tư", "Kiểm soát thông tin được chia sẻ", { open("privacy") })
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        SettingsNavRow(Icons.Rounded.NotificationsNone, "Thông báo", "Thông báo vận hành và ưu đãi", { open("notifications") })
                    }
                }
                sectionItem {
                    SettingsGroup("Tiện ích tài khoản") {
                        SettingsNavRow(Icons.AutoMirrored.Rounded.ReceiptLong, "Thanh toán và chi trả", "Giao dịch và biên nhận theo quyền truy cập", { open("payments") })
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        SettingsNavRow(Icons.Rounded.Language, "Ngôn ngữ và bản dịch", "Ngôn ngữ ứng dụng và tùy chọn hiển thị", { open("language") })
                    }
                }
            }
            page == "privacy-legal" -> {
                sectionItem { TroOiListRow("Quyền riêng tư", "Quyền hiển thị và kiểm soát dữ liệu", { open("privacy") }) }
                sectionItem { TroOiListRow("Pháp lý", "Điều khoản sử dụng và chính sách quyền riêng tư", { open("legal") }) }
            }
            page == "personal" -> {
                sectionItem {
                    SettingsGroup("Hồ sơ cá nhân") {
                        PersonalDetailRow(
                            label = "Tên hiển thị", value = state.displayName.ifBlank { "Chưa cung cấp" },
                            action = "Sửa", onClick = { open("edit:Tên hiển thị") },
                            modifier = Modifier.testTag("personal-display-name"),
                        )
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        personalFields.forEach { label ->
                            val value = if (state.demoPreview) MockPersonalInfo.value(state.backendUserId, label) else ""
                            PersonalDetailRow(
                                label = label,
                                value = value.ifBlank { "Chưa cung cấp" },
                                action = if (label == "Tên pháp lý") null else "Sửa",
                                onClick = if (label == "Tên pháp lý") null else { { open("edit:$label") } },
                                modifier = Modifier.testTag("personal-action-$label"),
                            )
                            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        }
                    }
                }
                sectionItem {
                    IdentityVerificationEntry(
                        onClick = { open("identity") },
                        modifier = Modifier.testTag("personal-action-Xác minh danh tính"),
                    )
                }
            }
            page == "edit:Tên hiển thị" -> sectionItem {
                Text("Tên này sẽ hiển thị trên hồ sơ TrọƠi của bạn.")
                TroOiFormField(draft, { draft = it; saveError = null },
                    label = { Text("Tên hiển thị") }, modifier = Modifier.fillMaxWidth(), singleLine = true, enabled = !savingProfile)
                saveError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                TroOiButton("Lưu tên hiển thị", {
                    savingProfile = true
                    profileScope.launch {
                        onSaveDisplayName(draft.trim()).fold(
                            onSuccess = { savingProfile = false; back() },
                            onFailure = { savingProfile = false; saveError = it.message ?: "Không thể lưu tên hiển thị." },
                        )
                    }
                }, enabled = !savingProfile && draft.trim().isNotBlank() && draft.length <= 80 &&
                    draft.trim() != state.displayName, modifier = Modifier.fillMaxWidth())
            }
            page == "edit:Phương thức thanh toán" || page == "edit:Phương thức nhận tiền" -> sectionItem {
                Text("Đặt tên để nhận biết phương thức của bạn.")
                TroOiFormField(draft, { draft = it }, label = { Text("Tên phương thức") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                TroOiButton("Tiếp tục", { boundary = title }, enabled = draft.trim().length >= 2, modifier = Modifier.fillMaxWidth())
            }
            page.startsWith("edit:") && page != "edit:Tên pháp lý" -> sectionItem {
                val label = page.removePrefix("edit:")
                val valid = personalInputValid(label, draft)
                val needsOtp = label == "Email" || label == "Số điện thoại"
                val otp = rememberContactOtpForm(draft)
                if (needsOtp) EmailOtpPanel(draft, state.demoPreview, onValueChange = { draft = it },
                    phone = label == "Số điện thoại", form = otp)
                else TroOiFormField(draft, { draft = it }, label = { Text(label) },
                    modifier = Modifier.fillMaxWidth(), singleLine = false,
                    isError = draft.isNotEmpty() && !valid,
                    supportingText = { if (draft.isNotEmpty() && !valid) Text("Kiểm tra lại $label trước khi tiếp tục.") })
                TroOiButton("Lưu thay đổi", {
                    if (!needsOtp || otp.validateOnSubmit(draft, state.demoPreview)) boundary = "Lưu $label"
                }, enabled = valid && draft != initialDraft, modifier = Modifier.fillMaxWidth())
            }
            page == "edit:Tên pháp lý" -> sectionItem {
                Text(if (state.demoPreview) MockPersonalInfo.value(state.backendUserId, "Tên pháp lý") else "Chưa cung cấp")
                Text("Tên pháp lý không thể chỉnh sửa tại đây.")
            }
            page == "identity" -> sectionItem {
                Text("Bảo vệ danh tính của bạn", style = MaterialTheme.typography.titleMedium)
                Text("Xác minh danh tính giúp tăng độ tin cậy khi sử dụng dịch vụ cho thuê.")
                TroOiButton("Bắt đầu xác minh", { boundary = "Hiện chưa thể gửi yêu cầu xác minh. Vui lòng thử lại sau." }, modifier = Modifier.fillMaxWidth())
            }
            page == "security" -> {
                sectionItem {
                    SettingsOverviewIntro(
                        "Bảo vệ tài khoản",
                        "Quản lý phương thức đăng nhập và bảo vệ quyền truy cập của bạn.",
                    )
                }
                sectionItem {
                    SettingsGroup("Phương thức bảo mật") {
                        SettingsNavRow(Icons.Rounded.Lock, "Mã PIN bảo mật", "Xác thực các thao tác nhạy cảm", { open("pin") })
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        SettingsNavRow(Icons.Rounded.Password, "Mật khẩu", "Tạo hoặc thay đổi mật khẩu", { open("password") })
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        SettingsNavRow(Icons.Rounded.Email, "Email đăng nhập", state.email ?: "Chưa có email được cung cấp", { open("login-email") })
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        SettingsNavRow(Icons.Rounded.Link, "Tài khoản liên kết", "Quản lý phương thức đăng nhập", { open("google") })
                    }
                }
            }
            page == "password" -> sectionItem { PasswordForm(state.backendUserId, state.demoPreview, retry, { retry = it }, onDirty = { passwordDirty = it }, onSubmit = { boundary = title }, onRecovery = { recovery = true }) }
            page == "pin" -> sectionItem {
                PinForm(configured = when (method) { ReauthenticationMethod.PIN -> true; ReauthenticationMethod.UNKNOWN -> null; else -> false },
                    onStartEditing = { start -> protect(start) }, onDirty = { passwordDirty = it }, onSubmit = { boundary = title }, onRecovery = { recovery = true })
            }
            page == "login-email" -> sectionItem {
                TroOiInformationRow("Email đăng nhập", state.email ?: "Chưa cung cấp")
                Text("Đổi email đăng nhập cần xác thực lại, OTP cho hộp thư mới và kiểm tra trùng tài khoản.")
                TroOiButton("Thay đổi email", { boundary = "Không thể thay đổi email đăng nhập lúc này. Vui lòng thử lại sau." },
                    modifier = Modifier.fillMaxWidth(), style = TroOiButtonStyle.SECONDARY)
            }
            page == "google" -> sectionItem {
                Text("Google · Chưa thể kiểm tra trạng thái liên kết")
                TroOiButton("Liên kết Google", { protect() }, modifier = Modifier.fillMaxWidth(), style = TroOiButtonStyle.SECONDARY)
                TroOiButton("Ngắt liên kết", { protect() }, style = TroOiButtonStyle.TERTIARY)
            }
            page == "privacy" -> {
                sectionItem { SettingsPreviewNotice("Quyền riêng tư của bạn được bảo vệ theo chính sách TrọƠi.") }
                sectionItem { TroOiListRow("Chế độ hiển thị hồ sơ", visibility, { open("visibility") }) }
                if (!canEdit) sectionItem { TroOiButton("Chỉnh sửa", { protect { editGrant = page } }, modifier = Modifier.fillMaxWidth()) }
                sectionItem { PreviewSwitch("Đã đọc tin nhắn", "Cho người gửi biết khi bạn đã đọc tin nhắn", receipts, enabled = canEdit) { receipts = it } }
                if (state.access.operatedOrganizationIds.isNotEmpty()) sectionItem { PreviewSwitch("Bài đăng xuất hiện trong kết quả tìm kiếm", "Cho phép tìm thấy bài đăng công khai của bạn", listingSearch, enabled = canEdit) { listingSearch = it } }
                sectionItem { PreviewSwitch("Hiển thị khu vực thuê công khai", "Không bao gồm địa chỉ chính xác, số điện thoại hay dữ liệu thanh toán", publicArea, enabled = canEdit) { publicArea = it } }
                sectionItem { TroOiListRow("Xóa tài khoản của tôi", "Xem hậu quả và xác nhận yêu cầu", { open("delete") }) }
                sectionItem { TroOiButton("Lưu lựa chọn", { boundary = title }, enabled = canEdit, modifier = Modifier.fillMaxWidth()) }
            }
            page == "visibility" -> {
                listOf("Chỉ mình tôi", "Thành viên có liên hệ thuê trọ").forEach { option -> sectionItem {
                    Row(Modifier.fillMaxWidth().selectable(visibility == option, role = Role.RadioButton) { visibility = option }.heightIn(min = 56.dp), verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(visibility == option, null); Text(option, Modifier.weight(1f))
                    }
                } }
                sectionItem { Text("Chỉ áp dụng cho thông tin hồ sơ được phép công khai.") }
                sectionItem { TroOiButton("Lưu lựa chọn", { boundary = title }, enabled = canEdit, modifier = Modifier.fillMaxWidth()) }
            }
            page == "delete" -> sectionItem {
                Text("Trước khi yêu cầu xóa", style = MaterialTheme.typography.titleMedium)
                Text("Bạn có thể mất quyền đăng nhập và truy cập tài khoản. Hồ sơ thuê, giao dịch và biên nhận có thể cần được lưu giữ theo chính sách.")
                Text("Yêu cầu cần xác minh danh tính và kiểm tra nghĩa vụ đang tồn tại.")
                TroOiButton("Yêu cầu xóa tài khoản", { confirmation = true }, modifier = Modifier.fillMaxWidth(), style = TroOiButtonStyle.DESTRUCTIVE)
            }
            page == "notifications" -> {
                sectionItem { SettingsPreviewNotice("Chọn những thông báo bạn muốn theo dõi.") }
                sectionItem { TabRow(tab) { listOf("Ưu đãi và cập nhật", "Tài khoản").forEachIndexed { index, label -> Tab(tab == index, { tab = index }, text = { Text(label) }) } } }
                if (tab == 0) {
                    listOf("Ưu đãi", "Cập nhật ứng dụng", "Nhắc việc thuê trọ", "Tin tức dịch vụ", "Phản hồi").forEach { label -> sectionItem { TroOiListRow(label, if (label in channelApps.split(',') || label in channelEmails.split(',')) "Kênh nhận thông báo" else "Đã tắt", { open("channel:$label") }, "Chỉnh sửa") } }
                    sectionItem { TroOiButton("Ngừng nhận tất cả ưu đãi và cập nhật", { protect() }, style = TroOiButtonStyle.TERTIARY); Text("Chỉ marketing. Cảnh báo bảo mật và giao dịch vẫn được giữ.") }
                } else {
                    operationalNotificationGroups.forEach { label -> sectionItem { TroOiListRow(label, "Thông báo vận hành · không thuộc marketing", { open("channel:$label") }, "Chỉnh sửa") } }
                }
                sectionItem { TroOiListRow("Quyền thông báo trên thiết bị", "Mở cài đặt Android để kiểm tra quyền", {
                    try { context.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)) }
                    catch (_: ActivityNotFoundException) { boundary = "Thiết bị không hỗ trợ mở cài đặt thông báo trực tiếp. Vào Cài đặt Android → Ứng dụng → TrọƠi → Thông báo." }
                }) }
            }
            page.startsWith("channel:") -> sectionItem {
                Text("Chọn nơi bạn muốn nhận thông báo.")
                val channel = page.removePrefix("channel:")
                val critical = channel in operationalNotificationGroups
                PreviewSwitch("Trong ứng dụng", if (critical) "Thông báo quan trọng được giữ bật" else "Nhận nội dung qua ứng dụng", channel in channelApps.split(',') || critical, enabled = !critical) { checked ->
                    channelApps = (channelApps.split(',').filter { it.isNotBlank() && it != channel } + if (checked) listOf(channel) else emptyList()).joinToString(",")
                }
                PreviewSwitch("Email", "Nhận thông báo qua email", channel in channelEmails.split(',')) { checked ->
                    channelEmails = (channelEmails.split(',').filter { it.isNotBlank() && it != channel } + if (checked) listOf(channel) else emptyList()).joinToString(",")
                }
                TroOiButton("Lưu lựa chọn", { boundary = title }, enabled = canEdit, modifier = Modifier.fillMaxWidth())
            }
            page == "payments" -> {
                if (state.access.linkedTenancyIds.isNotEmpty()) {
                    sectionItem { TroOiListRow("Phương thức thanh toán", "Quản lý phương thức của bạn", { open("method") }) }
                    sectionItem { TroOiListRow("Các khoản thanh toán của bạn", "Xem các khoản đã thanh toán", { open("paid") }) }
                }
                if (state.access.operatedOrganizationIds.isNotEmpty()) {
                    sectionItem { TroOiListRow("Phương thức nhận tiền", "Quản lý phương thức nhận tiền", { open("payout") }) }
                    sectionItem { TroOiListRow("Lịch sử giao dịch / biên nhận", "Xem giao dịch và biên nhận", { open("transactions") }) }
                }
                if (state.access.linkedTenancyIds.isEmpty() && state.access.operatedOrganizationIds.isEmpty()) sectionItem { Text("Chưa có lượt thuê liên kết hoặc quyền vận hành. Các phương thức và giao dịch sẽ xuất hiện khi tài khoản có quyền phù hợp.") }
            }
            page == "method" || page == "payout" -> sectionItem {
                Text("Bạn chưa có ${title.lowercase()}.")
                TroOiButton("Thêm phương thức", { open("edit:$title") }, modifier = Modifier.fillMaxWidth())
            }
            page == "transactions" -> {
                sectionItem { TroOiListRow("Lịch sử giao dịch", "Giao dịch của không gian vận hành", { open("operator-transactions") }) }
                sectionItem { TroOiListRow("Biên nhận", "Chứng từ đã phát hành", { open("operator-receipts") }) }
            }
            page == "paid" -> {
                val rows = state.access.linkedTenancyIds.sorted().flatMap { tenancyId ->
                    state.read.tenantFinanceByTenancy[tenancyId]?.payments.orEmpty().map { tenancyId to it }
                }.distinctBy { it.second.paymentId }
                sectionItem {
                    Text("Các khoản thanh toán của bạn", style = MaterialTheme.typography.titleMedium)
                    if (rows.isEmpty()) Text("Chưa có Payment được tải từ các lượt thuê liên kết.")
                    rows.forEach { (tenancyId, payment) ->
                        TroOiInformationRow("Payment ${payment.paymentId.take(8)} · ${tenancyId.take(8)}",
                            payment.amountLabel, status = payment.confirmationLabel ?: "Chưa xác nhận")
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    }
                    TroOiListRow("Biên nhận tiền thuê", "Xem Receipt tương ứng", { open("tenant-receipts") })
                }
            }
            page == "tenant-receipts" -> {
                val rows = state.access.linkedTenancyIds.sorted().flatMap { tenancyId ->
                    state.read.tenantFinanceByTenancy[tenancyId]?.receipts.orEmpty()
                }.distinctBy { it.receiptId }
                sectionItem {
                    if (rows.isEmpty()) Text("Chưa có biên nhận được phát hành cho lượt thuê này.")
                    rows.forEach { TroOiInformationRow("Receipt ${it.receiptId.take(8)}", it.issuedAtLabel) }
                }
            }
            page == "operator-transactions" -> {
                val rows = state.access.operatedOrganizationIds.sorted().flatMap { orgId ->
                    state.read.operatorFinanceByOrganization[orgId]?.confirmedPayments.orEmpty()
                }.distinctBy { it.paymentId }
                sectionItem {
                    if (rows.isEmpty()) Text("Chưa có giao dịch được tải theo quyền quản lý.")
                    rows.forEach { payment ->
                        TroOiInformationRow("Payment ${payment.paymentId.take(8)}",
                            payment.amountLabel, status = payment.confirmationLabel ?: "Chưa xác nhận")
                    }
                }
            }
            page == "operator-receipts" -> {
                val rows = state.access.operatedOrganizationIds.sorted().flatMap { orgId ->
                    state.read.operatorFinanceByOrganization[orgId]?.receipts.orEmpty()
                }.distinctBy { it.receiptId }
                sectionItem {
                    if (rows.isEmpty()) Text("Chưa có biên nhận được tải theo quyền quản lý.")
                    rows.forEach { TroOiInformationRow("Receipt ${it.receiptId.take(8)}", it.issuedAtLabel) }
                }
            }
            page == "language" -> {
                sectionItem { TroOiListRow("Ngôn ngữ ứng dụng", "Tiếng Việt", {
                    val intent = if (Build.VERSION.SDK_INT >= 33) Intent(Settings.ACTION_APP_LOCALE_SETTINGS, Uri.parse("package:${context.packageName}")) else Intent(Settings.ACTION_LOCALE_SETTINGS)
                    try { context.startActivity(intent) } catch (_: ActivityNotFoundException) { boundary = "Mở Cài đặt Android → Ngôn ngữ để chỉnh sửa. Thiết bị chưa hỗ trợ đường dẫn trực tiếp." }
                }, "Chỉnh sửa trong phần cài đặt của thiết bị") }
                sectionItem { PreviewSwitch("Dịch tự động", "Dịch nội dung sang ngôn ngữ ứng dụng", false) { boundary = "Dịch tự động" } }
            }
            page == "help" -> {
                sectionItem {
                    Text("Bạn cần trợ giúp về điều gì?", style = MaterialTheme.typography.titleMedium)
                }
                profileCatalog?.help.orEmpty().forEach { topic -> sectionItem {
                    TroOiListRow(topic.title, topic.summary, { open("help:${topic.id}") })
                } }
                sectionItem { TroOiListRow("Liên hệ hỗ trợ", "Gửi câu hỏi cho TrọƠi", { open("contact") }) }
            }
            page.startsWith("help:") -> {
                val topic = profileCatalog?.help?.firstOrNull { it.id == page.removePrefix("help:") }
                if (topic != null) {
                    topic.paragraphs.forEach { paragraph -> sectionItem {
                        Text(paragraph, style = MaterialTheme.typography.bodyLarge)
                    } }
                } else sectionItem { Text("Không mở được hướng dẫn. Vui lòng thử lại.") }
            }
            page == "contact" -> sectionItem {
                Text("Không gửi giấy tờ, mật khẩu, OTP hoặc thông tin thanh toán nhạy cảm trong nội dung hỗ trợ.")
                TroOiFormField(draft, { draft = it.take(1000) }, label = { Text("Nội dung cần hỗ trợ") }, modifier = Modifier.fillMaxWidth(), minLines = 4)
                TroOiButton("Gửi yêu cầu", { boundary = "Chưa thể gửi yêu cầu hỗ trợ. Nội dung của bạn chưa được gửi." }, enabled = draft.trim().length >= 10, modifier = Modifier.fillMaxWidth())
            }
            page == "host" -> sectionItem {
                Text("Vận hành phòng trọ với TrọƠi", style = MaterialTheme.typography.titleMedium)
                Text("Quản lý phòng trọ, theo dõi lượt thuê, khoản phải thu và sự cố trong không gian được cấp quyền.")
                if (state.access.operatedOrganizationIds.isNotEmpty()) {
                    TroOiButton("Mở không gian Chủ trọ", onOpenOperatorWorkspace,
                        modifier = Modifier.fillMaxWidth())
                } else {
                    Text("Thiết lập hồ sơ chủ trọ và quản lý khu nhà, phòng cho thuê trong cùng một không gian.")
                    TroOiButton("Bắt đầu đăng ký chủ trọ", onStartLandlordOnboarding,
                        modifier = Modifier.fillMaxWidth())
                }
            }
            page == "legal" -> {
                sectionItem {
                    Text("Điều khoản và chính sách áp dụng khi sử dụng TrọƠi.",
                        style = MaterialTheme.typography.bodyMedium)
                }
                profileCatalog?.legal.orEmpty().forEach { document -> sectionItem {
                    TroOiListRow(document.title, "Đọc toàn bộ nội dung", { open(document.route) })
                } }
            }
            page.startsWith("legal:") -> {
                LegalDocumentType.fromRoute(page)?.let { document ->
                    sectionItem { LegalDocumentContent(document) }
                }
            }
        }
    }
    }
    }
}
}

@Composable
private fun PersonalDetailRow(label: String, value: String, action: String?,
    onClick: (() -> Unit)?, modifier: Modifier = Modifier) {
    Row(
        modifier.fillMaxWidth().heightIn(min = 74.dp).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.bodyLarge)
        }
        if (action != null && onClick != null) {
            TextButton(onClick = onClick, modifier = Modifier.heightIn(min = 48.dp)) {
                Text(action)
                Spacer(Modifier.width(3.dp))
                Icon(Icons.Rounded.Edit, null, Modifier.size(15.dp))
            }
        }
    }
}

@Composable
private fun IdentityVerificationEntry(onClick: () -> Unit, modifier: Modifier = Modifier) {
    Surface(
        onClick = onClick, modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.primaryContainer,
        shape = MaterialTheme.shapes.extraLarge,
    ) {
        Row(Modifier.fillMaxWidth().padding(18.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Surface(shape = MaterialTheme.shapes.medium, color = MaterialTheme.colorScheme.surface) {
                Icon(Icons.Rounded.VerifiedUser, null, Modifier.padding(12.dp).size(27.dp),
                    tint = MaterialTheme.colorScheme.primary)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text("Xác minh danh tính", style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer)
                Text("Chưa xác minh · Bảo vệ tài khoản và giao dịch",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("Xem thông tin", style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary)
            }
            Icon(Icons.Rounded.ChevronRight, "Xem thông tin",
                tint = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun SettingsNavRow(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    Surface(onClick = onClick, modifier = Modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.surface) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 70.dp).padding(horizontal = 16.dp, vertical = 13.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Icon(icon, null, modifier = Modifier.size(22.dp), tint = MaterialTheme.colorScheme.primary)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, style = MaterialTheme.typography.titleSmall)
                Text(subtitle, style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Icon(Icons.Rounded.ChevronRight, null, modifier = Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun SettingsPreviewNotice(message: String) {
    Surface(shape = MaterialTheme.shapes.medium, color = MaterialTheme.colorScheme.surfaceVariant) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(Icons.Rounded.Info, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.primary)
            Text(message, style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun SettingsOverviewIntro(title: String, description: String) {
    Surface(shape = MaterialTheme.shapes.extraLarge, color = MaterialTheme.colorScheme.primaryContainer) {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onPrimaryContainer)
            Text(description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun SettingsGroup(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface) {
            Column(content = content)
        }
    }
}

private fun LazyListScope.sectionItem(content: @Composable ColumnScope.() -> Unit) {
    item { Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp), content = content) }
}

@Composable
private fun PreviewSwitch(title: String, subtitle: String, checked: Boolean, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp).toggleable(checked, enabled = enabled, role = Role.Switch, onValueChange = onChange).heightIn(min = 64.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f)) { Text(title, style = MaterialTheme.typography.titleSmall); Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        Switch(checked, null, enabled = enabled, colors = SwitchDefaults.colors(
            checkedTrackColor = MaterialTheme.colorScheme.primary,
            checkedThumbColor = MaterialTheme.colorScheme.onPrimary,
            uncheckedTrackColor = MaterialTheme.colorScheme.surfaceVariant,
            uncheckedThumbColor = MaterialTheme.colorScheme.onSurfaceVariant,
            uncheckedBorderColor = MaterialTheme.colorScheme.outline,
        ))
    }
    }
}
