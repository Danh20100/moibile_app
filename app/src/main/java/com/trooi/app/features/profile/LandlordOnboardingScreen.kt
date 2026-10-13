package com.trooi.app.features.profile

import com.trooi.app.ui.components.*
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.*
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.trooi.app.core.model.*
import com.trooi.app.features.ledger.AssetWizard
import com.trooi.app.features.discovery.rentalPriceLabel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.ResolverStyle

/** No saved state or file copies for identity media or personal/contact input. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun LandlordOnboardingScreen(name: String, onDismiss: () -> Unit, onFinish: () -> Unit,
    onComplete: suspend (LocalLandlordApplication) -> Result<Unit>) {
    var step by remember { mutableIntStateOf(0) }
    var fullName by remember { mutableStateOf(name) }
    var birthDate by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var identity by remember { mutableStateOf(emptyMap<String, Bitmap>()) }
    var identityAccepted by remember { mutableStateOf(false) }
    var contactConfirmed by remember { mutableStateOf(false) }
    var termsAccepted by remember { mutableStateOf(false) }
    var asset by remember { mutableStateOf<LocalRentalAsset?>(null) }
    var publish by remember { mutableStateOf(false) }
    var assetOpen by remember { mutableStateOf(false) }
    var exitReview by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var picking by remember { mutableStateOf("front") }
    val context = LocalContext.current
    val focus = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    val scope = rememberCoroutineScope()
    val scroll = rememberLazyListState()
    val birthday = runCatching { LocalDate.parse(birthDate, DateTimeFormatter.ofPattern("dd/MM/uuuu").withResolverStyle(ResolverStyle.STRICT)) }.getOrNull()
    val contactValid = phone.replace(" ", "").matches(Regex("(0|\\+84)\\d{9,10}")) && email.trim().matches(Regex("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"))
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) scope.launch {
            busy = true
            val target = picking
            runCatching { identityPhoto(context, uri) }.onSuccess { identity = identity + (target to it); identityAccepted = false; error = null }
                .onFailure { error = "Không đọc được ảnh. Vui lòng chọn ảnh rõ nét khác." }
            busy = false
        }
    }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { photo ->
        if (photo != null) { identity = identity + ("selfie" to photo); identityAccepted = false }
    }
    val ready = when (step) {
        1 -> fullName.trim().length >= 2 && birthday?.isBefore(LocalDate.now()) == true
        2 -> identity.size == 3 && identityAccepted
        3 -> contactValid && contactConfirmed
        4 -> asset?.valid() == true && (asset!!.photoUris.isNotEmpty() || asset!!.photoResources.isNotEmpty())
        5 -> termsAccepted
        else -> true
    }
    val titles = listOf("Bắt đầu làm chủ trọ", "Thông tin cá nhân", "Ảnh xác minh danh tính", "Thông tin liên hệ", "Tài sản đầu tiên", "Kiểm tra thông tin", "Bạn đã sẵn sàng")
    LaunchedEffect(step) { scroll.scrollToItem(0); error = null }
    fun next() {
        focus.clearFocus(); keyboard?.hide()
        if (step == 6) { onFinish(); return }
        if (step != 5) { step++; return }
        val first = asset ?: return
        val application = LocalLandlordApplication(fullName.trim(), birthday!!.toString(), phone.trim(), email.trim(), identityAccepted, contactConfirmed, termsAccepted, first, publish)
        scope.launch {
            busy = true
            onComplete(application).onSuccess { identity = emptyMap(); fullName = ""; birthDate = ""; phone = ""; email = ""; step = 6 }
                .onFailure { error = "Chưa hoàn tất được. Vui lòng kiểm tra thông tin và thử lại." }
            busy = false
        }
    }
    Dialog({ if (!busy) exitReview = true }, DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        BackHandler { if (!busy) { if (step == 6) onFinish() else if (step > 0) step-- else exitReview = true } }
        TroOiScreenScaffold(modifier = Modifier.fillMaxSize().imePadding(), contentWindowInsets = WindowInsets.safeDrawing,
            topBar = { TroOiPageTopAppBar(title = { Text(if (step in 1..5) "Bước $step / 5" else "Trở thành chủ trọ") },
            navigationIcon = { IconButton({ if (step == 6) onFinish() else if (step > 0) step-- else exitReview = true }, enabled = !busy) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Quay lại") } },
            actions = { if (step < 6) TroOiButton("Đóng", { exitReview = true }, enabled = !busy, style = TroOiButtonStyle.TERTIARY) }) },
            bottomBar = { Surface(shadowElevation = 3.dp) { Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                if (busy) TroOiStateMessage(TroOiStateKind.LOADING, "")
                TroOiButton(when (step) { 0 -> "Bắt đầu"; 5 -> "Hoàn tất"; 6 -> "Vào Sổ"; else -> "Tiếp tục" }, ::next,
                    enabled = ready && !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("onboarding-next"))
            } } }) { insets ->
            LazyColumn(Modifier.fillMaxSize().padding(insets).consumeWindowInsets(insets).testTag("onboarding-scroll"), state = scroll,
                contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                item {
                    if (step in 1..5) { LinearProgressIndicator(progress = { step / 5f }, modifier = Modifier.fillMaxWidth()); Spacer(Modifier.height(20.dp)) }
                    Text(titles[step], style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
                }
                when (step) {
                    0 -> item {
                        Icon(Icons.Rounded.HomeWork, null, Modifier.size(64.dp), tint = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.height(20.dp))
                        Text("Một nơi để quản lý tài sản, người thuê và các khoản phải thu.", style = MaterialTheme.typography.titleLarge)
                        Spacer(Modifier.height(24.dp))
                        listOf("Chuẩn bị ảnh hai mặt CCCD và ảnh khuôn mặt", "Xác nhận thông tin liên hệ", "Thêm phòng trọ hoặc căn hộ đầu tiên").forEach { Text(it, Modifier.padding(vertical = 12.dp)) }
                        Text("Ảnh giấy tờ chỉ dùng trong lần đăng ký này. TrọƠi không lưu ảnh sau khi bạn đóng quy trình.", style = MaterialTheme.typography.bodySmall)
                    }
                    1 -> item { Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        OnboardingField("Họ và tên", fullName, "onboarding-name") { fullName = it }
                        OnboardingField("Ngày sinh · dd/MM/yyyy", birthDate, "onboarding-birthday") { birthDate = it }
                        if (birthDate.isNotBlank() && (birthday == null || !birthday.isBefore(LocalDate.now()))) Text("Nhập ngày sinh hợp lệ trước hôm nay.", color = MaterialTheme.colorScheme.error)
                    } }
                    2 -> {
                        item { Text("Chọn ảnh rõ nét, đầy đủ giấy tờ và khuôn mặt. Ảnh được kiểm tra độ sẵn sàng trên thiết bị; không xác thực với cơ quan cấp giấy tờ.", style = MaterialTheme.typography.bodyMedium) }
                        listOf("front" to "Mặt trước CCCD", "back" to "Mặt sau CCCD", "selfie" to "Ảnh khuôn mặt").forEach { (key, label) -> item {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(label, style = MaterialTheme.typography.titleMedium)
                                identity[key]?.let { Image(it.asImageBitmap(), label, Modifier.fillMaxWidth().height(150.dp).clip(RoundedCornerShape(12.dp)), contentScale = ContentScale.Fit) }
                                TroOiButton(if (identity[key] == null) "Chọn ảnh" else "Thay ảnh", { picking = key; picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, enabled = !busy,
                                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("onboarding-id-$key"), style = TroOiButtonStyle.SECONDARY)
                                if (key == "selfie") TroOiButton("Chụp ảnh khuôn mặt", { runCatching { camera.launch(null) }.onFailure { error = "Chưa mở được máy ảnh. Bạn có thể chọn ảnh khuôn mặt." } },
                                    enabled = !busy, modifier = Modifier.testTag("onboarding-selfie-camera"), style = TroOiButtonStyle.TERTIARY)
                                if (identity[key] != null) Text("Ảnh đã sẵn sàng", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                            }
                        } }
                        item { OnboardingCheck("Tôi đã kiểm tra ảnh rõ nét và đúng giấy tờ, khuôn mặt của mình.", identityAccepted, "onboarding-identity-accept", identity.size == 3) { identityAccepted = it } }
                    }
                    3 -> item { Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        OnboardingField("Số điện thoại", phone, "onboarding-phone", KeyboardType.Phone) { phone = it; contactConfirmed = false }
                        OnboardingField("Email", email, "onboarding-email", KeyboardType.Email) { email = it; contactConfirmed = false }
                        Text("Kiểm tra thông tin để người thuê có thể liên hệ với bạn.")
                        OnboardingCheck("Tôi xác nhận số điện thoại và email liên hệ này.", contactConfirmed, "onboarding-contact-confirm", contactValid) { contactConfirmed = it }
                        if (contactConfirmed) Text("Đã xác nhận trên thiết bị", color = MaterialTheme.colorScheme.primary)
                    } }
                    4 -> item { Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text("Bắt đầu với một tài sản. Bạn có 1 slot quản lý miễn phí.")
                        asset?.let {
                            if (it.photoUris.isNotEmpty() || it.photoResources.isNotEmpty()) LocalRentalPhoto(it.photoUris.firstOrNull(), it.photoResources.firstOrNull(), it.name, Modifier.fillMaxWidth().height(200.dp).clip(RoundedCornerShape(16.dp)))
                            Text(it.name, style = MaterialTheme.typography.titleLarge)
                            Text("${it.type} · ${it.publicArea}")
                            Text("${rentalPriceLabel(it.monthlyRent)}/tháng")
                            Text(if (publish) "Đăng cho thuê sau khi hoàn tất" else "Lưu để quản lý · chưa công khai")
                        }
                        TroOiButton(if (asset == null) "+ Thêm tài sản đầu tiên" else "Chỉnh sửa tài sản", { assetOpen = true },
                            Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("onboarding-first-asset"), style = TroOiButtonStyle.SECONDARY)
                    } }
                    5 -> item { Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(fullName, style = MaterialTheme.typography.titleLarge)
                        Text("Ngày sinh: $birthDate")
                        Text("Ảnh giấy tờ và khuôn mặt: đã kiểm tra trên thiết bị")
                        Text("$phone\n$email")
                        HorizontalDivider()
                        asset?.let { Text(it.name, style = MaterialTheme.typography.titleLarge); Text("${it.type} · ${it.publicArea}"); Text("${rentalPriceLabel(it.monthlyRent)}/tháng") }
                        Text(if (publish) "Tài sản sẽ được quản lý và đăng cho thuê." else "Tài sản sẽ được quản lý riêng, chưa đăng cho thuê.")
                        OnboardingCheck("Tôi xác nhận thông tin đã nhập và đồng ý sử dụng TrọƠi để quản lý tài sản cho thuê.", termsAccepted, "onboarding-acknowledgement") { termsAccepted = it }
                    } }
                    6 -> item { Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        Icon(Icons.Rounded.CheckCircle, null, Modifier.size(64.dp), tint = MaterialTheme.colorScheme.primary)
                        Text("Tài sản đầu tiên đã được lưu. Bạn có thể theo dõi người thuê, các khoản phải thu và tin đăng trong Sổ.")
                        Text("1 / 1 tài sản đang quản lý", style = MaterialTheme.typography.titleLarge)
                    } }
                }
            }
        }
        if (assetOpen) AssetWizard(asset, LocalManagement(), name, { assetOpen = false },
            { selected, activate, shouldPublish -> asset = selected; publish = activate && shouldPublish; Result.success(Unit) },
            { Result.failure(IllegalStateException("Không cần mua dung lượng cho tài sản đầu tiên.")) })
        if (exitReview) TroOiActionDialog({ exitReview = false },             title = { Text("Đóng đăng ký chủ trọ?") }, text = { Text("Ảnh giấy tờ và thông tin đang nhập sẽ được xóa. Bạn có thể bắt đầu lại từ Hồ sơ.") },
            confirmButton = { TroOiButton("Đóng đăng ký", { identity = emptyMap(); onDismiss() }, style = TroOiButtonStyle.DESTRUCTIVE) },
            dismissButton = { TroOiButton("Tiếp tục đăng ký", { exitReview = false }, style = TroOiButtonStyle.SECONDARY) })
    }
}

private suspend fun identityPhoto(context: android.content.Context, uri: Uri): Bitmap = withContext(Dispatchers.IO) {
    val resolver = context.contentResolver
    require(resolver.getType(uri)?.startsWith("image/") == true)
    if (android.os.Build.VERSION.SDK_INT >= 28) {
        android.graphics.ImageDecoder.decodeBitmap(android.graphics.ImageDecoder.createSource(resolver, uri)) { decoder, info, _ ->
            val longest = maxOf(info.size.width, info.size.height)
            if (longest > 800) decoder.setTargetSize((info.size.width * 800f / longest).toInt().coerceAtLeast(1), (info.size.height * 800f / longest).toInt().coerceAtLeast(1))
        }
    } else {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        require(bounds.outWidth > 0 && bounds.outHeight > 0)
        val options = BitmapFactory.Options().apply { inSampleSize = (maxOf(bounds.outWidth, bounds.outHeight) / 800).coerceAtLeast(1) }
        requireNotNull(resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) })
    }
}

@Composable
private fun OnboardingField(label: String, value: String, tag: String, keyboardType: KeyboardType = KeyboardType.Text, onValue: (String) -> Unit) {
    val focus = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    TroOiFormField(value, { onValue(it.take(200)) }, Modifier.fillMaxWidth().testTag(tag), label = { Text(label) }, singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = ImeAction.Done), keyboardActions = KeyboardActions(onDone = { focus.clearFocus(); keyboard?.hide() }))
}

@Composable
private fun OnboardingCheck(label: String, checked: Boolean, tag: String, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).toggleable(checked, enabled = enabled, role = Role.Checkbox, onValueChange = onChange).testTag(tag)) {
        Checkbox(checked, null, enabled = enabled)
        Text(label, Modifier.weight(1f).padding(top = 12.dp), style = MaterialTheme.typography.bodyMedium)
    }
}
