package com.trooi.app.features.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import com.trooi.app.ui.components.TroOiFormField
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.trooi.app.ui.components.TroOiConfirmDialog
import com.trooi.app.ui.components.TroOiButton
import com.trooi.app.ui.components.TroOiButtonStyle
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Stable
class ContactOtpForm(initial: EmailOtpState) {
    var state by mutableStateOf(initial)
    var code by mutableStateOf("")
    var unavailable by mutableStateOf(false)
    var submitError by mutableIntStateOf(0)
    fun change(contact: String) {
        val changed = state.changedEmail(contact)
        if (changed != state) { state = changed; code = "" }
    }
    // A fixture validation is never an authorization token for a protected backend write.
    fun validateOnSubmit(contact: String, mockMode: Boolean): Boolean {
        change(contact)
        if (!mockMode || !MockEmailOtp.available) { unavailable = true; return false }
        val challenge = if (state.status == EmailOtpStatus.VERIFIED) state.copy(status = EmailOtpStatus.SENT) else state
        val result = challenge.verify(code, System.currentTimeMillis(), MockEmailOtp.code)
        val valid = result.status == EmailOtpStatus.VERIFIED
        state = if (valid) result.copy(status = EmailOtpStatus.SENT) else result
        if (!valid) submitError++
        return valid
    }
}
private val formSaver = listSaver<ContactOtpForm, Any>(
    save = { with(it.state) { listOf(email, status.name, expiresAt, resendAt, attempts, error) } },
    restore = { ContactOtpForm(EmailOtpState(it[0] as String, EmailOtpStatus.valueOf(it[1] as String), it[2] as Long, it[3] as Long, it[4] as Int, it[5] as String)) },
)
@Composable
fun rememberContactOtpForm(contact: String): ContactOtpForm = rememberSaveable(saver = formSaver) { ContactOtpForm(EmailOtpState(contact.trim())) }

@Composable
fun EmailOtpPanel(email: String, mockMode: Boolean, onValueChange: (String) -> Unit = {}, phone: Boolean = false,
    form: ContactOtpForm = rememberContactOtpForm(email), allowSend: Boolean = true) {
    val state = form.state
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    val scope = rememberCoroutineScope()
    val focus = remember { FocusRequester() }
    val contactFocus = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current
    val mock = allowSend && mockMode && MockEmailOtp.available
    val valid = if (phone) !email.contains('@') && isValidIdentifier(email) else isValidEmail(email)
    LaunchedEffect(email, mock) { form.change(email); if (!mock) { form.state = EmailOtpState(email.trim()); form.code = "" } }
    LaunchedEffect(Unit) {
        if (form.state.status == EmailOtpStatus.SENDING) form.state = EmailOtpState(email.trim())
        if (form.state.status == EmailOtpStatus.VERIFYING) form.state = form.state.copy(status = EmailOtpStatus.SENT)
    }
    LaunchedEffect(state.resendAt, state.expiresAt) {
        while (true) { now = System.currentTimeMillis(); form.state = form.state.expired(now); delay(1000) }
    }
    LaunchedEffect(state.status) { if (state.status == EmailOtpStatus.SENT) focus.requestFocus() }
    LaunchedEffect(form.submitError) {
        if (form.submitError > 0) {
            focusManager.clearFocus()
            if (form.state.expiresAt > 0L) focus.requestFocus() else contactFocus.requestFocus()
        }
    }
    fun send() {
        if (!mock) { form.unavailable = true; return }
        if (!form.state.canResend(System.currentTimeMillis())) return
        val sending = form.state.copy(status = EmailOtpStatus.SENDING, error = "")
        form.state = sending
        scope.launch {
            delay(400)
            if (form.state === sending) {
                form.code = ""; form.state = form.state.sent(System.currentTimeMillis())
            }
        }
    }
    if (form.unavailable) TroOiConfirmDialog(
        onDismissRequest = { form.unavailable = false }, title = "Hiện chưa khả dụng",
        text = "Chưa thể xác minh $email. Vui lòng thử lại sau; thông tin của bạn chưa được thay đổi.",
        confirmLabel = "Đã hiểu", onConfirm = { form.unavailable = false }, dismissLabel = null,
    )
    Column(Modifier.fillMaxWidth().testTag("email-otp-panel"), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        TroOiFormField(email, { form.change(it); onValueChange(it) }, label = { Text(if (phone) "Số điện thoại" else "Email") },
            modifier = Modifier.fillMaxWidth().focusRequester(contactFocus).testTag("verification-contact-input"), singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = if (phone) KeyboardType.Phone else KeyboardType.Email),
            isError = state.expiresAt == 0L && state.error.isNotEmpty(),
            supportingText = { if (state.expiresAt == 0L && state.error.isNotEmpty()) Text(state.error) },
            trailingIcon = { TroOiButton(if (state.status == EmailOtpStatus.SENDING) "Đang gửi" else "Gửi mã", ::send,
                enabled = allowSend && valid && state.expiresAt == 0L && state.status != EmailOtpStatus.SENDING,
                modifier = Modifier.testTag("otp-send"), style = TroOiButtonStyle.TERTIARY) })
        if (state.status == EmailOtpStatus.SENDING) LinearProgressIndicator(Modifier.fillMaxWidth())
        if (state.expiresAt > 0L) {
            val seconds = ((state.resendAt - now + 999) / 1000).coerceAtLeast(0)
            TroOiFormField(form.code, { form.code = it.filter { c -> c in '0'..'9' }.take(6) }, label = { Text("Mã OTP 6 chữ số") },
                modifier = Modifier.fillMaxWidth().focusRequester(focus).testTag("email-otp-input"),
                singleLine = true, isError = state.error.isNotEmpty(),
                trailingIcon = { TroOiButton(if (seconds > 0) "Gửi lại (${seconds}s)" else "Gửi lại", ::send,
                    enabled = state.canResend(now), modifier = Modifier.testTag("otp-resend"), style = TroOiButtonStyle.TERTIARY) },
                supportingText = { if (state.error.isNotEmpty()) Text(state.error) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() }))
        }
    }
}
