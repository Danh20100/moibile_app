package com.trooi.app.features.profile

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
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
)

@HiltViewModel
internal class AccountSecuritySettingsModel @Inject constructor(
    private val backend: BackendApi,
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
        mutableState.update { it.copy(busy = true, error = null, changed = false) }
        viewModelScope.launch {
            when (val result = backend.changePassword(current, next)) {
                is ApiOutcome.Data -> mutableState.update {
                    it.copy(busy = false, changed = result.value.changed,
                        error = if (result.value.changed) null else "Không thể đổi mật khẩu.")
                }
                is ApiOutcome.Failure -> mutableState.update { it.copy(busy = false, error = when (result.httpStatus) {
                    403 -> "Mật khẩu hiện tại không đúng."
                    429 -> "Thử quá nhiều lần. Vui lòng thử lại sau."
                    else -> "Không thể đổi mật khẩu."
                }) }
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
    LaunchedEffect(userId, page) { model.load() }
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        when (page) {
            "login-email" -> {
                val info = state.details
                if (info == null) CircularProgressIndicator()
                else TroOiInformationRow("Email đăng nhập", info.email ?: "Chưa cung cấp")
            }
            "google" -> {
                val info = state.details
                if (info == null) CircularProgressIndicator()
                else {
                    TroOiInformationRow("Tài khoản sử dụng", info.email ?: "Chưa cung cấp")
                    TroOiInformationRow("Google", if (info.googleLinked) "Đã liên kết" else "Chưa liên kết")
                    TroOiInformationRow("Mật khẩu", if (info.passwordConfigured) "Đã thiết lập" else "Chưa thiết lập")
                }
            }
            "password" -> BackendPasswordForm(userId, state.busy, state.error, state.changed,
                onDirty = onDirty, onSubmit = model::changePassword)
        }
        if (page != "password") state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
    }
}

@Composable
private fun BackendPasswordForm(
    userId: String,
    busy: Boolean,
    error: String?,
    changed: Boolean,
    onDirty: (Boolean) -> Unit,
    onSubmit: (String, String) -> Unit,
) {
    var current by remember(userId) { mutableStateOf("") }
    var next by remember(userId) { mutableStateOf("") }
    var repeat by remember(userId) { mutableStateOf("") }
    LaunchedEffect(current, next, repeat) { onDirty(current.isNotEmpty() || next.isNotEmpty() || repeat.isNotEmpty()) }
    LaunchedEffect(changed) {
        if (changed) { current = ""; next = ""; repeat = ""; onDirty(false) }
    }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SecretField(current, { current = it }, "Mật khẩu hiện tại", enabled = !busy)
        SecretField(next, { next = it }, "Mật khẩu mới", enabled = !busy,
            error = if (next.isNotEmpty() && next.length < 8) "Tối thiểu 8 ký tự." else "")
        SecretField(repeat, { repeat = it }, "Nhập lại mật khẩu mới", enabled = !busy,
            error = if (repeat.isNotEmpty() && next != repeat) "Mật khẩu không khớp." else "")
        TroOiButton("Đổi mật khẩu", { onSubmit(current, next) },
            enabled = !busy && current.isNotBlank() && next.length >= 8 &&
                next == repeat && current != next, busy = busy, modifier = Modifier.fillMaxWidth())
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (changed) Text("Đã đổi mật khẩu.", color = MaterialTheme.colorScheme.primary)
    }
}
