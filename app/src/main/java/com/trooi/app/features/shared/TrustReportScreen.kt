package com.trooi.app.features.shared

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.core.model.publicDiscoveryFeed
import com.trooi.app.ui.components.*

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
            TroOiButton("Hủy", onBack, modifier = Modifier.testTag("trust-report-cancel"), style = TroOiButtonStyle.TERTIARY)
        }
        item { TroOiPageHeader("Báo cáo tin đăng", "Báo cáo được ghi nhận cho riêng tin này") }
        if (!listingPublic || state.trustReportUnavailable) {
            item {
                TroOiCard("Tin đăng không khả dụng") {
                    TroOiFeedback("Tin đăng không còn công khai để báo cáo.")
                }
            }
        } else if (receipt != null) {
            item {
                TroOiCard("Biên nhận báo cáo") {
                    Text(receipt.id, modifier = Modifier.testTag("trust-report-receipt"))
                    Text(receipt.reason, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(receipt.status, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(receipt.createdAt, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    TroOiFeedback("Đây là biên nhận báo cáo vừa gửi.")
                }
            }
        } else if (!state.isAuthenticated) {
            item { TroOiFeedback("Cần đăng nhập để gửi báo cáo.") }
        } else {
            item {
                TroOiCard("Lý do") {
                    Column(Modifier.selectableGroup()) { TrustReportReason.entries.forEach { entry ->
                        Row(
                            Modifier.fillMaxWidth().heightIn(min = 48.dp).selectable(selected = reason == entry.name,
                                enabled = !state.submittingTrustReport, role = Role.RadioButton,
                                onClick = { reason = entry.name }).testTag("trust-reason-" + entry.name),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = reason == entry.name,
                                onClick = null,
                                enabled = !state.submittingTrustReport,
                            )
                            Text(entry.label, Modifier.weight(1f))
                        }
                    } }
                    Text("Ghi chú (tuỳ chọn)", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    TroOiFormField(
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
                    TroOiButton(
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
                TroOiButton(
                    "Báo cáo đánh giá",
                    {},
                    enabled = reviewReportEnabled(),
                    modifier = Modifier.fillMaxWidth().testTag("trust-review-report"),
                )
                if (!reviewReportEnabled()) TroOiFeedback("Báo cáo đánh giá chưa được mở.")
            }
        }
    }
}
