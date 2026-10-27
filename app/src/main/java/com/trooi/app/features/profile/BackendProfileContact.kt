package com.trooi.app.features.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trooi.app.core.network.BackendApi
import com.trooi.app.core.network.dto.ApiOutcome
import com.trooi.app.core.network.dto.ProfileContactTransport
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

internal data class ProfileContactState(
    val details: ProfileContactTransport? = null,
    val busy: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
internal class BackendProfileContactModel @Inject constructor(private val backend: BackendApi) : ViewModel() {
    private val mutable = MutableStateFlow(ProfileContactState())
    val state = mutable.asStateFlow()

    fun load() = viewModelScope.launch {
        when (val result = backend.getProfileContact()) {
            is ApiOutcome.Data -> mutable.update { it.copy(details = result.value, error = null) }
            is ApiOutcome.Failure -> mutable.update { it.copy(error = "Không thể tải thông tin liên hệ.") }
        }
    }

    fun save(phone: String?, address: String?, onSuccess: () -> Unit) {
        if (mutable.value.busy) return
        mutable.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            when (val result = backend.updateProfileContact(phoneNumber = phone, residentialAddress = address)) {
                is ApiOutcome.Data -> {
                    mutable.update { it.copy(details = result.value, busy = false, error = null) }
                    onSuccess()
                }
                is ApiOutcome.Failure -> mutable.update { it.copy(
                    busy = false,
                    error = if (result.httpStatus == 403) "Hãy thiết lập mật khẩu tài khoản trước khi chỉnh sửa." else "Không thể lưu thông tin liên hệ."
                ) }
            }
        }
    }
}
