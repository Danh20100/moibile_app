package com.trooi.app.features.profile

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.*
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import com.trooi.app.core.model.LocalLandlordApplication
import com.trooi.app.core.network.BackendApi
import com.trooi.app.core.network.dto.ApiOutcome
import com.trooi.app.ui.components.*
import android.webkit.WebView
import android.webkit.WebViewClient
import dagger.hilt.android.lifecycle.HiltViewModel
import java.util.UUID
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.ResolverStyle

@HiltViewModel
internal class LandlordPlanViewModel @Inject constructor(private val api: BackendApi) : ViewModel() {
    private val purchaseId = UUID.randomUUID().toString()
    private val idempotencyKey = UUID.randomUUID().toString()

    suspend fun alreadyPaid(): Boolean = when (val result = api.planEntitlements()) {
        is ApiOutcome.Data -> result.value.isNotEmpty()
        is ApiOutcome.Failure -> false
    }

    suspend fun start(): Pair<String, String?>? = when (val result = api.createPlanCheckout(purchaseId, idempotencyKey)) {
        is ApiOutcome.Data -> result.value.id to result.value.payUrl
        is ApiOutcome.Failure -> null
    }

    suspend fun reconcile(id: String): String? = when (val result = api.reconcilePlanCheckout(id)) {
        is ApiOutcome.Data -> result.value.status
        is ApiOutcome.Failure -> null
    }
}

