package com.trooi.app.features.profile

import com.trooi.app.ui.components.TroOiPage
import com.trooi.app.ui.components.TroOiListRow
import com.trooi.app.ui.components.TroOiPageHeader
import com.trooi.app.ui.components.TroOiScreenScaffold

import com.trooi.app.ui.components.TroOiConfirmDialog
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.automirrored.rounded.HelpOutline
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.core.model.LocalLandlordApplication
import com.trooi.app.features.messages.prepareMessagePhoto
import kotlinx.coroutines.launch

@Composable
fun ProfileScreen(
    state: TroOiUiState,
    googleOnly: Boolean = false,
    onLogin: () -> Unit = {},
    onSignUp: () -> Unit = {},
    onDiscovery: () -> Unit = {},
    onContextSwitcher: () -> Unit = {},
    onNotifications: () -> Unit = {},
    onSettings: () -> Unit = {},
    onHelp: () -> Unit = {},
    onPrivacy: (() -> Unit)? = null,
    onLogout: () -> Unit = {},
    onSaveDisplayName: suspend (String) -> Result<Unit> = { Result.failure(IllegalStateException(PROFILE_UNSUPPORTED_MESSAGE)) },
    onUploadAvatar: (suspend (String, ByteArray) -> Result<Unit>)? = null,
    onCompleteLandlord: suspend (LocalLandlordApplication) -> Result<Unit> = { Result.failure(IllegalStateException(PROFILE_UNSUPPORTED_MESSAGE)) },
    onOpenWorkspace: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    if (!state.isAuthenticated) return
    val presentation = profilePresentation(state)
    var onboarding by remember(state.backendUserId) { mutableStateOf(false) }
    var detail by rememberSaveable(state.backendUserId) { mutableStateOf<String?>(null) }
    var section by rememberSaveable(state.backendUserId) { mutableStateOf<String?>(null) }
    var logoutConfirmation by rememberSaveable { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val avatarPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null && onUploadAvatar != null) scope.launch {
            val outcome = runCatching {
                val photo = prepareMessagePhoto(context, uri)
                onUploadAvatar("image/jpeg", photo.bytes).getOrThrow()
            }
            snackbar.showSnackbar(outcome.fold(
                onSuccess = { "Đã cập nhật ảnh hồ sơ." },
                onFailure = { it.message ?: "Không thể cập nhật ảnh hồ sơ." },
            ))
        }
    }
    val avatarAction: (@Composable () -> Unit)? = if (onUploadAvatar == null) null else {
        {
            Button(
                onClick = { avatarPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                enabled = !state.profileAvatarUploading,
                modifier = Modifier.testTag("profile-avatar-change"),
            ) {
                if (state.profileAvatarUploading) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                else Text("Đổi ảnh đại diện")
            }
        }
    }
    section?.let { initial ->
        Dialog(onDismissRequest = { section = null }, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
            TroOiPage(Modifier.fillMaxSize().safeDrawingPadding()) {
                AccountSettingsFlow(state, { section = null }, initial, onSaveDisplayName = onSaveDisplayName,
                    avatarAction = avatarAction,
                    onOpenOperatorWorkspace = onOpenWorkspace, onStartLandlordOnboarding = {
                        section = null
                        onboarding = true
                    })
            }
        }
    }
    if (logoutConfirmation) TroOiConfirmDialog(
        onDismissRequest = { logoutConfirmation = false },
        title = "Đăng xuất?",
        text = "Phiên đăng nhập trên thiết bị này sẽ được xóa. Bạn có thể đăng nhập lại bất cứ lúc nào.",
        confirmLabel = "Đăng xuất", onConfirm = { logoutConfirmation = false; onLogout() }, destructive = true,
    )
    val landlordAction: () -> Unit = {
        when (presentation.landlordEntry) {
            LandlordEntry.ONBOARDING -> onboarding = true
            LandlordEntry.REAL_OPERATIONS -> onOpenWorkspace()
        }
    }
    if (onboarding) LandlordOnboardingScreen(presentation.name, { onboarding = false }, {
        onboarding = false
        onOpenWorkspace()
    }, onCompleteLandlord, backendVerification = googleOnly)
    detail?.let { title -> ProfileDetail(title, { detail = null }) {
        if (title == "Xem hồ sơ") {
            item {
                Text(presentation.name, style = MaterialTheme.typography.titleLarge)
                Text(profileContextLabel(state), color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(24.dp))
                Text("Thông tin tài khoản", style = MaterialTheme.typography.titleMedium)
                Text("Tài khoản của bạn được dùng để theo dõi tài sản, thanh toán và lịch sử thuê.", Modifier.padding(top = 12.dp))
            }
        } else {
            if (state.read.rentalHistory.isEmpty()) item {
                Text("Chưa có lịch sử thuê", style = MaterialTheme.typography.titleMedium)
                Text("Các tài sản đã kết thúc thuê sẽ xuất hiện tại đây.", Modifier.padding(top = 8.dp))
            }
            state.read.rentalHistory.forEach { history -> item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    history.photoResources.firstOrNull()?.let { Image(painterResource(it), history.title,
                        Modifier.fillMaxWidth().height(190.dp).clip(RoundedCornerShape(16.dp)), contentScale = ContentScale.Crop) }
                    Text(history.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    Text(history.publicArea, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(history.period, style = MaterialTheme.typography.bodyMedium)
                        Text(history.endedState, style = MaterialTheme.typography.labelLarge)
                    }
                }
            } }
        }
    } }
    TroOiScreenScaffold(snackbarHost = { SnackbarHost(snackbar) }) { insets ->
        Box(Modifier.fillMaxSize().padding(insets), contentAlignment = Alignment.TopCenter) {
            LazyColumn(
                modifier.widthIn(max = 720.dp).fillMaxSize().testTag("profile-scroll"),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                item {
                    TroOiPageHeader("Hồ sơ", subtitle = "Thông tin và cài đặt của bạn", actions = {
                        IconButton(onNotifications, Modifier.testTag("profile-notification-bell")) {
                            Icon(Icons.Rounded.NotificationsNone, "Thông báo")
                        }
                    })
                }
                item {
                    Surface(
                        onClick = { section = "personal" },
                        shape = RoundedCornerShape(20.dp),
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.fillMaxWidth().testTag("profile-hero-edit"),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 18.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                        ) {
                            ProfileAvatar(state.pictureUrl, presentation.name.take(1), 64.dp, state.profileAvatarBytes)
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("TÀI KHOẢN CỦA TÔI", style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.80f))
                                Text(presentation.name, style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimary,
                                    maxLines = 2)
                                Text(profileContextLabel(state), style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.88f))
                            }
                            Icon(Icons.Rounded.ChevronRight, "Quản lý hồ sơ",
                                tint = MaterialTheme.colorScheme.onPrimary)
                        }
                    }
                }
                item { ProfileSectionLabel("Tài khoản", "Danh tính, bảo mật và thiết lập") }
                item {
                    ProfileMenuGroup {
                        ActionRow(Icons.Rounded.PersonOutline, "Xem hồ sơ", { section = "personal" },
                            Modifier.testTag("profile-personal"), subtitle = "Thông tin cá nhân và xác minh")
                        ProfileRowDivider()
                        ActionRow(Icons.Rounded.Settings, "Cài đặt tài khoản", onSettings,
                            Modifier.testTag("account-settings"), subtitle = "Bảo mật, thông báo và thanh toán")
                    }
                }
                item { ProfileSectionLabel("Hoạt động của bạn", "Liên kết với tài khoản đang đăng nhập") }
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        ProfileShortcut("Lịch sử thuê", Icons.Rounded.Luggage,
                            { detail = "Lịch sử thuê" }, Modifier.weight(1f).testTag("profile-history"))
                        ProfileShortcut("Kết nối", Icons.Rounded.Groups,
                            { scope.launch { snackbar.showSnackbar(PROFILE_CONNECTIONS_MESSAGE) } },
                            Modifier.weight(1f).testTag("profile-connections"), "Danh sách liên hệ")
                    }
                }
                item {
                    Surface(
                        onClick = landlordAction, shape = RoundedCornerShape(18.dp),
                        color = MaterialTheme.colorScheme.primaryContainer,
                        modifier = Modifier.fillMaxWidth().testTag("profile-landlord-cta"),
                    ) {
                        Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface) {
                                Icon(Icons.Rounded.HomeWork, null, Modifier.padding(12.dp).size(26.dp),
                                    tint = MaterialTheme.colorScheme.primary)
                            }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(presentation.landlordTitle, style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold)
                                Text(if (presentation.operatorDefault) "Mở không gian và tài sản đang quản lý"
                                    else "Tạo không gian vận hành tài sản đầu tiên",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Icon(Icons.AutoMirrored.Rounded.ArrowForward, "Mở", tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
                item { ProfileSectionLabel("Thông tin & hỗ trợ") }
                item {
                    ProfileMenuGroup {
                        ActionRow(Icons.Rounded.Shield, "Quyền riêng tư & Pháp lý",
                            { section = "privacy-legal" }, Modifier.testTag("privacy-legal"),
                            subtitle = "Quyền dữ liệu và điều khoản sử dụng")
                        ProfileRowDivider()
                        ActionRow(Icons.Rounded.HomeWork, "Giới thiệu chủ nhà",
                            { section = "host" }, Modifier.testTag("profile-host"),
                            subtitle = "Tìm hiểu quản lý cho thuê")
                        ProfileRowDivider()
                        ActionRow(Icons.AutoMirrored.Rounded.HelpOutline, "Nhận trợ giúp",
                            onHelp, Modifier.testTag("account-help"), subtitle = "Hướng dẫn và liên hệ hỗ trợ")
                    }
                }
                item {
                    ProfileMenuGroup {
                        if (state.isAuthenticated) ActionRow(Icons.AutoMirrored.Rounded.Logout, "Đăng xuất",
                            { logoutConfirmation = true }, Modifier.testTag("account-logout"),
                            subtitle = "Kết thúc phiên trên thiết bị", isDestructive = true)
                    }
                }
                item {
                    Text("TrọƠi · Sổ vận hành thuê trọ", style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun ProfileSectionLabel(title: String, subtitle: String = "") {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        if (subtitle.isNotBlank()) Text(subtitle, style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun ProfileShortcut(title: String, icon: ImageVector, onClick: () -> Unit,
    modifier: Modifier, hint: String = "Xem chi tiết") {
    Surface(onClick = onClick, modifier = modifier.heightIn(min = 92.dp),
        shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Icon(icon, null, Modifier.size(23.dp), tint = MaterialTheme.colorScheme.primary)
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text(hint, style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun ProfileMenuGroup(content: @Composable ColumnScope.() -> Unit) {
    Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface) {
        Column(content = content)
    }
}

@Composable
private fun ProfileRowDivider() {
    HorizontalDivider(Modifier.padding(start = 52.dp, end = 16.dp),
        color = MaterialTheme.colorScheme.outlineVariant)
}

@Composable
private fun ActionRow(icon: ImageVector, title: String, onClick: () -> Unit,
    modifier: Modifier = Modifier, subtitle: String = "", isDestructive: Boolean = false) {
    val colors = MaterialTheme.colorScheme
    Surface(onClick = onClick, modifier = modifier.fillMaxWidth(), color = colors.surface) {
        Row(Modifier.fillMaxWidth().heightIn(min = 66.dp).padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Icon(icon, null, Modifier.size(22.dp),
                tint = if (isDestructive) colors.error else colors.primary)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, style = MaterialTheme.typography.titleSmall,
                    color = if (isDestructive) colors.error else colors.onSurface)
                if (subtitle.isNotBlank()) Text(subtitle, style = MaterialTheme.typography.bodySmall,
                    color = colors.onSurfaceVariant)
            }
            if (!isDestructive) Icon(Icons.Rounded.ChevronRight, null, Modifier.size(19.dp),
                tint = colors.onSurfaceVariant)
        }
    }
}

@Composable
private fun ProfileDetail(title: String, onBack: () -> Unit, content: androidx.compose.foundation.lazy.LazyListScope.() -> Unit) {
    Dialog(onDismissRequest = onBack, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        BackHandler(onBack = onBack)
        TroOiPage(Modifier.fillMaxSize().safeDrawingPadding()) {
            LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                item { TroOiPageHeader(title, onBack = onBack) }
                content()
            }
        }
    }
}
