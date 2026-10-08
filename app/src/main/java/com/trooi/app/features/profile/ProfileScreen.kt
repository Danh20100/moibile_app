package com.trooi.app.features.profile

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
    onLogout: () -> Unit = {},
    onCompleteLandlord: suspend (LocalLandlordApplication) -> Result<Unit> = { Result.failure(IllegalStateException(PROFILE_UNSUPPORTED_MESSAGE)) },
    onOpenWorkspace: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    if (!state.isAuthenticated) return
    val presentation = profilePresentation(state)
    var onboarding by remember(state.backendUserId) { mutableStateOf(false) }
    var detail by remember(state.backendUserId) { mutableStateOf<String?>(null) }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val unsupported: () -> Unit = { scope.launch { snackbar.showSnackbar(PROFILE_UNSUPPORTED_MESSAGE) } }
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
        if (title == "Tài khoản") {
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
    Scaffold(snackbarHost = { SnackbarHost(snackbar) }, containerColor = MaterialTheme.colorScheme.background) { insets ->
        LazyColumn(modifier.fillMaxSize().padding(insets).testTag("profile-scroll"),
            contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("Hồ sơ", Modifier.weight(1f), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    IconButton(onNotifications, Modifier.testTag("profile-notification-bell")) { Icon(Icons.Rounded.NotificationsNone, "Thông báo") }
                }
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
                ActionRow(Icons.Rounded.PersonOutline, "Tài khoản", { detail = "Tài khoản" }, Modifier.testTag("account-settings"))
                ActionRow(Icons.Rounded.Settings, "Cài đặt", unsupported)
                ActionRow(Icons.AutoMirrored.Rounded.HelpOutline, "Nhận trợ giúp", unsupported, Modifier.testTag("account-help"))
                ActionRow(Icons.Rounded.Shield, "Quyền riêng tư", unsupported)
                ActionRow(Icons.Rounded.Description, "Pháp lý", unsupported)
                if (state.isAuthenticated) ActionRow(Icons.AutoMirrored.Rounded.Logout, "Đăng xuất", onLogout, Modifier.testTag("account-logout"), true)
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
    Row(modifier.fillMaxWidth().heightIn(min = 56.dp).clickable(onClick = onClick).padding(vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, Modifier.size(22.dp), tint = if (isDestructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface)
        Text(title, Modifier.weight(1f).padding(horizontal = 16.dp), color = if (isDestructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface)
        Icon(Icons.Rounded.ChevronRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
}

@Composable
private fun ProfileDetail(title: String, onBack: () -> Unit, content: androidx.compose.foundation.lazy.LazyListScope.() -> Unit) {
    Dialog(onDismissRequest = onBack, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        BackHandler(onBack = onBack)
        Surface(Modifier.fillMaxSize().safeDrawingPadding()) {
            LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                item { Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onBack) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Quay lại") }
                    Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                } }
                content()
            }
        }
    }
}
