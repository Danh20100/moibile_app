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
import com.trooi.app.ui.components.TroOiButton
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

internal data class PinSettingsState(
    val configured: Boolean? = null,
    val busy: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
internal class BackendPinSettingsModel @Inject constructor(private val backend: BackendApi) : ViewModel() {
    private val mutableState = MutableStateFlow(PinSettingsState())
    val state = mutableState.asStateFlow()

    fun load() = viewModelScope.launch {
        when (val result = backend.getSecurityPinStatus()) {
            is ApiOutcome.Data -> mutableState.update { it.copy(configured = result.value.pinConfigured, error = null) }
            is ApiOutcome.Failure -> mutableState.update { it.copy(error = "Không thể tải trạng thái PIN.") }
        }
    }

    fun create(password: String, pin: String) {
        if (mutableState.value.busy || mutableState.value.configured != false) return
        mutableState.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            when (val result = backend.configureSecurityPin(password, pin)) {
                is ApiOutcome.Data -> mutableState.update { it.copy(
                    configured = result.value.pinConfigured, busy = false,
                    error = if (result.value.pinConfigured) null else "Không thể tạo mã PIN.",
                ) }
                is ApiOutcome.Failure -> mutableState.update { it.copy(
                    busy = false,
                    error = when (result.httpStatus) {
                        403 -> "Mật khẩu hiện tại không đúng hoặc PIN đã được thiết lập."
                        429 -> "Thử quá nhiều lần. Vui lòng thử lại sau."
                        else -> "Không thể tạo mã PIN."
                    },
                ) }
            }
        }
    }
}

@Composable
internal fun BackendPinSettings(userId: String, model: BackendPinSettingsModel = hiltViewModel(key = "backend-pin-$userId")) {
    val state by model.state.collectAsStateWithLifecycle()
    var password by remember(userId) { mutableStateOf("") }
    var pin by remember(userId) { mutableStateOf("") }
    var again by remember(userId) { mutableStateOf("") }
    LaunchedEffect(userId) { model.load() }
    LaunchedEffect(state.configured) {
        if (state.configured == true) {
            password = ""
            pin = ""
            again = ""
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        when (state.configured) {
            null -> CircularProgressIndicator()
            true -> Text("Đã thiết lập mã PIN bảo mật")
            false -> {
                SecretField(password, { password = it }, "Mật khẩu hiện tại", enabled = !state.busy)
                SecretField(pin, { pin = it }, "Mã PIN mới", pin = true, enabled = !state.busy)
                SecretField(again, { again = it }, "Nhập lại mã PIN", pin = true,
                    error = if (again.isNotEmpty() && again != pin) "Mã PIN không khớp." else "",
                    enabled = !state.busy)
                TroOiButton("Tạo mã PIN", { model.create(password, pin) },
                    enabled = !state.busy && password.isNotBlank() &&
                        validSecurityPin(pin) && pin == again,
                    busy = state.busy, modifier = Modifier.fillMaxWidth())
            }
        }
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
    }
}