/**
 * Four-step identity-assisted operator setup:
 *   1. Capture ID front and run OCR, 2. Capture ID back,
 *   3. Review/correct OCR, 4. selfie with backend auto-check
 *   (or contact details in isolated demo mode).
 * Scanning is a visual guide, not government document authenticity verification.
 * Organization and first asset are managed in Operator Workspace after setup.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun LandlordOnboardingScreen(
    name: String,
    onDismiss: () -> Unit,
    onFinish: () -> Unit,
    onComplete: suspend (LocalLandlordApplication) -> Result<Unit>,
    backendVerification: Boolean = false,
) {
    var step by remember { mutableIntStateOf(0) }
    var fullName by remember { mutableStateOf("") }
    var birthDate by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var cardFront by remember { mutableStateOf<Bitmap?>(null) }
    var cardBack by remember { mutableStateOf<Bitmap?>(null) }
    var selfie by remember { mutableStateOf<Bitmap?>(null) }
    var cardReviewed by remember { mutableStateOf(false) }
    var contactConfirmed by remember { mutableStateOf(false) }
    var termsAccepted by remember { mutableStateOf(false) }
    val kycModel: AutoKycViewModel? = if (backendVerification) hiltViewModel(key = "landlord-kyc") else null
    val planModel: LandlordPlanViewModel? = if (backendVerification) hiltViewModel(key = "landlord-plan") else null
    var planCheckoutId by remember { mutableStateOf<String?>(null) }
    var planPayUrl by remember { mutableStateOf<String?>(null) }
    var planPaid by remember { mutableStateOf(false) }
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
        if (side == "selfie") { selfie = bitmap; return }
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
        1 -> cardFront != null && !scanning && !busy
        2 -> cardBack != null && !scanning && !busy
        3 -> nameValid && birthValid && cardReviewed && !busy
        4 -> if (backendVerification) selfie != null && termsAccepted && !busy
             else phoneValid && emailValid && contactConfirmed && termsAccepted && !busy
        else -> true
    }

    val titles = listOf(
        "Trở thành chủ trọ",
        "Quét mặt trước CCCD",
        "Quét mặt sau CCCD",
        "Kiểm tra thông tin",
        if (backendVerification) "Selfie và đối chiếu khuôn mặt" else "Thông tin liên hệ",
        if (backendVerification) "Gói chủ trọ" else "Sẵn sàng quản lý",
        "Sẵn sàng quản lý",
    )
    LaunchedEffect(step) {
        scroll.scrollToItem(0)
        error = null
        if (backendVerification && step == 5 && planCheckoutId == null) {
            busy = true
            if (planModel?.alreadyPaid() == true) planPaid = true
            else {
                val started = planModel?.start()
                planCheckoutId = started?.first
                planPayUrl = started?.second
                if (started == null) error = "Chưa tạo được QR SePay."
            }
            busy = false
        }
    }

    fun skipIdentity() {
        step = if (backendVerification) 5 else 4
    }

    fun advance() {
        focus.clearFocus()
        keyboard?.hide()
        when (step) {
            0, 1, 2, 3 -> step++
            4 -> scope.launch {
                busy = true
                if (backendVerification) {
                    val result = runCatching {
                        val photos = withContext(Dispatchers.Default) {
                            listOf(
                                encodeKycBitmap(requireNotNull(cardFront)),
                                encodeKycBitmap(requireNotNull(cardBack)),
                                encodeKycBitmap(requireNotNull(selfie)),
                            )
                        }
                        requireNotNull(kycModel).verifyForOnboarding(photos[0], photos[1], photos[2]).getOrThrow()
                    }
                    result.onSuccess {
                        cardFront = null
                        cardBack = null
                        selfie = null
                        step = 5
                    }.onFailure {
                        error = it.message ?: "Chưa thể kiểm tra khuôn mặt. Hãy thử lại."
                    }
                } else {
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
                        step = 5
                    }.onFailure {
                        error = it.message?.takeIf(String::isNotBlank)
                            ?: "Không thể hoàn tất hồ sơ. Vui lòng thử lại."
                    }
                }
                busy = false
            }
            5 -> if (backendVerification) scope.launch {
                busy = true
                val status = if (planPaid) "SUCCEEDED" else planCheckoutId?.let { planModel?.reconcile(it) }
                if (status == "SUCCEEDED") {
                    planPaid = true
                    step = 6
                } else error = "Chưa nhận được thanh toán SePay."
                busy = false
            } else onFinish()
            else -> onFinish()
        }
    }

    Dialog(
        onDismissRequest = { if (!busy && !scanning) exitReview = true },
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        BackHandler {
            if (!busy && !scanning) {
                if (step == 6 || (step == 5 && !backendVerification)) onFinish()
                else if (step > 0) step--
                else exitReview = true
            }
        }
        TroOiScreenScaffold(
            modifier = Modifier.fillMaxSize().imePadding(),
            contentWindowInsets = WindowInsets.safeDrawing,
            topBar = {
                TroOiPageTopAppBar(
                    title = { Text(when {
                        backendVerification && step in 1..5 -> "Bước $step / 5"
                        step in 1..4 -> "Bước $step / 4"
                        else -> "Trở thành chủ trọ"
                    }) },
                    navigationIcon = {
                        IconButton(
                            onClick = {
                                if (step == 6 || (step == 5 && !backendVerification)) onFinish()
                                else if (step > 0) step--
                                else exitReview = true
                            },
                            enabled = !busy && !scanning,
                        ) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Quay lại") }
                    },
                    actions = {
                        if (step != 5) TroOiButton("Đóng", { exitReview = true },
                            enabled = !busy && !scanning, style = TroOiButtonStyle.TERTIARY)
                    },
                )
            },
            bottomBar = {
                Surface(
                    color = MaterialTheme.colorScheme.background,
                    tonalElevation = 0.dp,
                    shadowElevation = 0.dp,
                    modifier = Modifier.testTag("onboarding-footer"),
                ) {
                    Column(
                        Modifier.fillMaxWidth().navigationBarsPadding().padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                        if (step in 1..2 || (backendVerification && step == 4)) {
                            TroOiButton(
                                "Bổ sung sau",
                                ::skipIdentity,
                                enabled = !busy && !scanning,
                                style = TroOiButtonStyle.TERTIARY,
                                modifier = Modifier.fillMaxWidth().testTag("onboarding-skip-identity"),
                            )
                        }
                        TroOiButton(
                            text = when (step) {
                                0 -> "Bắt đầu"
                                4 -> if (backendVerification) "Kiểm tra khuôn mặt" else "Hoàn tất hồ sơ"
                                5 -> if (backendVerification) "Tôi đã chuyển khoản" else "Vào không gian quản lý"
                                6 -> "Vào không gian quản lý"
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
                    if (step in 1..4 || (backendVerification && step == 5)) {
                        LinearProgressIndicator(
                            progress = { step / if (backendVerification) 5f else 4f },
                            modifier = Modifier.fillMaxWidth(),
                        )
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
                            Text(
                                "Đặt mặt trước CCCD trong khung hướng dẫn. Chụp đủ bốn góc, rõ ảnh chân dung, họ tên và ngày sinh.",
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                        item {
                            IdentityCardGuide(
                                front = true,
                                bitmap = cardFront,
                                busy = busy || scanning,
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
                        if (scanning) item { LinearProgressIndicator(modifier = Modifier.fillMaxWidth()) }
                        item {
                            Text(
                                "Khung chỉ giúp định hướng ảnh; OCR hỗ trợ nhập liệu, không xác thực tính thật giả của CCCD.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    2 -> {
                        item {
                            Text(
                                "Lật CCCD sang mặt sau, giữ giấy tờ ngang và đặt đủ bốn góc trong khung. Tránh phản chiếu ánh sáng.",
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                        item {
                            IdentityCardGuide(
                                front = false,
                                bitmap = cardBack,
                                busy = busy || scanning,
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
                            Text(
                                "Mặt sau không thay thế bước so khớp selfie. Không cần đăng lại ảnh mặt trước.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    3 -> {
                        item {
                            Text(
                                "Kiểm tra họ tên và ngày sinh đọc từ mặt trước CCCD. Nếu OCR chưa nhận diện được, bạn có thể nhập thủ công.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        item {
                            Column(
                                modifier = Modifier.fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(14.dp),
                            ) {
                                OnboardingField("Họ và tên", fullName, "onboarding-name") {
                                    fullName = it
                                    cardReviewed = false
                                }
                                OnboardingField("Ngày sinh (dd/MM/yyyy)", birthDate, "onboarding-birthday") {
                                    birthDate = it
                                    cardReviewed = false
                                }
                                if (birthDate.isNotBlank() && !birthValid) {
                                    Text(
                                        "Nhập ngày sinh hợp lệ theo định dạng dd/MM/yyyy.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.error,
                                    )
                                }
                                OnboardingCheck(
                                    "Tôi đã đối chiếu họ tên và ngày sinh với CCCD.",
                                    cardReviewed,
                                    "onboarding-identity-accept",
                                    enabled = nameValid && birthValid,
                                ) { cardReviewed = it }
                            }
                        }
                    }
                    4 -> {
                        if (backendVerification) {
                            item {
                                Text("Bước cuối: Chụp selfie để so khớp khuôn mặt với ảnh mặt trước CCCD.",
                                    style = MaterialTheme.typography.bodyMedium)
                                Spacer(Modifier.height(8.dp))
                                Text("Kết quả chỉ đánh giá tương đồng khuôn mặt; không xác minh CCCD thật hay phát hiện ảnh giả.",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    style = MaterialTheme.typography.bodySmall)
                            }
                            item {
                                ScanPhotoTile("Ảnh selfie", selfie, busy || scanning,
                                    onPick = {
                                        picking = "selfie"
                                        photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                                    },
                                    onCamera = {
                                        picking = "selfie"
                                        camera.launch(null)
                                    },
                                    tag = "onboarding-selfie",
                                )
                            }
                            item {
                                OnboardingCheck(
                                    "Tôi đồng ý gửi tạm thời ảnh CCCD và selfie lên backend để so khớp. Ảnh không được lưu vào PostgreSQL.",
                                    termsAccepted, "onboarding-kyc-consent",
                                ) { termsAccepted = it }
                            }
                        } else {
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
                    }
                    5 -> if (!backendVerification) item {
                        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            Icon(Icons.Rounded.CheckCircle, null, Modifier.size(54.dp),
                                tint = MaterialTheme.colorScheme.primary)
                            Text("Hồ sơ chủ trọ đã sẵn sàng.",
                                style = MaterialTheme.typography.titleLarge)
                            Text("Bạn có thể tạo khu nhà và thêm phòng đầu tiên trong không gian quản lý.")
                        }
                    } else {
                        item {
                            Text("49.000đ mỗi tháng. QR SePay hiện bên dưới. Chuyển khoản đúng số tiền, rồi bấm Tôi đã chuyển khoản.",
                                style = MaterialTheme.typography.bodyMedium)
                        }
                        planPayUrl?.let { url ->
                            item {
                                AndroidView(
                                    factory = { webContext ->
                                        WebView(webContext).apply {
                                            settings.javaScriptEnabled = true
                                            settings.domStorageEnabled = true
                                            webViewClient = WebViewClient()
                                            loadUrl(url)
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth().height(520.dp).testTag("onboarding-plan-qr"),
                                )
                            }
                        }
                        if (planPaid) item {
                            Text("Gói đã được ghi nhận.", color = MaterialTheme.colorScheme.primary)
                        }
                    }
                    6 -> item {
                        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            Icon(Icons.Rounded.CheckCircle, null, Modifier.size(54.dp),
                                tint = MaterialTheme.colorScheme.primary)
                            Text(if (backendVerification) "Đã đạt kiểm tra tương đồng khuôn mặt." else "Hồ sơ chủ trọ đã sẵn sàng.",
                                style = MaterialTheme.typography.titleLarge)
                            Text(if (backendVerification) "Đây chưa phải xác minh CCCD chính thức. Bạn có thể mở không gian vận hành để tạo khu trọ bằng API thật." else "Bạn có thể tạo khu nhà và thêm phòng đầu tiên trong không gian quản lý.")
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
                selfie = null
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

/**
 * Static orientation aid for the *screen*, not a live-camera overlay.
 * Front illustration highlights the portrait; back illustration highlights the reverse.
 */
