package com.trooi.app.features.profile

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
import androidx.compose.material.icons.automirrored.rounded.ReceiptLong
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
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
import com.trooi.app.core.model.LocalLandlordApplication
import com.trooi.app.ui.components.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.ResolverStyle

/**
 * Three-step identity-assisted operator setup:
 *   1. Scan ID (OCR on device, no server-side verification claim)
 *   2. Review/correct prefilled information
 *   3. Contact details and submit
 * Organization and first asset are managed in Operator Workspace after setup.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun LandlordOnboardingScreen(
    name: String,
    onDismiss: () -> Unit,
    onFinish: () -> Unit,
    onComplete: suspend (LocalLandlordApplication) -> Result<Unit>,
) {
    var step by remember { mutableIntStateOf(0) }
    var fullName by remember { mutableStateOf("") }
    var birthDate by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var cardFront by remember { mutableStateOf<Bitmap?>(null) }
    var cardBack by remember { mutableStateOf<Bitmap?>(null) }
    var cardReviewed by remember { mutableStateOf(false) }
    var contactConfirmed by remember { mutableStateOf(false) }
    var termsAccepted by remember { mutableStateOf(false) }
    var scanning by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var exitReview by remember { mutableStateOf(false) }
    var picking by remember { mutableStateOf("front") }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val focus = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    val scroll = rememberLazyListState()

    fun acceptBitmap(bitmap: Bitmap) {
        val side = picking
        if (side == "front") cardFront = bitmap else cardBack = bitmap
        cardReviewed = false
        scope.launch {
            scanning = true
            runCatching { scanCitizenId(bitmap) }
                .onSuccess { extracted ->
                    if (side == "front") {
                        if (extracted.fullName != null) fullName = extracted.fullName
                        if (extracted.birthDate != null) birthDate = extracted.birthDate
                    }
                    error = null
                }
                .onFailure { error = "Chưa đọc rõ thông tin trên ảnh. Bạn có thể nhập lại ở bước tiếp theo." }
            scanning = false
        }
    }
    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) scope.launch {
            busy = true
            runCatching { identityPhoto(context, uri) }
                .onSuccess(::acceptBitmap)
                .onFailure { error = "Không đọc được ảnh. Hãy chọn ảnh khác." }
            busy = false
        }
    }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { photo ->
        if (photo != null) acceptBitmap(photo)
    }

    val birthday = runCatching {
        LocalDate.parse(birthDate, DateTimeFormatter.ofPattern("dd/MM/uuuu").withResolverStyle(ResolverStyle.STRICT))
    }.getOrNull()
    val nameValid = fullName.trim().length in 2..80
    val birthValid = birthday?.isBefore(LocalDate.now()) == true
    val phoneValid = phone.replace(" ", "").matches(Regex("(0|\\+84)\\d{9,10}"))
    val emailValid = email.trim().matches(Regex("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"))
    val canProceed = when (step) {
        1 -> cardFront != null && cardBack != null && !scanning && !busy
        2 -> nameValid && birthValid && cardReviewed && !busy
        3 -> phoneValid && emailValid && contactConfirmed && termsAccepted && !busy
        else -> true
    }

    val titles = listOf("Trở thành chủ trọ", "Quét căn cước công dân", "Kiểm tra thông tin", "Thông tin liên hệ", "Sẵn sàng quản lý")
    LaunchedEffect(step) { scroll.scrollToItem(0); error = null }

    fun advance() {
        focus.clearFocus()
        keyboard?.hide()
        when (step) {
            0, 1, 2 -> step++
            3 -> scope.launch {
                busy = true
                val application = LocalLandlordApplication(
                    fullName = fullName.trim(),
                    birthDate = requireNotNull(birthday).toString(),
                    phone = phone.trim(),
                    email = email.trim(),
                    identityDetailsReviewed = cardReviewed,
                    contactConfirmed = contactConfirmed,
                    termsAccepted = termsAccepted,
                    firstAsset = null,
                    publish = false,
                )
                onComplete(application).onSuccess {
                    cardFront = null
                    cardBack = null
                    step = 4
                }.onFailure {
                    error = it.message?.takeIf(String::isNotBlank)
                        ?: "Không thể hoàn tất hồ sơ. Vui lòng thử lại."
                }
                busy = false
            }
            else -> onFinish()
        }
    }

    Dialog(
        onDismissRequest = { if (!busy && !scanning) exitReview = true },
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        BackHandler {
            if (!busy && !scanning) {
                if (step == 4) onFinish()
                else if (step > 0) step--
                else exitReview = true
            }
        }
        TroOiScreenScaffold(
            modifier = Modifier.fillMaxSize().imePadding(),
            contentWindowInsets = WindowInsets.safeDrawing,
            topBar = {
                TroOiPageTopAppBar(
                    title = { Text(if (step in 1..3) "Bước $step / 3" else "Trở thành chủ trọ") },
                    navigationIcon = {
                        IconButton(
                            onClick = {
                                if (step == 4) onFinish()
                                else if (step > 0) step--
                                else exitReview = true
                            },
                            enabled = !busy && !scanning,
                        ) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Quay lại") }
                    },
                    actions = {
                        if (step != 4) TroOiButton("Đóng", { exitReview = true },
                            enabled = !busy && !scanning, style = TroOiButtonStyle.TERTIARY)
                    },
                )
            },
            bottomBar = {
                Surface(shadowElevation = 2.dp) {
                    Column(
                        Modifier.fillMaxWidth().navigationBarsPadding().padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                        TroOiButton(
                            text = when (step) {
                                0 -> "Bắt đầu"
                                3 -> "Hoàn tất hồ sơ"
                                4 -> "Vào không gian quản lý"
                                else -> "Tiếp tục"
                            },
                            onClick = ::advance,
                            enabled = canProceed,
                            busy = busy || scanning,
                            modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("onboarding-next"),
                        )
                    }
                }
            },
        ) { insets ->
            LazyColumn(
                Modifier.fillMaxSize().padding(insets).consumeWindowInsets(insets).testTag("onboarding-scroll"),
                state = scroll,
                contentPadding = PaddingValues(20.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                item {
                    if (step in 1..3) {
                        LinearProgressIndicator(progress = { step / 3f }, modifier = Modifier.fillMaxWidth())
                        Spacer(Modifier.height(24.dp))
                    }
                    Text(titles[step], style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.SemiBold)
                }
                when (step) {
                    0 -> {
                        item {
                            Text("Một nơi để quản lý phòng trọ dễ dàng hơn.",
                                style = MaterialTheme.typography.titleLarge)
                            Spacer(Modifier.height(8.dp))
                            Text("Bắt đầu với hồ sơ chủ trọ. Sau đó, thêm khu nhà và phòng khi bạn sẵn sàng.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        item { FeatureSummary(Icons.Rounded.Apartment, "Quản lý phòng", "Theo dõi phòng trống, người thuê và lịch sử.") }
                        item { FeatureSummary(Icons.AutoMirrored.Rounded.ReceiptLong, "Thu chi rõ ràng", "Theo dõi khoản phải thu và biên nhận.") }
                        item { FeatureSummary(Icons.Rounded.Handyman, "Xử lý sự cố", "Ghi nhận báo hỏng và quá trình xử lý.") }
                    }
                    1 -> {
                        item {
                            Text("Chụp hai mặt CCCD hoặc chọn ảnh từ thiết bị. Thông tin đọc được sẽ được điền vào biểu mẫu để bạn kiểm tra.",
                                style = MaterialTheme.typography.bodyMedium)
                        }
                        item {
                            ScanPhotoTile("Mặt trước CCCD", cardFront, busy || scanning,
                                onPick = {
                                    picking = "front"
                                    photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                                },
                                onCamera = {
                                    picking = "front"
                                    camera.launch(null)
                                },
                                tag = "onboarding-id-front",
                            )
                        }
                        item {
                            ScanPhotoTile("Mặt sau CCCD", cardBack, busy || scanning,
                                onPick = {
                                    picking = "back"
                                    photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                                },
                                onCamera = {
                                    picking = "back"
                                    camera.launch(null)
                                },
                                tag = "onboarding-id-back",
                            )
                        }
                        if (scanning) item { LinearProgressIndicator(modifier = Modifier.fillMaxWidth()) }
                        item {
                            Text("Ảnh chỉ được xử lý để hỗ trợ nhập thông tin. Kết quả quét không phải xác nhận danh tính.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    2 -> {
                        item {
                            Text("Kiểm tra họ tên và ngày sinh. Bạn có thể chỉnh sửa nếu ảnh được đọc chưa chính xác.",
                                style = MaterialTheme.typography.bodyMedium)
                        }
                        item {
                            Column(verticalArrangement = Arrangement.spacedBy(15.dp)) {
                                OnboardingField("Họ và tên", fullName, "onboarding-name") {
                                    fullName = it
                                    cardReviewed = false
                                }
                                OnboardingField("Ngày sinh · dd/MM/yyyy", birthDate, "onboarding-birthday") {
                                    birthDate = it
                                    cardReviewed = false
                                }
                                if (birthDate.isNotBlank() && !birthValid) {
                                    Text("Vui lòng kiểm tra lại ngày sinh.",
                                        color = MaterialTheme.colorScheme.error)
                                }
                                OnboardingCheck("Tôi đã kiểm tra họ tên và ngày sinh đã nhập.",
                                    cardReviewed, "onboarding-identity-accept", nameValid && birthValid) {
                                    cardReviewed = it
                                }
                            }
                        }
                    }
                    3 -> {
                        item {
                            Text("Cung cấp thông tin để người thuê có thể liên hệ với bạn.",
                                style = MaterialTheme.typography.bodyMedium)
                        }
                        item {
                            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                                OnboardingField("Số điện thoại", phone, "onboarding-phone", KeyboardType.Phone) {
                                    phone = it
                                    contactConfirmed = false
                                }
                                OnboardingField("Email liên hệ", email, "onboarding-email", KeyboardType.Email) {
                                    email = it
                                    contactConfirmed = false
                                }
                                OnboardingCheck("Tôi xác nhận thông tin liên hệ đã nhập.",
                                    contactConfirmed, "onboarding-contact-confirm", phoneValid && emailValid) {
                                    contactConfirmed = it
                                }
                                OnboardingCheck("Tôi đồng ý sử dụng TrọƠi để quản lý hoạt động cho thuê.",
                                    termsAccepted, "onboarding-acknowledgement") {
                                    termsAccepted = it
                                }
                            }
                        }
                    }
                    4 -> item {
                        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            Icon(Icons.Rounded.CheckCircle, null, Modifier.size(54.dp),
                                tint = MaterialTheme.colorScheme.primary)
                            Text("Hồ sơ chủ trọ đã sẵn sàng.",
                                style = MaterialTheme.typography.titleLarge)
                            Text("Bạn có thể tạo khu nhà và thêm phòng đầu tiên trong không gian quản lý.")
                        }
                    }
                }
            }
        }
        if (exitReview) TroOiActionDialog(
            onDismissRequest = { exitReview = false },
            title = { Text("Đóng đăng ký chủ trọ?") },
            text = { Text("Thông tin chưa hoàn tất sẽ được xóa khỏi biểu mẫu.") },
            confirmButton = { TroOiButton("Đóng đăng ký", {
                cardFront = null
                cardBack = null
                onDismiss()
            }, style = TroOiButtonStyle.DESTRUCTIVE) },
            dismissButton = { TroOiButton("Tiếp tục đăng ký", { exitReview = false },
                style = TroOiButtonStyle.SECONDARY) },
        )
    }
}

@Composable
private fun FeatureSummary(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, description: String) {
    Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(16.dp)) {
        Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Icon(icon, null, Modifier.size(26.dp), tint = MaterialTheme.colorScheme.primary)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(description, style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun ScanPhotoTile(
    label: String, bitmap: Bitmap?, busy: Boolean,
    onPick: () -> Unit, onCamera: () -> Unit, tag: String,
) {
    Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(16.dp)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(label, style = MaterialTheme.typography.titleMedium)
            if (bitmap != null) {
                Image(bitmap.asImageBitmap(), label,
                    Modifier.fillMaxWidth().height(112.dp).clip(RoundedCornerShape(12.dp)),
                    contentScale = ContentScale.Fit)
            } else {
                Icon(Icons.Rounded.Badge, null, Modifier.size(35.dp), tint = MaterialTheme.colorScheme.primary)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                TroOiButton(if (bitmap == null) "Chọn ảnh" else "Đổi ảnh",
                    onPick, Modifier.weight(1f).testTag(tag),
                    enabled = !busy, style = TroOiButtonStyle.SECONDARY)
                TroOiButton("Chụp ảnh", onCamera, Modifier.weight(1f),
                    enabled = !busy, style = TroOiButtonStyle.TERTIARY)
            }
        }
    }
}

private suspend fun identityPhoto(context: android.content.Context, uri: Uri): Bitmap =
    withContext(Dispatchers.IO) {
        val resolver = context.contentResolver
        require(resolver.getType(uri)?.startsWith("image/") == true)
        if (android.os.Build.VERSION.SDK_INT >= 28) {
            android.graphics.ImageDecoder.decodeBitmap(
                android.graphics.ImageDecoder.createSource(resolver, uri),
            ) { decoder, info, _ ->
                val longest = maxOf(info.size.width, info.size.height)
                if (longest > 1200) decoder.setTargetSize(
                    (info.size.width * 1200f / longest).toInt().coerceAtLeast(1),
                    (info.size.height * 1200f / longest).toInt().coerceAtLeast(1),
                )
            }
        } else {
            val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
            require(options.outWidth > 0 && options.outHeight > 0)
            options.inJustDecodeBounds = false
            options.inSampleSize = (maxOf(options.outWidth, options.outHeight) / 1200).coerceAtLeast(1)
            requireNotNull(resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) })
        }
    }

@Composable
private fun OnboardingField(
    label: String, value: String, tag: String, keyboardType: KeyboardType = KeyboardType.Text,
    onValue: (String) -> Unit,
) {
    val focus = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    TroOiFormField(
        value, { onValue(it.take(200)) }, Modifier.fillMaxWidth().testTag(tag),
        label = { Text(label) }, singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { focus.clearFocus(); keyboard?.hide() }),
    )
}

@Composable
private fun OnboardingCheck(
    label: String, checked: Boolean, tag: String, enabled: Boolean = true, onChange: (Boolean) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 48.dp)
            .toggleable(checked, enabled = enabled, role = Role.Checkbox, onValueChange = onChange)
            .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(checked, null, enabled = enabled)
        Text(label, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
    }
}
