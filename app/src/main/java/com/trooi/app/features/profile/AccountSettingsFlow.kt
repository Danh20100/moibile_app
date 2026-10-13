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
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material3.*
import com.trooi.app.ui.components.TroOiFormField
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.features.auth.isValidIdentifier
import com.trooi.app.features.auth.isValidEmail
import com.trooi.app.features.auth.EmailOtpPanel
import com.trooi.app.features.auth.rememberContactOtpForm
import com.trooi.app.ui.components.TroOiButton

private val settingsPages = linkedMapOf(
    "personal" to "Thông tin cá nhân", "security" to "Đăng nhập và bảo mật",
    "privacy" to "Quyền riêng tư", "notifications" to "Thông báo",
    "payments" to "Thanh toán và chi trả", "language" to "Ngôn ngữ và bản dịch",
)
private val operationalNotificationGroups = listOf("Bảo mật và xác thực", "Công nợ và biên nhận", "Sự cố và hoạt động thuê trọ")

fun marketingOptOutChannels(channels: String): String = channels.split(',').filter { it in operationalNotificationGroups }.joinToString(",")

private val personalFields = listOf("Tên pháp lý", "Số điện thoại", "Email", "Địa chỉ cư trú")

fun personalInputValid(label: String, value: String): Boolean = when (label) {
    "Tên pháp lý" -> false
    "Số điện thoại" -> !value.contains('@') && isValidIdentifier(value)
    "Email" -> isValidEmail(value)
    else -> value.trim().length >= 5
}

