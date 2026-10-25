package com.trooi.app.features.profile

import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.trooi.app.core.network.BackendClient
import com.trooi.app.core.network.dto.BackendJsonCodec
import com.trooi.app.core.network.dto.TransportOutcome
import com.trooi.app.features.messages.prepareMessagePhoto
import com.trooi.app.ui.components.TroOiButton
import com.trooi.app.ui.components.TroOiButtonStyle
import com.trooi.app.ui.components.TroOiInlineAction
import dagger.hilt.android.lifecycle.HiltViewModel
import java.io.ByteArrayOutputStream
import java.util.Base64
import javax.inject.Inject
import kotlinx.coroutines.launch

private const val AUTO_KYC_CONSENT = "kyc-auto-v1"
private const val MAX_PHOTO_BYTES = 1_500_000

internal data class AutoKycReceipt(val status: String, val checkedAt: String, val assurance: String)

@HiltViewModel
class AutoKycViewModel @Inject constructor(private val client: BackendClient) : ViewModel() {
    var busy by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    internal var receipt by mutableStateOf<AutoKycReceipt?>(null)
        private set

    fun load() {
        if (busy) return
        viewModelScope.launch {
            busy = true
            try {
                val outcome = client.get("identity-verification/me", authenticated = true)
                receipt = if (outcome is TransportOutcome.Success) decodeReceipt(outcome.document.rawBody)
                else error("Không đọc được trạng thái xác minh từ Backend.")
                error = null
            } catch (problem: Exception) {
                error = problem.message ?: "Không tải được trạng thái."
            } finally {
                busy = false
            }
        }
    }

    fun submit(front: ByteArray, back: ByteArray, selfie: ByteArray) {
        if (busy) return
        if (listOf(front, back, selfie).any { it.size !in 100..MAX_PHOTO_BYTES }) {
            error = "Mỗi ảnh JPG phải nhỏ hơn 1,5 MB."
            return
        }
        viewModelScope.launch {
            busy = true
            error = null
            try {
                val request = JsonObject().apply {
                    addProperty("consent", true)
                    addProperty("consentVersion", AUTO_KYC_CONSENT)
                    addProperty("frontImageBase64", Base64.getEncoder().encodeToString(front))
                    addProperty("backImageBase64", Base64.getEncoder().encodeToString(back))
                    addProperty("selfieImageBase64", Base64.getEncoder().encodeToString(selfie))
                }
                val result = client.postJson("identity-verification/auto-check", request.toString(), authenticated = true)
                when (result) {
                    is TransportOutcome.Success -> {
                        receipt = decodeReceipt(result.document.rawBody)
                            ?: error("Backend không trả kết quả xác minh.")
                    }
                    is TransportOutcome.Failure -> {
                        error = when (result.httpStatus) {
                            503 -> "Hệ thống so khớp khuôn mặt chưa sẵn sàng; ảnh chưa được xác nhận."
                            429 -> "Bạn đã hết lượt kiểm tra trong 24 giờ."
                            401 -> "Phiên đăng nhập hết hạn. Hãy đăng nhập lại."
                            else -> "Không gửi được hồ sơ: HTTP ${result.httpStatus ?: result.kind}."
                        }
                    }
                }
            } catch (problem: Exception) {
                error = problem.message ?: "Không thể gửi hồ sơ."
            } finally {
                busy = false
            }
        }
    }

    /** Await a real backend result before leaving the landlord onboarding wizard. */
    suspend fun verifyForOnboarding(front: ByteArray, back: ByteArray, selfie: ByteArray): Result<Unit> {
        if (busy) return Result.failure(IllegalStateException("Đang kiểm tra hồ sơ."))
        if (listOf(front, back, selfie).any { it.size !in 100..MAX_PHOTO_BYTES }) {
            return Result.failure(IllegalArgumentException("Mỗi ảnh JPEG phải nhỏ hơn 1,5 MB."))
        }
        busy = true
        error = null
        return try {
            val request = JsonObject().apply {
                addProperty("consent", true)
                addProperty("consentVersion", AUTO_KYC_CONSENT)
                addProperty("frontImageBase64", Base64.getEncoder().encodeToString(front))
                addProperty("backImageBase64", Base64.getEncoder().encodeToString(back))
                addProperty("selfieImageBase64", Base64.getEncoder().encodeToString(selfie))
            }
            when (val outcome = client.postJson("identity-verification/auto-check", request.toString(), authenticated = true)) {
                is TransportOutcome.Success -> {
                    val result = decodeReceipt(outcome.document.rawBody)
                        ?: return Result.failure(IllegalStateException("Backend không trả kết quả kiểm tra."))
                    receipt = result
                    if (result.status == "AUTO_CHECK_PASSED") Result.success(Unit)
                    else Result.failure(IllegalStateException("Ảnh chưa đạt mức tương đồng khuôn mặt. Vui lòng thử lại."))
                }
                is TransportOutcome.Failure -> Result.failure(IllegalStateException(when (outcome.httpStatus) {
                    401 -> "Phiên đăng nhập không hợp lệ; vui lòng đăng nhập lại."
                    429 -> "Đã hết lượt kiểm tra trong 24 giờ."
                    503 -> "Dịch vụ so khớp khuôn mặt chưa sẵn sàng."
                    else -> "Không gửi được kiểm tra tự động (HTTP ${outcome.httpStatus ?: outcome.kind})."
                }))
            }
        } catch (failure: Exception) {
            Result.failure(failure)
        } finally {
            busy = false
        }
    }

