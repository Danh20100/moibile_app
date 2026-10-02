package com.trooi.app.features.inquiry

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.ui.components.*
import com.trooi.app.ui.theme.TroOiMuted

/** Contact intent is separate from Listing detail, Booking and Tenancy business state. */
@Composable
fun InquiryComposer(
    state: TroOiUiState,
    listingId: String,
    onOpenLogin: () -> Unit,
    onSubmit: (String, String) -> Unit,
) {
    var message by remember(listingId) { mutableStateOf("") }
    val completed = state.inquiryCompletedListingId == listingId
    LaunchedEffect(completed) { if (completed) message = "" }
    V1Panel("Liên hệ về tin đăng", modifier = Modifier.testTag("inquiry-composer")) {
        Text("Inquiry là nhu cầu liên hệ; không giữ phòng, không tạo Booking hay Tenancy.", color = TroOiMuted)
        if (!state.isAuthenticated) {
            V1Pending("Đăng nhập Google trước khi gửi yêu cầu.")
            V1Action("Đăng nhập để liên hệ", onOpenLogin, modifier = Modifier.fillMaxWidth())
        } else if (completed) {
            Text("Backend đã ghi nhận Inquiry.", modifier = Modifier.testTag("inquiry-success"))
            V1Pending("Không tự tạo Notification. Chủ trọ nhận được khi Backend hỗ trợ delivery.")
        } else {
            OutlinedTextField(
                value = message,
                onValueChange = { message = it.take(1000) },
                label = { Text("Nội dung cần liên hệ") },
                modifier = Modifier.fillMaxWidth().testTag("inquiry-message"),
                minLines = 3,
                maxLines = 5,
                enabled = !state.submittingInquiry,
            )
            if (state.inquiryError != null) {
                Text(state.inquiryError, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("inquiry-error"))
            }
            if (state.submittingInquiry) CircularProgressIndicator(Modifier.testTag("inquiry-submitting"))
            V1Action(
                if (state.inquiryError != null) "Thử gửi lại" else "Gửi yêu cầu liên hệ",
                { onSubmit(listingId, message.trim()) },
                enabled = message.isNotBlank() && !state.submittingInquiry,
                modifier = Modifier.fillMaxWidth().testTag("inquiry-submit"),
            )
            Text("Chỉ hiển thị thành công sau khi Backend xác nhận.", color = TroOiMuted)
        }
    }
}