/** Preview drafts never mutate account, payment or privacy records. Both privacy entries use this flow. */
@Composable
fun AccountSettingsFlow(state: TroOiUiState, onBack: () -> Unit, initialPage: String = "settings") {
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
    val initialDraft = if (state.demoPreview) MockPersonalInfo.value(state.backendUserId, page.removePrefix("edit:")) else ""
    var draft by rememberSaveable(state.backendUserId, page) { mutableStateOf(initialDraft) }
    var passwordDirty by rememberSaveable(page) { mutableStateOf(false) }
    var discard by rememberSaveable(page) { mutableStateOf(false) }
    val preferences = arrayListOf(visibility, receipts.toString(), listingSearch.toString(), publicArea.toString(), channelApps, channelEmails)
    val preferenceForm = page in listOf("privacy", "visibility") || page.startsWith("channel:")
    val preferenceBaselines = rememberSaveable(state.backendUserId) { hashMapOf<String, ArrayList<String>>() }
    val originalPreferences = if (preferenceForm) preferenceBaselines.getOrPut(page) { preferences } else preferences
    val dirty = (preferenceForm && preferences != originalPreferences) || ((page.startsWith("edit:") || page == "contact") && draft != initialDraft) || (page in listOf("password", "pin") && passwordDirty)
    fun requestBack() { if (dirty) discard = true else { preferenceBaselines.remove(page); back() } }
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
    val expanded = LocalConfiguration.current.screenWidthDp >= 600
    val title = settingsPages[page] ?: when {
        page.startsWith("help:") -> page.removePrefix("help:")
        page == "settings" -> "Cài đặt tài khoản"
        page.startsWith("edit:") -> page.removePrefix("edit:")
        page.startsWith("channel:") -> page.removePrefix("channel:")
        else -> mapOf("visibility" to "Chế độ hiển thị hồ sơ", "delete" to "Xóa tài khoản của tôi",
            "identity" to "Xác minh danh tính", "password" to "Mật khẩu", "pin" to "Mã PIN bảo mật",
            "google" to "Tài khoản liên kết", "method" to "Phương thức thanh toán", "paid" to "Các khoản thanh toán của bạn",
            "payout" to "Phương thức nhận tiền", "transactions" to "Lịch sử giao dịch / biên nhận",
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
        onDismissRequest = { boundary = null }, title = "Hiện chưa khả dụng",
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
            page == "settings" -> if (expanded) settingsPages.entries.chunked(2).forEach { pair -> sectionItem {
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) { pair.forEach { (key, label) -> Box(Modifier.weight(1f)) { TroOiListRow(label, "", { open(key) }) } } }
            } } else settingsPages.forEach { (key, label) -> sectionItem { TroOiListRow(label, "", { open(key) }) } }
            page == "personal" -> {
                sectionItem {
                    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface) {
                        Column {
                            personalFields.forEach { label ->
                                val value = if (state.demoPreview) MockPersonalInfo.value(state.backendUserId, label) else ""
                                val action = when (label) { "Số điện thoại", "Email" -> "Thay đổi"; "Địa chỉ cư trú" -> "Chỉnh sửa"; else -> "" }
                                TroOiInformationRow(label, value.ifBlank { "Chưa cung cấp" },
                                    action = action,
                                    status = if (label == "Địa chỉ cư trú") "Chưa xác minh" else "",
                                    onClick = if (label == "Tên pháp lý") null else { { open("edit:$label") } },
                                    actionModifier = Modifier.semantics { contentDescription = "$action $label" }.testTag("personal-action-$label"))
                                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                            }
                            TroOiInformationRow("Xác minh danh tính", "Chưa xác minh", "Xem chi tiết", onClick = { open("identity") },
                                actionModifier = Modifier.semantics { contentDescription = "Xem chi tiết Xác minh danh tính" }.testTag("personal-action-Xác minh danh tính"))
                        }
                    }
                }
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
                Text("Xác minh để bảo vệ tài khoản", style = MaterialTheme.typography.titleMedium)
                Text("Kiểm tra danh tính giúp bảo vệ thông tin và quyền truy cập tài khoản của bạn.")
                TroOiButton("Bắt đầu xác minh", { boundary = "Bắt đầu xác minh cần API KYC, nhà cung cấp và chính sách xử lý giấy tờ. Chưa thu thập hay xác minh danh tính." }, modifier = Modifier.fillMaxWidth())
            }
            page == "security" -> {
                sectionItem { TroOiListRow("Mã PIN bảo mật", "Xác thực các thao tác nhạy cảm", { open("pin") }) }
                sectionItem { TroOiListRow("Mật khẩu", "Tạo hoặc thay đổi mật khẩu", { open("password") }) }
                sectionItem { TroOiListRow("Tài khoản liên kết", "Quản lý phương thức đăng nhập", { open("google") }) }
            }
            page == "password" -> sectionItem { PasswordForm(state.backendUserId, state.demoPreview, retry, { retry = it }, onDirty = { passwordDirty = it }, onSubmit = { boundary = title }, onRecovery = { recovery = true }) }
            page == "pin" -> sectionItem {
                PinForm(configured = when (method) { ReauthenticationMethod.PIN -> true; ReauthenticationMethod.UNKNOWN -> null; else -> false },
                    onStartEditing = { start -> protect(start) }, onDirty = { passwordDirty = it }, onSubmit = { boundary = title }, onRecovery = { recovery = true })
            }
            page == "google" -> sectionItem {
                Text("Google · Chưa thể kiểm tra trạng thái liên kết")
                TroOiButton("Liên kết Google", { protect() }, modifier = Modifier.fillMaxWidth(), style = TroOiButtonStyle.SECONDARY)
                TroOiButton("Ngắt liên kết", { protect() }, style = TroOiButtonStyle.TERTIARY)
            }
            page == "privacy" -> {
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
            page == "paid" || page == "transactions" -> sectionItem {
                Text("Chưa tải được nguồn giao dịch cho trang này", style = MaterialTheme.typography.titleMedium)
                Text("Khi có giao dịch, bạn có thể xem thông tin thanh toán và biên nhận tại đây.")
                TroOiButton("Tải lại", { boundary = "Tải lịch sử cần API Payment/Receipt theo context và quyền truy cập. Chưa có dữ liệu cho trang cài đặt này." }, modifier = Modifier.fillMaxWidth(), style = TroOiButtonStyle.SECONDARY)
                TroOiButton("Xem biên nhận", { boundary = "Mở biên nhận cần ID Receipt được phát hành từ confirmed Payment. Không tạo biên nhận mẫu hay bằng chứng thanh toán." }, style = TroOiButtonStyle.TERTIARY)
            }
            page == "language" -> {
                sectionItem { TroOiListRow("Ngôn ngữ ứng dụng", "Tiếng Việt", {
                    val intent = if (Build.VERSION.SDK_INT >= 33) Intent(Settings.ACTION_APP_LOCALE_SETTINGS, Uri.parse("package:${context.packageName}")) else Intent(Settings.ACTION_LOCALE_SETTINGS)
                    try { context.startActivity(intent) } catch (_: ActivityNotFoundException) { boundary = "Mở Cài đặt Android → Ngôn ngữ để chỉnh sửa. Thiết bị chưa hỗ trợ đường dẫn trực tiếp." }
                }, "Chỉnh sửa trong phần cài đặt của thiết bị") }
                sectionItem { PreviewSwitch("Dịch tự động", "Dịch nội dung sang ngôn ngữ ứng dụng", false) { boundary = "Dịch tự động" } }
            }
            page == "help" -> {
                sectionItem { Text("Bạn cần trợ giúp về điều gì?", style = MaterialTheme.typography.titleMedium) }
                listOf("Tìm phòng và liên hệ", "Quản lý lượt thuê", "Thanh toán và biên nhận", "Bảo vệ tài khoản").forEach { topic -> sectionItem {
                    TroOiListRow(topic, "Xem hướng dẫn", { open("help:$topic") })
                } }
                sectionItem { TroOiListRow("Liên hệ hỗ trợ", "Soạn nội dung yêu cầu", { open("contact") }) }
            }
            page.startsWith("help:") -> sectionItem {
                Text(when (page.removePrefix("help:")) {
                    "Tìm phòng và liên hệ" -> "Dùng vị trí và khoảng giá để tìm tin đăng công khai. Đăng nhập trước khi gửi yêu cầu liên hệ. Yêu cầu liên hệ không giữ chỗ hay tạo lượt thuê."
                    "Quản lý lượt thuê" -> "Lượt thuê được liên kết với Participant. Chọn đúng không gian để xem điều khoản, khoản phải thu và sự cố; quyền truy cập do backend xác nhận."
                    "Thanh toán và biên nhận" -> "Khoản phải thu, Payment, Claim, Deposit và Receipt là các nguồn riêng. Liên kết quay về từ cổng thanh toán không xác nhận đã trả tiền. Biên nhận được phát hành từ Payment đã xác nhận."
                    else -> "Không chia sẻ mật khẩu hoặc OTP. Đăng xuất để xóa phiên trên thiết bị. Thay đổi mật khẩu, email và phương thức đăng nhập cần API chính thức và xác thực lại."
                })
            }
            page == "contact" -> sectionItem {
                Text("Không gửi giấy tờ, mật khẩu, OTP hoặc thông tin thanh toán nhạy cảm trong nội dung hỗ trợ.")
                TroOiFormField(draft, { draft = it.take(1000) }, label = { Text("Nội dung cần hỗ trợ") }, modifier = Modifier.fillMaxWidth(), minLines = 4)
                TroOiButton("Gửi yêu cầu", { boundary = "Gửi yêu cầu hỗ trợ cần API tiếp nhận và mã theo dõi. Chưa gửi nội dung cho bất kỳ ai." }, enabled = draft.trim().length >= 10, modifier = Modifier.fillMaxWidth())
            }
            page == "host" -> sectionItem {
                Text("Vận hành phòng trọ với TrọƠi", style = MaterialTheme.typography.titleMedium)
                Text("Quản lý phòng trọ, theo dõi lượt thuê, khoản phải thu và sự cố trong không gian được cấp quyền.")
                TroOiButton("Tìm hiểu cách bắt đầu", { boundary = "Đăng ký vận hành cần API tạo/liên kết Organization và xác nhận quyền. Chưa cấp quyền chủ trọ." }, modifier = Modifier.fillMaxWidth())
            }
            page == "legal" -> {
                sectionItem {
                    Text(
                        "Tìm hiểu quyền, trách nhiệm và cách TrọƠi dự kiến bảo vệ thông tin của bạn.",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                sectionItem {
                    Text(
                        "Nội dung hiện là bản dự thảo; điều khoản chính thức sẽ có phiên bản và ngày hiệu lực sau khi được phê duyệt.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                LegalDocumentType.entries.forEach { document -> sectionItem {
                    TroOiListRow(document.title, "Đọc nội dung đầy đủ", { open(document.route) })
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