@Composable
private fun IdentityCardGuide(
    front: Boolean,
    bitmap: Bitmap?,
    busy: Boolean,
    onPick: () -> Unit,
    onCamera: () -> Unit,
    tag: String,
) {
    val cardShape = RoundedCornerShape(18.dp)
    val primary = MaterialTheme.colorScheme.primary
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth().testTag("onboarding-guide-" + if (front) "front" else "back"),
    ) {
        Column(
            Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(if (front) "MẶT TRƯỚC" else "MẶT SAU",
                color = primary, style = MaterialTheme.typography.labelLarge)
            Box(
                modifier = Modifier.fillMaxWidth().aspectRatio(1.586f)
                    .clip(cardShape)
                    .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = .5f))
                    .border(1.5.dp, primary.copy(alpha = .7f), cardShape)
                    .testTag(if (front) "onboarding-card-frame-front" else "onboarding-card-frame-back"),
                contentAlignment = Alignment.Center,
            ) {
                if (bitmap != null) {
                    Image(
                        bitmap.asImageBitmap(),
                        contentDescription = if (front) "Ảnh mặt trước CCCD đã chọn" else "Ảnh mặt sau CCCD đã chọn",
                        modifier = Modifier.fillMaxSize().padding(4.dp),
                        contentScale = ContentScale.Fit,
                    )
                } else {
                    Column(
                        Modifier.fillMaxWidth().padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text("CCCD  •  MINH HỌA",
                            color = primary, style = MaterialTheme.typography.labelSmall)
                        if (front) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Surface(
                                    color = primary.copy(alpha = .12f),
                                    shape = RoundedCornerShape(10.dp),
                                ) {
                                    Icon(
                                        Icons.Rounded.Person,
                                        "Vùng ảnh chân dung ở mặt trước",
                                        Modifier.size(72.dp).padding(12.dp),
                                        tint = primary,
                                    )
                                }
                                Column(
                                    Modifier.weight(1f),
                                    verticalArrangement = Arrangement.spacedBy(7.dp),
                                ) {
                                    Text("ẢNH CHÂN DUNG", style = MaterialTheme.typography.labelSmall, color = primary)
                                    Text("HỌ TÊN  •  NGÀY SINH",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = muted)
                                    HorizontalDivider(color = primary.copy(alpha = .25f))
                                    HorizontalDivider(color = primary.copy(alpha = .25f))
                                }
                            }
                        } else {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Surface(
                                    color = primary.copy(alpha = .12f),
                                    shape = RoundedCornerShape(10.dp),
                                ) {
                                    Icon(
                                        Icons.Rounded.QrCode2,
                                        "Minh họa vùng mã trên mặt sau",
                                        Modifier.size(72.dp).padding(12.dp),
                                        tint = primary,
                                    )
                                }
                                Column(
                                    Modifier.weight(1f),
                                    verticalArrangement = Arrangement.spacedBy(7.dp),
                                ) {
                                    Text("MÃ / THÔNG TIN MẶT SAU",
                                        style = MaterialTheme.typography.labelSmall, color = primary)
                                    HorizontalDivider(color = primary.copy(alpha = .25f))
                                    HorizontalDivider(color = primary.copy(alpha = .25f))
                                    HorizontalDivider(color = primary.copy(alpha = .25f))
                                }
                            }
                        }
                        Text("Đặt đủ 4 góc của thẻ trong khung",
                            style = MaterialTheme.typography.labelSmall, color = muted)
                    }
                }
            }
            Text(if (bitmap == null) "Đủ sáng • Không lóa • Không mất góc"
                 else "Ảnh đã chọn • Kiểm tra độ rõ nét trước khi tiếp tục",
                style = MaterialTheme.typography.bodySmall, color = muted)
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                TroOiButton(
                    "Chụp ảnh", onCamera,
                    Modifier.weight(1f).testTag("$tag-camera"),
                    enabled = !busy,
                )
                TroOiButton(
                    if (bitmap == null) "Chọn ảnh" else "Đổi ảnh",
                    onPick,
                    Modifier.weight(1f).testTag(tag),
                    enabled = !busy,
                    style = TroOiButtonStyle.SECONDARY,
                )
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

/** Bound transient JPEG memory before passing images to the authenticated API. */
private fun encodeKycBitmap(bitmap: Bitmap): ByteArray {
    val output = java.io.ByteArrayOutputStream()
    require(bitmap.compress(Bitmap.CompressFormat.JPEG, 80, output)) { "Không chuyển được ảnh sang JPEG." }
    return output.toByteArray().also {
        require(it.size in 100..1_500_000) { "Ảnh quá lớn. Hãy thử ảnh nhỏ hơn 1,5 MB." }
    }
}
