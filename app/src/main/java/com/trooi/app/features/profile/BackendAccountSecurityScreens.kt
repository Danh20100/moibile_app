package com.trooi.app.features.profile

import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trooi.app.core.auth.GoogleCredentialAuth
import com.trooi.app.core.network.BackendApi
import com.trooi.app.core.network.dto.ApiOutcome
import com.trooi.app.core.network.dto.AccountSecurityStatusTransport
import com.trooi.app.ui.components.TroOiButton
import com.trooi.app.ui.components.TroOiInformationRow
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

internal data class AccountSecuritySettingsState(
    val details: AccountSecurityStatusTransport? = null,
    val busy: Boolean = false,
    val error: String? = null,
    val changed: Boolean = false,
    val successMessage: String? = null,
)

@HiltViewModel
internal class AccountSecuritySettingsModel @Inject constructor(
    private val backend: BackendApi,
    private val googleCredentialAuth: GoogleCredentialAuth,
) : ViewModel() {
    private val mutableState = MutableStateFlow(AccountSecuritySettingsState())
    val state = mutableState.asStateFlow()

    fun load() = viewModelScope.launch {
        when (val result = backend.getAccountSecurityStatus()) {
            is ApiOutcome.Data -> mutableState.update { it.copy(details = result.value, error = null) }
            is ApiOutcome.Failure -> mutableState.update { it.copy(error = "Không thể tải thông tin bảo mật.") }
        }
    }

    fun changePassword(current: String, next: String) {
        if (mutableState.value.busy) return
        mutableState.update { it.copy(busy = true, error = null, changed = false, successMessage = null) }
        viewModelScope.launch {
            when (val result = backend.changePassword(current, next)) {
                is ApiOutcome.Data -> mutableState.update {
                    it.copy(busy = false, changed = result.value.changed,
                        error = if (result.value.changed) null else "Không thể đổi mật khẩu.",
                        successMessage = if (result.value.changed) "Đã đổi mật khẩu." else null)
                }
                is ApiOutcome.Failure -> mutableState.update { it.copy(busy = false, error = when (result.httpStatus) {
                    403 -> "Mật khẩu hiện tại không đúng."
                    429 -> "Thử quá nhiều lần. Vui lòng thử lại sau."
                    else -> "Không thể đổi mật khẩu."
                }) }
            }
        }
    }

    fun setupInitialPassword(context: Context, password: String) {
        val details = mutableState.value.details ?: return
        if (mutableState.value.busy || details.passwordConfigured || !details.googleLinked) return
        mutableState.update { it.copy(busy = true, error = null, changed = false, successMessage = null) }
        viewModelScope.launch {
            val challenge = when (val result = backend.issueInitialPasswordSetupChallenge()) {
                is ApiOutcome.Data -> result.value
                is ApiOutcome.Failure -> {
                    mutableState.update { it.copy(busy = false, error = "Không thể bắt đầu xác thực Google.") }
                    return@launch
                }
            }
            val nonce = challenge.nonce?.takeIf(String::isNotBlank)
            if (nonce == null) {
                mutableState.update { it.copy(busy = false, error = "Không thể bắt đầu xác thực Google.") }
                return@launch
            }
            val idToken = googleCredentialAuth.reacquireForReauthentication(context, nonce).getOrElse {
                mutableState.update { it.copy(busy = false, error = "Không thể xác thực lại với Google.") }
                return@launch
            }
            when (val result = backend.setInitialPassword(idToken, nonce, password)) {
                is ApiOutcome.Data -> mutableState.update {
                    it.copy(
                        details = it.details?.copy(passwordConfigured = result.value.configured),
                        busy = false,
                        changed = result.value.configured,
                        error = if (result.value.configured) null else "Không thể thiết lập mật khẩu.",
                        successMessage = if (result.value.configured) "Đã thiết lập mật khẩu." else null,
                    )
                }
                is ApiOutcome.Failure -> {
                    mutableState.update { it.copy(busy = false, error = when (result.httpStatus) {
                        401, 403 -> "Google chưa xác minh đúng tài khoản. Hãy thử lại."
                        409 -> "Mật khẩu đã được thiết lập. Hãy tải lại trạng thái bảo mật."
                        else -> "Không thể thiết lập mật khẩu. Hãy thử lại."
                    }) }
                    if (result.httpStatus == 409) load()
                }
            }
        }
    }
}

