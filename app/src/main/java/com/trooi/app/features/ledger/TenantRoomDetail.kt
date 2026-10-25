package com.trooi.app.features.ledger

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.trooi.app.core.model.*
import com.trooi.app.ui.components.*

/**
 * Tenant room detail ported from the completed Ledger redesign to the current source contracts.
 * All financial records are scoped to the selected authenticated tenancy.
 */
@Composable
internal fun TenantRoomDetail(
    state: TroOiUiState,
    rental: LedgerTenantAsset,
    onClose: () -> Unit,
    onFinance: (String) -> Unit,
    onMessages: () -> Unit,
    onIncidents: () -> Unit,
    onNotifications: () -> Unit,
) {
    val presentation = rental.roomId?.let { state.read.rentalAssetPresentationByRoom[it] }
    val finance = state.read.tenantFinanceByTenancy[rental.tenancyId]?.takeIf { it.tenancyId == rental.tenancyId }
    val issues = state.read.incidents.filter { it.roomId == rental.roomId }
    val notices = state.read.noticesByTenancy[rental.tenancyId].orEmpty().filter { it.tenancyId == rental.tenancyId }

    Dialog(onDismissRequest = onClose, properties = DialogProperties(
        usePlatformDefaultWidth = false, decorFitsSystemWindows = false,
    )) {
        BackHandler(onBack = onClose)
        TroOiScreenScaffold(
            modifier = Modifier.fillMaxSize(),
            contentWindowInsets = WindowInsets.safeDrawing,
            topBar = { TroOiPageTopAppBar(
                title = { Text(rental.label) },
                navigationIcon = { IconButton(onClose) {
                    Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Quay lại Sổ")
                } },
            ) },
        ) { insets ->
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(insets).consumeWindowInsets(insets)
                    .testTag("ledger-tenant-room-detail"),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                item {
                    TroOiCard("Phòng của tôi") {
                        if (presentation != null &&
                            (presentation.photoUris.isNotEmpty() || presentation.photoResources.isNotEmpty())) {
                            LocalRentalPhoto(
                                presentation.photoUris.firstOrNull(),
                                presentation.photoResources.firstOrNull(),
                                rental.label,
                                Modifier.fillMaxWidth().height(175.dp).clip(RoundedCornerShape(13.dp)),
                            )
                        }
                        TroOiInformationRow("Phòng", rental.label)
                        TroOiInformationRow("Tình trạng thuê", rentalLifecycleLabel(rental.lifecycle))
                        presentation?.let { TroOiInformationRow("Loại hình · Khu vực", "${it.type} · ${it.publicArea}") }
                    }
                }
                item {
                    TroOiCard("Liên hệ và yêu cầu") {
                        TroOiButton("Nhắn chủ trọ", onMessages, style = TroOiButtonStyle.SECONDARY,
                            modifier = Modifier.fillMaxWidth().testTag("tenant-detail-messages"))
                        TroOiButton("Theo dõi sự cố", onIncidents, style = TroOiButtonStyle.SECONDARY,
                            modifier = Modifier.fillMaxWidth().testTag("tenant-detail-incidents"))
                        TroOiButton("Thông báo", onNotifications, style = TroOiButtonStyle.TERTIARY,
                            modifier = Modifier.fillMaxWidth().testTag("tenant-detail-notifications"))
                    }
                }
                item {
                    TroOiCard("Điều khoản thuê") {
                        TroOiInformationRow("Trạng thái", rentalLifecycleLabel(rental.lifecycle))
                        TroOiInformationRow("Điều khoản đã ghi nhận", rental.terms ?: "Chưa có điều khoản được tải")
                    }
                }
                item {
                    TroOiCard("Khoản cần thanh toán") {
                        if (finance?.charges.isNullOrEmpty()) {
                            Text("Chưa đủ dữ liệu để xác định khoản phải trả.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        } else {
                            finance?.charges?.forEach {
                                TroOiInformationRow(it.label, it.outstandingLabel ?: "${it.amountLabel} · Chưa có dữ liệu phân bổ")
                            }
                            if (rental.lifecycle.isCurrentRental()) {
                                TroOiButton("Xem chi tiết thanh toán", { onFinance(rental.tenancyId) },
                                    style = TroOiButtonStyle.SECONDARY,
                                    modifier = Modifier.fillMaxWidth().testTag("tenant-detail-finance"))
                            }
                        }
                    }
                }
                item {
                    TroOiCard("Tiền cọc và biên nhận") {
                        val deposits = finance?.deposits.orEmpty().filter { it.tenancyId == rental.tenancyId }
                        if (deposits.isEmpty()) Text("Chưa có thông tin tiền cọc được ghi nhận.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                        deposits.forEach {
                            TroOiInformationRow("Cọc yêu cầu", it.requiredLabel ?: "Chưa có dữ liệu")
                            TroOiInformationRow("Đang giữ", it.heldLabel ?: "Chưa có dữ liệu")
                            it.settlementLabel?.let { settlement -> TroOiInformationRow("Xử lý cọc", settlement) }
                        }
                        finance?.payments?.forEach { TroOiInformationRow("Thanh toán được xác nhận", it.amountLabel) }
                        finance?.receipts?.forEach { TroOiInformationRow("Biên nhận", it.issuedAtLabel) }
                    }
                }
                item {
                    TroOiCard("Sự cố và thông báo") {
                        if (issues.isEmpty() && notices.isEmpty())
                            Text("Chưa có sự cố hoặc thông báo cho lượt thuê này.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        issues.forEach { TroOiInformationRow(it.title, incidentLabel(it.lifecycle)) }
                        notices.takeLast(5).reversed().forEach { TroOiInformationRow(it.content, it.issuedAtLabel) }
                    }
                }
            }
        }
    }
}
