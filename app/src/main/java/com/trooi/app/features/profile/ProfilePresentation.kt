package com.trooi.app.features.profile

import com.trooi.app.core.model.TroOiUiState

const val PROFILE_UNSUPPORTED_MESSAGE = "Tính năng đang được phát triển."
const val PROFILE_CONNECTIONS_MESSAGE = "Tính năng Kết nối đang được phát triển."

enum class LandlordEntry { ONBOARDING, REAL_OPERATIONS }

data class ProfilePresentation(
    val name: String,
    val hasOperator: Boolean,
    val operatorDefault: Boolean,
    val canSwitch: Boolean,
) {
    val landlordEntry: LandlordEntry get() = when {
        hasOperator -> LandlordEntry.REAL_OPERATIONS
        else -> LandlordEntry.ONBOARDING
    }
    val landlordTitle: String get() = if (hasOperator) "Quản lý tài sản cho thuê" else "Trở thành chủ trọ"
}

fun profileContextLabel(state: TroOiUiState): String = when {
    state.access.operatedOrganizationIds.isNotEmpty() -> "Chủ trọ"
    state.access.linkedTenancyIds.isNotEmpty() -> "Người thuê"
    else -> "Thành viên TrọƠi"
}

fun profilePresentation(state: TroOiUiState): ProfilePresentation {
    val operator = state.isAuthenticated && state.access.operatedOrganizationIds.isNotEmpty()
    return ProfilePresentation(
        name = if (state.isAuthenticated) state.displayName.ifBlank { "Thành viên TrọƠi" } else "Khách truy cập",
        hasOperator = operator,
        operatorDefault = operator,
        canSwitch = false,
    )
}
