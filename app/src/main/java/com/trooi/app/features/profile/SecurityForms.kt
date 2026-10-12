package com.trooi.app.features.profile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.*
import com.trooi.app.ui.components.TroOiFormField
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.trooi.app.ui.components.TroOiActionDialog
import com.trooi.app.ui.components.TroOiButton
import com.trooi.app.ui.components.TroOiButtonStyle
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
internal fun SecretField(value: String, onChange: (String) -> Unit, label: String, pin: Boolean = false, error: String = "", enabled: Boolean = true) {
    var visible by remember { mutableStateOf(false) }
    TroOiFormField(value, { onChange(if (pin) it.filter { c -> c in '0'..'9' }.take(6) else it) },
        label = { Text(label) }, modifier = Modifier.fillMaxWidth(), singleLine = true, enabled = enabled,
        visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = if (pin) KeyboardType.NumberPassword else KeyboardType.Password),
        trailingIcon = { IconButton({ visible = !visible }) { Icon(if (visible) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility,
            if (visible) "Ẩn $label" else "Hiện $label") } }, isError = error.isNotEmpty(),
        supportingText = { if (error.isNotEmpty()) Text(error) })
}

@Composable
internal fun ReauthenticationDialog(userId: String, method: ReauthenticationMethod, onDismiss: () -> Unit,
    onRecovery: () -> Unit, onChecked: () -> Unit, retry: SecurityRetry, onRetry: (SecurityRetry) -> Unit) {
    var secret by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(retry.retryAt) { while (true) { now = System.currentTimeMillis(); delay(1000) } }
    TroOiActionDialog(onDismissRequest = { if (!busy) onDismiss() }, title = { Text("Xác thực bảo mật") },
        text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Xác thực trước khi chỉnh sửa hoặc thực hiện thao tác nhạy cảm.")
            Text("Mô phỏng xác thực trên dữ liệu mẫu.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            SecretField(secret, { secret = it; error = "" }, if (method == ReauthenticationMethod.PIN) "Mã PIN bảo mật" else "Mật khẩu hiện tại",
                pin = method == ReauthenticationMethod.PIN, error = error, enabled = !busy)
            if (!retry.canTry(now)) Text("Thử lại sau ${((retry.retryAt - now + 999) / 1000).coerceAtLeast(0)} giây.")
            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            TroOiButton(if (method == ReauthenticationMethod.PIN) "Quên mã PIN" else "Quên mật khẩu hiện tại", { if (!busy) onRecovery() }, enabled = !busy, style = TroOiButtonStyle.TERTIARY)
        } }, confirmButton = { TroOiButton("Tiếp tục", {
            val submitted = secret
            busy = true
            scope.launch {
                delay(400)
                if (MockAccountSecurity.matches(userId, method, submitted)) { secret = ""; onChecked() }
                else { onRetry(retry.failed(System.currentTimeMillis())); error = if (method == ReauthenticationMethod.PIN) "Mã PIN không đúng." else "Mật khẩu hiện tại không đúng." }
                busy = false
            }
        }, enabled = !busy && retry.canTry(now) && (if (method == ReauthenticationMethod.PIN) validSecurityPin(secret) else secret.isNotBlank()), busy = busy, modifier = Modifier.testTag("reauth-confirm")) },
        dismissButton = { TroOiButton("Hủy", onDismiss, enabled = !busy, style = TroOiButtonStyle.SECONDARY) })
}

@Composable
internal fun PinForm(configured: Boolean?, onStartEditing: (() -> Unit) -> Unit, onDirty: (Boolean) -> Unit, onSubmit: () -> Unit, onRecovery: () -> Unit) {
    var editing by remember { mutableStateOf(false) }
    var pin by remember { mutableStateOf("") }
    var repeat by remember { mutableStateOf("") }
    LaunchedEffect(pin, repeat) { onDirty(pin.isNotEmpty() || repeat.isNotEmpty()) }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(when (configured) { true -> "Đã thiết lập mã PIN bảo mật"; false -> "Chưa thiết lập mã PIN bảo mật"; null -> "Chưa thể kiểm tra trạng thái mã PIN" }, style = MaterialTheme.typography.titleMedium)
        Text("Mã PIN gồm 6 chữ số, dùng để xác thực các thay đổi tài khoản và thao tác nhạy cảm.")
        if (editing) {
            SecretField(pin, { pin = it }, "Mã PIN mới", pin = true)
            SecretField(repeat, { repeat = it }, "Nhập lại mã PIN", pin = true, error = if (repeat.isNotEmpty() && repeat != pin) "Hai mã PIN chưa khớp." else "")
            TroOiButton(if (configured == true) "Thay đổi mã PIN" else "Tạo mã PIN", onSubmit,
                enabled = validSecurityPin(pin) && pin == repeat, modifier = Modifier.fillMaxWidth())
        } else TroOiButton(if (configured == true) "Thay đổi mã PIN" else "Tạo mã PIN", { onStartEditing { editing = true } }, modifier = Modifier.fillMaxWidth())
        TroOiButton("Quên mã PIN", onRecovery, style = TroOiButtonStyle.TERTIARY)
    }
}

@Composable
internal fun PasswordForm(userId: String, mockMode: Boolean, retry: SecurityRetry, onRetry: (SecurityRetry) -> Unit,
    onDirty: (Boolean) -> Unit, onSubmit: () -> Unit, onRecovery: () -> Unit) {
    var current by remember(userId) { mutableStateOf("") }
    var currentError by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var repeat by remember { mutableStateOf("") }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(retry.retryAt) { while (true) { now = System.currentTimeMillis(); delay(1000) } }
    LaunchedEffect(current, password, repeat) { onDirty(current.isNotEmpty() || password.isNotEmpty() || repeat.isNotEmpty()) }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SecretField(current, { current = it; currentError = "" }, "Mật khẩu hiện tại", error = currentError)
        SecretField(password, { password = it }, "Mật khẩu mới", error = if (password.isNotEmpty() && password.length < 8) "Mật khẩu cần ít nhất 8 ký tự." else "")
        SecretField(repeat, { repeat = it }, "Nhập lại mật khẩu", error = if (repeat.isNotEmpty() && repeat != password) "Mật khẩu nhập lại chưa khớp." else "")
        TroOiButton("Đổi mật khẩu", {
            if (mockMode && MockAccountSecurity.method(userId) in listOf(ReauthenticationMethod.PIN, ReauthenticationMethod.PASSWORD) && !MockAccountSecurity.matches(userId, ReauthenticationMethod.PASSWORD, current)) {
                onRetry(retry.failed(System.currentTimeMillis())); currentError = "Mật khẩu hiện tại không đúng."
            }
            else onSubmit()
        }, enabled = retry.canTry(now) && current.isNotBlank() && password.length >= 8 && password == repeat && current != password, modifier = Modifier.fillMaxWidth())
        if (!retry.canTry(now)) Text("Thử lại sau ${((retry.retryAt - now + 999) / 1000).coerceAtLeast(0)} giây.")
        TroOiButton("Quên mật khẩu hiện tại", onRecovery, style = TroOiButtonStyle.TERTIARY)
    }
}
