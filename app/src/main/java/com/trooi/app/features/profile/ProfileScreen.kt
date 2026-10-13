package com.trooi.app.features.profile

import com.trooi.app.ui.components.TroOiPage
import com.trooi.app.ui.components.TroOiListRow
import com.trooi.app.ui.components.TroOiPageHeader
import com.trooi.app.ui.components.TroOiScreenScaffold

import com.trooi.app.ui.components.TroOiConfirmDialog
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.core.model.LocalLandlordApplication
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
    section?.let { initial ->
        Dialog(onDismissRequest = { section = null }, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
            TroOiPage(Modifier.fillMaxSize().safeDrawingPadding()) {
                AccountSettingsFlow(state, { section = null }, initial)
            }
        }
    }
    if (logoutConfirmation) TroOiConfirmDialog(
        onDismissRequest = { logoutConfirmation = false },
        title = "Đăng xuất?",
        text = "Phiên đăng nhập trên thiết bị này sẽ được xóa. Bạn có thể đăng nhập lại bất cứ lúc nào.",
        confirmLabel = "Đăng xuất", onConfirm = { logoutConfirmation = false; onLogout() }, destructive = true,
    )
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val landlordAction: () -> Unit = {
        when (presentation.landlordEntry) {
            LandlordEntry.ONBOARDING -> onboarding = true
            LandlordEntry.REAL_OPERATIONS -> onOpenWorkspace()
        }
    }
    if (onboarding) LandlordOnboardingScreen(presentation.name, { onboarding = false }, {
        onboarding = false
        onOpenWorkspace()
    }, onCompleteLandlord)
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
        LazyColumn(modifier.fillMaxSize().padding(insets).testTag("profile-scroll"),
            contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            item {
                TroOiPageHeader("Hồ sơ", actions = {
                    IconButton(onNotifications, Modifier.testTag("profile-notification-bell")) { Icon(Icons.Rounded.NotificationsNone, "Thông báo") }
                })
            }
            item {
                Surface(shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        ProfileAvatar(state.pictureUrl, presentation.name.take(1))
                        Text(presentation.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
                        Text(profileContextLabel(state), color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    ProfileShortcut("Lịch sử thuê", Icons.Rounded.Luggage, { detail = "Lịch sử thuê" }, Modifier.weight(1f).testTag("profile-history"))
                    ProfileShortcut("Kết nối", Icons.Rounded.Build,
                        { scope.launch { snackbar.showSnackbar(PROFILE_CONNECTIONS_MESSAGE) } }, Modifier.weight(1f).testTag("profile-connections"))
                }
            }
            item {
                Surface(onClick = landlordAction, shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.secondaryContainer,
                    modifier = Modifier.fillMaxWidth().testTag("profile-landlord-cta")) {
                    Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        Icon(Icons.Rounded.HomeWork, null, Modifier.size(30.dp))
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            Text(presentation.landlordTitle, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            Text(if (presentation.operatorDefault) "Xem tài sản đang quản lý" else "Bắt đầu với tài sản đầu tiên của bạn", style = MaterialTheme.typography.bodySmall)
                        }
                        Icon(Icons.Rounded.ChevronRight, null)
                    }
                }
            }
            item {
                ActionRow(Icons.Rounded.Settings, "Cài đặt tài khoản", onSettings, Modifier.testTag("account-settings"))
                LocalOcrEntry()
                ActionRow(Icons.Rounded.PersonOutline, "Xem hồ sơ", { detail = "Xem hồ sơ" })
                ActionRow(Icons.AutoMirrored.Rounded.HelpOutline, "Nhận trợ giúp", onHelp, Modifier.testTag("account-help"))
                ActionRow(Icons.Rounded.Shield, "Quyền riêng tư", { if (onPrivacy != null) onPrivacy() else section = "privacy" })
                ActionRow(Icons.Rounded.Description, "Pháp lý", { section = "legal" })
                ActionRow(Icons.Rounded.HomeWork, "Giới thiệu chủ nhà", { section = "host" })
                if (state.isAuthenticated) ActionRow(Icons.AutoMirrored.Rounded.Logout, "Đăng xuất", { logoutConfirmation = true }, Modifier.testTag("account-logout"), true)
            }
        }
    }
}

@Composable
private fun ProfileShortcut(title: String, icon: ImageVector, onClick: () -> Unit, modifier: Modifier) {
    Surface(onClick = onClick, modifier = modifier.height(112.dp), shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, null, Modifier.size(28.dp))
            Text(title, style = MaterialTheme.typography.titleSmall, textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun ActionRow(icon: ImageVector, title: String, onClick: () -> Unit, modifier: Modifier = Modifier, isDestructive: Boolean = false) {
    TroOiListRow(title, onClick = onClick, modifier = modifier, destructive = isDestructive,
        leading = { Icon(icon, null, Modifier.size(22.dp), tint = if (isDestructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface) })
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
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
