package com.trooi.app.features.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trooi.app.core.network.BackendApi
import com.trooi.app.core.network.dto.ApiOutcome
import com.trooi.app.core.network.dto.EmailOtpChallengeTransport
import com.trooi.app.core.network.dto.SessionContextTransport
import com.trooi.app.ui.components.TroOiButton
import com.trooi.app.ui.components.TroOiFormField
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay

internal enum class EmailChangeStep { CURRENT_EMAIL, NEW_EMAIL }

internal data class EmailChangeState(
    val challenge: EmailOtpChallengeTransport? = null,
    val busy: Boolean = false,
    val error: String? = null,
    val changedEmail: String? = null,
    val step: EmailChangeStep = EmailChangeStep.CURRENT_EMAIL,
    val oldEmailNoticeSent: Boolean? = null,
)

@HiltViewModel
internal class BackendEmailChangeModel @Inject constructor(private val backend: BackendApi) : ViewModel() {
    private val mutable = MutableStateFlow(EmailChangeState())
    val state = mutable.asStateFlow()

    fun clearSuccess() = mutable.update { it.copy(
        challenge = null, changedEmail = null, error = null,
        step = EmailChangeStep.CURRENT_EMAIL, oldEmailNoticeSent = null,
    ) }

    fun request(email: String) {
        if (mutable.value.busy) return
        mutable.update { it.copy(busy = true, error = null, changedEmail = null) }
        viewModelScope.launch {
            when (val result = backend.requestEmailChangeOtp(email.trim())) {
                is ApiOutcome.Data -> mutable.update { it.copy(
                    challenge = result.value, busy = false, step = EmailChangeStep.CURRENT_EMAIL,
                    changedEmail = null, oldEmailNoticeSent = null,
                ) }
                is ApiOutcome.Failure -> mutable.update { it.copy(busy = false, error = when (result.httpStatus) {
                    400 -> "Email mới không hợp lệ hoặc đang được sử dụng."
                    403 -> "Hãy thiết lập mật khẩu tài khoản trước khi đổi email."
                    409 -> "Email này đã thuộc tài khoản khác."
                    429 -> "Bạn vừa yêu cầu mã. Vui lòng chờ trước khi gửi lại."
                    else -> "Không thể gửi mã xác minh email. Hãy thử lại."
                }) }
            }
        }
    }

    fun verify(code: String, expectedUserId: String, onSessionUpdated: suspend (SessionContextTransport) -> Result<Unit>) {
        val challenge = mutable.value.challenge ?: return
        if (mutable.value.busy || !code.matches(Regex("^[0-9]{6}$"))) return
        mutable.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            when (val result = backend.verifyEmailChangeOtp(challenge.otpChallengeId, code)) {
                is ApiOutcome.Failure -> mutable.update { it.copy(busy = false, error = when (result.httpStatus) {
                    401 -> "Mã xác minh không đúng hoặc đã hết hạn."
                    409 -> "Thông tin email đã thay đổi. Hãy yêu cầu mã mới."
                    429 -> "Thử quá nhiều lần. Vui lòng chờ trước khi thử lại."
                    else -> "Không thể xác minh email. Hãy thử lại."
                }) }
                is ApiOutcome.Data -> {
                    val changed = result.value
                    if (!changed.emailChanged) {
                        if (changed.nextStep != "NEW_EMAIL") {
                            mutable.update { it.copy(busy = false, error = "Phản hồi bước xác minh email không hợp lệ.") }
                            return@launch
                        }
                        val nextChallenge = challenge.copy(
                            resendAvailableAt = changed.resendAvailableAt ?: challenge.resendAvailableAt,
                        )
                        mutable.update { it.copy(
                            challenge = nextChallenge, step = EmailChangeStep.NEW_EMAIL,
                            busy = false, error = null,
                        ) }
                        return@launch
                    }
                    if (changed.email.isNullOrBlank()) {
                        mutable.update { it.copy(busy = false, error = "Backend chưa trả email đã xác minh.") }
                        return@launch
                    }
                    when (val session = backend.getSessionContext()) {
                        is ApiOutcome.Failure -> mutable.update { it.copy(
                            busy = false, changedEmail = changed.email,
                            oldEmailNoticeSent = changed.oldEmailNoticeSent ?: true,
                            error = "Email đã đổi; không thể đồng bộ phiên. Hãy tải lại tài khoản.",
                        ) }
                        is ApiOutcome.Data -> {
                            if (session.value.userId != expectedUserId || !session.value.email.equals(changed.email, ignoreCase = true)) {
                                mutable.update { it.copy(
                                    busy = false, changedEmail = changed.email,
                                    oldEmailNoticeSent = changed.oldEmailNoticeSent ?: true,
                                    error = "Phiên tài khoản chưa đồng bộ với email mới.",
                                ) }
                                return@launch
                            }
                            onSessionUpdated(session.value).fold(
                                onSuccess = { mutable.update { it.copy(
                                    busy = false, changedEmail = changed.email, challenge = null,
                                    oldEmailNoticeSent = changed.oldEmailNoticeSent ?: true,
                                ) } },
                                onFailure = { cause -> mutable.update { it.copy(busy = false, changedEmail = changed.email, error = cause.message ?: "Không thể đồng bộ phiên tài khoản.") } },
                            )
                        }
                    }
                }
            }
        }
    }

    fun retrySync(expectedUserId: String, onSessionUpdated: suspend (SessionContextTransport) -> Result<Unit>) {
        val expectedEmail = mutable.value.changedEmail ?: return
        if (mutable.value.busy) return
        mutable.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            when (val session = backend.getSessionContext()) {
                is ApiOutcome.Failure -> mutable.update { it.copy(busy = false, error = "Không thể tải lại phiên tài khoản.") }
                is ApiOutcome.Data -> {
                    if (session.value.userId != expectedUserId || !session.value.email.equals(expectedEmail, ignoreCase = true)) {
                        mutable.update { it.copy(busy = false, error = "Phiên tài khoản vẫn chưa khớp email mới.") }
                        return@launch
                    }
                    onSessionUpdated(session.value).fold(
                        onSuccess = { mutable.update { it.copy(busy = false, error = null) } },
                        onFailure = { cause -> mutable.update { it.copy(busy = false, error = cause.message ?: "Không thể đồng bộ phiên tài khoản.") } },
                    )
                }
            }
        }
    }
}