@Composable
internal fun BackendAccountSecurityScreen(
    userId: String,
    page: String,
    onDirty: (Boolean) -> Unit = {},
    model: AccountSecuritySettingsModel = hiltViewModel(key = "account-security-$userId"),
) {
    val state by model.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    LaunchedEffect(userId, page) { model.load() }
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        when (page) {
            "login-email", "google" -> {
                val info = state.details
                if (info == null) {
                    state.error?.let { error ->
                        Text(error, color = MaterialTheme.colorScheme.error)
                        TroOiButton("Thử lại", { model.load() }, modifier = Modifier.fillMaxWidth())
                    } ?: CircularProgressIndicator()
                } else if (page == "login-email") {
                    TroOiInformationRow("Email đăng nhập", info.email ?: "Chưa cung cấp")
                } else {
                    TroOiInformationRow("Tài khoản sử dụng", info.email ?: "Chưa cung cấp")
                    TroOiInformationRow("Google", if (info.googleLinked) "Đã liên kết" else "Chưa liên kết")
                    TroOiInformationRow("Mật khẩu", if (info.passwordConfigured) "Đã thiết lập" else "Chưa thiết lập")
                }
            }
            "password" -> {
                val details = state.details
                if (details == null) {
                    state.error?.let { error ->
                        Text(error, color = MaterialTheme.colorScheme.error)
                        TroOiButton("Thử lại", { model.load() }, modifier = Modifier.fillMaxWidth())
                    } ?: CircularProgressIndicator()
                } else BackendPasswordForm(
                    userId = userId,
                    passwordConfigured = details.passwordConfigured,
                    googleLinked = details.googleLinked,
                    busy = state.busy,
                    error = state.error,
                    successMessage = state.successMessage,
                    onDirty = onDirty,
                    onChange = model::changePassword,
                    onSetup = { password -> model.setupInitialPassword(context, password) },
                )
            }
        }
    }
}

@Composable
internal fun BackendPasswordForm(
    userId: String,
    passwordConfigured: Boolean,
    googleLinked: Boolean,
    busy: Boolean,
    error: String?,
    successMessage: String?,
    onDirty: (Boolean) -> Unit,
    onChange: (String, String) -> Unit,
    onSetup: (String) -> Unit,
) {
    var current by remember(userId, passwordConfigured) { mutableStateOf("") }
    var next by remember(userId, passwordConfigured) { mutableStateOf("") }
    var repeat by remember(userId, passwordConfigured) { mutableStateOf("") }
    LaunchedEffect(current, next, repeat) { onDirty(current.isNotEmpty() || next.isNotEmpty() || repeat.isNotEmpty()) }
    LaunchedEffect(successMessage) {
        if (successMessage != null) { current = ""; next = ""; repeat = ""; onDirty(false) }
    }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (passwordConfigured) SecretField(current, { current = it }, "Mật khẩu hiện tại", enabled = !busy)
        SecretField(next, { next = it }, "Mật khẩu mới", enabled = !busy,
            error = if (next.isNotEmpty() && next.length < 8) "Tối thiểu 8 ký tự." else "")
        SecretField(repeat, { repeat = it }, "Nhập lại mật khẩu mới", enabled = !busy,
            error = if (repeat.isNotEmpty() && next != repeat) "Mật khẩu không khớp." else "")
        if (!passwordConfigured && !googleLinked) {
            Text("Chưa có tài khoản Google đã liên kết để xác minh lần đầu.", color = MaterialTheme.colorScheme.error)
        }
        TroOiButton(
            if (passwordConfigured) "Đổi mật khẩu" else "Xác thực Google và thiết lập mật khẩu",
            { if (passwordConfigured) onChange(current, next) else onSetup(next) },
            enabled = !busy && (if (passwordConfigured) current.isNotBlank() else googleLinked) && next.length >= 8 &&
                next == repeat && current != next, busy = busy, modifier = Modifier.fillMaxWidth())
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        successMessage?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
    }
}