    private fun decodeReceipt(response: String): AutoKycReceipt? {
        val content = JsonParser.parseString(BackendJsonCodec.unwrapResponseData(response))
        if (content.isJsonNull) return null
        val obj = content.asJsonObject
        return AutoKycReceipt(
            status = obj.get("state").asString,
            checkedAt = obj.get("checkedAt").asString,
            assurance = obj.get("assurance").asString,
        )
    }
}

@Composable
internal fun AutoKycForm(
    userId: String,
    model: AutoKycViewModel = hiltViewModel(key = "auto-kyc-$userId"),
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var front by remember(userId) { mutableStateOf<ByteArray?>(null) }
    var back by remember(userId) { mutableStateOf<ByteArray?>(null) }
    var selfie by remember(userId) { mutableStateOf<ByteArray?>(null) }
    var selected by remember { mutableStateOf("front") }
    var agreed by remember(userId) { mutableStateOf(false) }
    var pickerError by remember { mutableStateOf<String?>(null) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri: Uri? ->
        if (uri != null) scope.launch {
            runCatching {
                val photo = prepareMessagePhoto(context, uri)
                require(photo.bytes.size <= MAX_PHOTO_BYTES) { "Ảnh quá lớn, vui lòng chọn ảnh nhỏ hơn." }
                photo.bytes
            }.onSuccess { bytes ->
                when (selected) {
                    "front" -> front = bytes
                    "back" -> back = bytes
                    "selfie" -> selfie = bytes
                }
                pickerError = null
            }.onFailure { pickerError = it.message ?: "Không đọc được ảnh." }
        }
    }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap: Bitmap? ->
        if (bitmap != null) {
            val buffer = ByteArrayOutputStream()
            if (bitmap.compress(Bitmap.CompressFormat.JPEG, 82, buffer) &&
                buffer.size() in 100..MAX_PHOTO_BYTES) {
                selfie = buffer.toByteArray()
                pickerError = null
            } else pickerError = "Selfie không hợp lệ; vui lòng thử lại."
        }
    }
    LaunchedEffect(userId) { model.load() }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.testTag("auto-kyc-form")) {
        Text("Kiểm tra CCCD và selfie tự động", style = MaterialTheme.typography.titleMedium)
        Text("Chụp hai mặt CCCD và selfie rõ mặt. TrọƠi chỉ lưu kết quả so khớp, không lưu ảnh CCCD hoặc selfie thô vào PostgreSQL.",
            style = MaterialTheme.typography.bodyMedium)
        Text("Đây là kiểm tra mức độ tương đồng khuôn mặt, không xác thực tính thật giả của CCCD hoặc tính sống của selfie.",
            color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        TroOiButton(if (front == null) "Chọn mặt trước CCCD" else "✓ Đã chọn mặt trước CCCD",
            { selected = "front"; picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
            style = TroOiButtonStyle.SECONDARY, modifier = Modifier.fillMaxWidth().testTag("kyc-front"))
        TroOiButton(if (back == null) "Chọn mặt sau CCCD" else "✓ Đã chọn mặt sau CCCD",
            { selected = "back"; picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
            style = TroOiButtonStyle.SECONDARY, modifier = Modifier.fillMaxWidth().testTag("kyc-back"))
        TroOiButton(if (selfie == null) "Chọn ảnh selfie" else "✓ Đã có ảnh selfie",
            { selected = "selfie"; picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
            style = TroOiButtonStyle.SECONDARY, modifier = Modifier.fillMaxWidth().testTag("kyc-selfie"))
        TroOiInlineAction(onClick = { camera.launch(null) }, modifier = Modifier.fillMaxWidth()) {
            Text("Hoặc chụp selfie bằng camera")
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Checkbox(checked = agreed, onCheckedChange = { agreed = it })
            Text("Tôi đồng ý gửi tạm thời ba ảnh qua kết nối Backend để kiểm tra tự động; hiểu giới hạn của phép so khớp và chỉ lưu kết quả.",
                style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
        }
        pickerError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        model.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        model.receipt?.let { status ->
            Text(when (status.status) {
                "AUTO_CHECK_PASSED" -> "Đã đạt kiểm tra so khớp khuôn mặt tự động. Đây chưa phải xác thực giấy tờ chính thức."
                "NEEDS_RETRY" -> "Ảnh chưa đạt mức so khớp, bạn có thể thử lại."
                else -> "Trạng thái: ${status.status}"
            }, color = MaterialTheme.colorScheme.primary)
        }
        if (model.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        TroOiButton("Gửi kiểm tra tự động", {
            model.submit(requireNotNull(front), requireNotNull(back), requireNotNull(selfie))
            front = null
            back = null
            selfie = null
            agreed = false
        }, enabled = !model.busy && agreed && front != null && back != null && selfie != null,
            modifier = Modifier.fillMaxWidth().testTag("kyc-submit"))
    }
}