@Composable
internal fun BackendEmailChangeForm(
    userId: String,
    currentEmail: String,
    onBack: () -> Unit,
    onSessionUpdated: suspend (SessionContextTransport) -> Result<Unit>,
    model: BackendEmailChangeModel = hiltViewModel(key = "email-change-$userId"),
) {
    val state by model.state.collectAsStateWithLifecycle()
    var email by remember(userId, currentEmail) { mutableStateOf(currentEmail) }
    var code by remember(userId) { mutableStateOf("") }
    val challenge = state.challenge
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(challenge?.resendAvailableAt, challenge?.expiresAt) {
        while (challenge != null && (
            System.currentTimeMillis() < java.time.Instant.parse(challenge.resendAvailableAt).toEpochMilli() ||
                System.currentTimeMillis() < java.time.Instant.parse(challenge.expiresAt).toEpochMilli()
        )) {
            now = System.currentTimeMillis()
            delay(1000)
        }
        now = System.currentTimeMillis()
    }
    LaunchedEffect(state.step) { code = "" }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TroOiFormField(email, { email = it }, label = { Text("Email mới") }, modifier = Modifier.fillMaxWidth(), singleLine = true, enabled = !state.busy && challenge == null)
        if (challenge == null) {
            TroOiButton("Gửi mã xác minh", { model.request(email) },
                enabled = !state.busy && email.trim().matches(Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) && !email.equals(currentEmail, ignoreCase = true),
                busy = state.busy, modifier = Modifier.fillMaxWidth())
        } else {
            val destination = if (state.step == EmailChangeStep.CURRENT_EMAIL) "email hiện tại $currentEmail" else "email mới"
            Text(if (state.step == EmailChangeStep.CURRENT_EMAIL)
                "Bước 1/2: Nhập mã 6 chữ số đã gửi tới $destination."
            else "Bước 2/2: Email hiện tại đã xác minh. Nhập mã vừa gửi tới $destination.")
            TroOiFormField(code, { code = it.filter(Char::isDigit).take(6) }, label = { Text("Mã xác minh") }, modifier = Modifier.fillMaxWidth(), singleLine = true, enabled = !state.busy)
            val expired = now >= java.time.Instant.parse(challenge.expiresAt).toEpochMilli()
            if (expired) Text("Mã đã hết hạn. Hãy gửi lại mã.", color = MaterialTheme.colorScheme.error)
            TroOiButton(
                if (state.step == EmailChangeStep.CURRENT_EMAIL) "Xác minh email hiện tại" else "Xác minh và đổi email",
                { model.verify(code, userId, onSessionUpdated) },
                enabled = !state.busy && !expired && code.length == 6, busy = state.busy, modifier = Modifier.fillMaxWidth(),
            )
            val wait = ((java.time.Instant.parse(challenge.resendAvailableAt).toEpochMilli() - now) / 1000).coerceAtLeast(0)
            Text(if (wait > 0) "Bạn có thể gửi lại mã sau ${wait}s." else "Nếu chưa nhận được mã, hãy yêu cầu mã mới.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (wait == 0L) TroOiButton("Gửi mã mới", { model.request(email) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth())
        }
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        state.changedEmail?.takeIf { state.error != null }?.let { Text("Email hiện đã xác minh: $it", color = MaterialTheme.colorScheme.primary) }
        if (state.changedEmail != null && state.error != null) TroOiButton("Tải lại phiên tài khoản", {
            model.retrySync(userId, onSessionUpdated)
        }, enabled = !state.busy, busy = state.busy, modifier = Modifier.fillMaxWidth())
        if (state.changedEmail != null && state.oldEmailNoticeSent == false) {
            Text("Email đã đổi, nhưng hệ thống không gửi được thông báo tới email cũ.", color = MaterialTheme.colorScheme.error)
            if (state.error == null) TroOiButton("Quay lại", { model.clearSuccess(); onBack() }, modifier = Modifier.fillMaxWidth())
        }
        if (state.busy) CircularProgressIndicator()
        state.changedEmail?.takeIf { state.error == null && state.oldEmailNoticeSent != false }?.let {
            Text("Đã đổi email đăng nhập: $it", color = MaterialTheme.colorScheme.primary)
        }
    }
    LaunchedEffect(state.changedEmail, state.error, state.oldEmailNoticeSent) {
        if (state.changedEmail != null && state.error == null && state.oldEmailNoticeSent != false) {
            model.clearSuccess()
            onBack()
        }
    }
}
