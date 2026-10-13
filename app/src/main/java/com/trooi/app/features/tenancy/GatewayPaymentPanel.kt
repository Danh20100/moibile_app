package com.trooi.app.features.tenancy

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.ImeAction
import com.trooi.app.ui.components.*
import com.trooi.app.core.model.rentalDate
import com.trooi.app.core.model.rentalMoney
import com.trooi.app.core.model.gatewayStatusLabel

@Composable
fun GatewayPaymentPanel(
    state: RentalUiState,
    amount: String,
    onAmountChange: (String) -> Unit,
    onCreate: () -> Unit,
    onReplay: () -> Unit,
    onRefresh: () -> Unit,
) {
    val checkout = state.gatewayCheckout
    val writable = canCreateGatewayCheckout(state.linkedTenancyStatus ?: state.tenancy?.status)
    val normalizedAmount = amount.removeSuffix(".00") + ".00"
    val validAmount = validGatewayAmount(normalizedAmount)
    val confirmed = isConfirmedGatewayPayment(checkout) &&
        state.payments.any { it.id == checkout?.resultingPaymentId }
    val refreshConfirmed = confirmed && checkout?.amount == normalizedAmount
    var showReference by remember(checkout?.id) { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    fun dismissKeyboard() { focus.clearFocus(); keyboard?.hide() }
    val twoLineLabel = rememberTextMeasurer().measure(
        text = "Chuyển khoản\nChuyển khoản",
        style = MaterialTheme.typography.labelLarge,
    )
    val actionMinHeight = with(LocalDensity.current) {
        twoLineLabel.size.height.toDp()
    } + ButtonDefaults.ContentPadding.calculateTopPadding() + ButtonDefaults.ContentPadding.calculateBottomPadding()
    val actionModifier = Modifier.fillMaxWidth().heightIn(min = actionMinHeight)
    TroOiCard("Chuyển khoản ngân hàng") {
        Text("Nhập số tiền để tạo yêu cầu chuyển khoản.", style = MaterialTheme.typography.bodyMedium)
        TroOiFormField(
            value = amount,
            onValueChange = onAmountChange,
            label = { Text("Số tiền (đồng)") },
            supportingText = { Text("Từ 1.000 đến 50.000.000 đồng, không nhập phần lẻ.") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { dismissKeyboard() }),
            singleLine = true,
            enabled = !state.busy && writable,
            isError = amount.isNotBlank() && !validAmount,
            modifier = Modifier.fillMaxWidth().testTag("gateway-checkout-amount"),
        )
        TroOiButton(
            text = if (refreshConfirmed) "Làm mới giao dịch đã ghi nhận"
                else if (confirmed || checkout?.status == "FAILED") "Tạo chuyển khoản mới" else "Tiếp tục chuyển khoản",
            onClick = { dismissKeyboard(); if (refreshConfirmed) onRefresh() else onCreate() },
            enabled = !state.busy && writable && validAmount,
            modifier = actionModifier.testTag("gateway-create"),
        )
        if (!writable) TroOiFeedback("Lượt thuê này chỉ có thể xem lại lịch sử thanh toán.")
        checkout?.let { current ->
            LedgerDivider()
            LedgerStateLabel(
                label = if (current.status == "SUCCEEDED" && !confirmed) "Đang đồng bộ khoản thanh toán"
                    else gatewayStatusLabel(current.status),
                tone = if (confirmed) LedgerTone.Success else if (current.status == "FAILED") LedgerTone.Error else LedgerTone.Warning,
                modifier = Modifier.testTag("gateway-status"),
            )
            TroOiInformationRow("Số tiền", rentalMoney(current.amount))
            TroOiFeedback(
                if (confirmed) "Khoản tiền đã có trong lịch sử. Việc phân bổ vào tiền phòng hoặc tiền cọc do người quản lý thực hiện."
                else "Sau khi chuyển khoản, quay lại đây và làm mới để kiểm tra kết quả. Mở trang thanh toán chưa có nghĩa là đã trả tiền.",
            )
            TroOiButton("Làm mới trạng thái", { dismissKeyboard(); onRefresh() }, enabled = !state.busy, style = TroOiButtonStyle.SECONDARY,
                modifier = actionModifier.testTag("gateway-refresh"))
            if (current.replayAllowed) {
                TroOiButton("Thử mở lại chuyển khoản", { dismissKeyboard(); onReplay() }, enabled = !state.busy && writable, style = TroOiButtonStyle.SECONDARY,
                    modifier = actionModifier.testTag("gateway-replay"))
            }
            TroOiButton(
                text = if (showReference) "Ẩn mã giao dịch" else "Xem mã giao dịch",
                onClick = { showReference = !showReference },
                style = TroOiButtonStyle.SECONDARY,
                modifier = actionModifier.testTag("gateway-reference"),
            )
            if (showReference) {
                TroOiInformationRow("Mã giao dịch", current.id)
                TroOiInformationRow("Mã tham chiếu", current.referenceCode)
                TroOiInformationRow("Tạo lúc", rentalDate(current.createdAt, includeTime = true))
            }
        }
        if (state.checkoutCreateFailed) {
            TroOiFeedback("Chưa mở được thanh toán. Nếu bạn đã chuyển tiền, hãy kiểm tra lại trạng thái hoặc liên hệ người quản lý trước khi thử lần nữa.")
        }
    }
}
