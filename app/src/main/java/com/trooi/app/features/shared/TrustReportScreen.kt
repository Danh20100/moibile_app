package com.trooi.app.features.shared

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.core.model.publicDiscoveryFeed
import com.trooi.app.ui.components.V1Action
import com.trooi.app.ui.components.V1PageTitle
import com.trooi.app.ui.components.V1Panel
import com.trooi.app.ui.components.V1Pending

@Composable
fun TrustReportScreen(
    state: TroOiUiState,
    listingId: String,
    onBack: () -> Unit,
    onSubmit: (listingId: String, reason: String, note: String) -> Unit,
) {
    BackHandler(onBack = onBack)
    val listingPublic = publicDiscoveryFeed(state.read.publicListings).any { it.listingId == listingId }
    val receipt = state.trustReceipt?.takeIf { it.listingId == listingId }
    var reason by rememberSaveable(listingId) { mutableStateOf(TrustReportReason.INCORRECT_INFORMATION.name) }
    var note by rememberSaveable(listingId) { mutableStateOf("") }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("trust-report-form"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp),
    ) {
        item {
            TextButton(onClick = onBack, modifier = Modifier.testTag("trust-report-cancel")) {
                Text("Hủy", color = MaterialTheme.colorScheme.primary)
            }
        }
        item { V1PageTitle("Báo cáo tin đăng", "Báo cáo được ghi nhận cho riêng tin này") }
        if (!listingPublic || state.trustReportUnavailable) {
            item {
                V1Panel("Tin đăng không khả dụng") {
                    V1Pending("Tin đăng không còn công khai để báo cáo.")
                }
            }
        } else if (receipt != null) {
            item {
                V1Panel("Biên nhận báo cáo") {
                    Text(receipt.id, modifier = Modifier.testTag("trust-report-receipt"))
                    Text(receipt.reason, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(receipt.status, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(receipt.createdAt, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    V1Pending("Đây là biên nhận báo cáo vừa gửi.")
                }
            }
        } else if (!state.isAuthenticated) {
            item { V1Pending("Cần đăng nhập để gửi báo cáo.") }
        } else {
            item {
                V1Panel("Lý do") {
                    TrustReportReason.entries.forEach { entry ->
                        Row(
                            Modifier.fillMaxWidth().testTag("trust-reason-" + entry.name),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = reason == entry.name,
                                onClick = { reason = entry.name },
                                enabled = !state.submittingTrustReport,
                            )
                            Text(entry.label)
                        }
                    }
                    Text("Ghi chú (tuỳ chọn)", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    OutlinedTextField(
                        value = note,
                        onValueChange = { note = it.take(2000) },
                        modifier = Modifier.fillMaxWidth().testTag("trust-report-note"),
                        enabled = !state.submittingTrustReport,
                        minLines = 3,
                    )
                    if (state.trustReportError != null) {
                        Text(
                            state.trustReportError,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.testTag("trust-report-error"),
                        )
                    }
                    if (state.submittingTrustReport) {
                        CircularProgressIndicator(Modifier.testTag("trust-report-submitting"))
                    }
                    V1Action(
                        if (state.trustReportError != null) "Thử gửi lại" else "Gửi báo cáo",
                        { onSubmit(listingId, reason, note) },
                        enabled = !state.submittingTrustReport,
                        modifier = Modifier.fillMaxWidth().testTag("trust-report-submit"),
                    )
                }
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                V1Action(
                    "Báo cáo đánh giá",
                    {},
                    enabled = reviewReportEnabled(),
                    modifier = Modifier.fillMaxWidth().testTag("trust-review-report"),
                )
                if (!reviewReportEnabled()) V1Pending("Báo cáo đánh giá chưa được mở.")
            }
        }
    }
}
