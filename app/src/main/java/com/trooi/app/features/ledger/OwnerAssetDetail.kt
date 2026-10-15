package com.trooi.app.features.ledger

import com.trooi.app.ui.components.*
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.trooi.app.core.model.*
import com.trooi.app.features.discovery.rentalPriceLabel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerAssetDetail(state: TroOiUiState, asset: LocalRentalAsset, onClose: () -> Unit, onEdit: () -> Unit, onArchive: suspend (String) -> Result<Unit>, onMessageContext: (String, String) -> Unit = { _, _ -> }) {
    val tenancies = state.read.tenancies.filter { it.roomId == asset.id }
    val tenancy = tenancies.firstOrNull { it.lifecycle.isCurrentRental() }
    val finance = state.read.operatorFinanceByRoom[asset.id]
    val incidents = state.read.incidents.filter { it.roomId == asset.id }
    var confirmArchive by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    Dialog(onClose, DialogProperties(usePlatformDefaultWidth = false)) {
        BackHandler(onBack = onClose)
        TroOiScreenScaffold(contentWindowInsets = WindowInsets.safeDrawing,
            topBar = { TroOiPageTopAppBar(title = { Text(asset.name) }, navigationIcon = { IconButton(onClose, Modifier.testTag("owner-detail-back")) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Quay lại") } }) },
            bottomBar = { Surface(shadowElevation = 3.dp) {
                Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (tenancy != null) TroOiButton("Nhắn người thuê", { onMessageContext("tenancy", tenancy.tenancyId) },
                        Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("owner-message-tenant"), style = TroOiButtonStyle.SECONDARY)
                    TroOiButton(if (asset.status == ManagedAssetStatus.DRAFT) "Hoàn tất tài sản" else "Chỉnh sửa tài sản", onEdit,
                        Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("owner-asset-edit"))
                    if (asset.status != ManagedAssetStatus.ARCHIVED) TroOiButton("Ngừng quản lý", { confirmArchive = true },
                        Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("owner-asset-archive"), style = TroOiButtonStyle.TERTIARY)
                }
            } }) { padding ->
            LazyColumn(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding).testTag("owner-asset-detail"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                item {
                    if (asset.photoUris.isNotEmpty() || asset.photoResources.isNotEmpty()) LocalRentalPhoto(asset.photoUris.firstOrNull(), asset.photoResources.firstOrNull(), asset.name,
                        Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(16.dp)))
                    Spacer(Modifier.height(16.dp))
                    Text(asset.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text("${asset.type} · ${asset.publicArea}")
                    Text("${rentalPriceLabel(asset.monthlyRent)}/tháng", style = MaterialTheme.typography.titleLarge)
                }
                item { AssetDetailSection("Tổng quan", listOf("${asset.area} m² · ${asset.furnishing}",
                    when (asset.status) { ManagedAssetStatus.DRAFT -> "Bản nháp · không dùng dung lượng"; ManagedAssetStatus.ARCHIVED -> "Đã ngừng quản lý · không dùng dung lượng"; else -> "Đang quản lý · 1 slot" },
                    "Địa chỉ quản lý: ${asset.operationalAddress}")) }
                item { AssetDetailSection("Người thuê", listOf(tenancy?.primaryTenantName ?: if (asset.occupied) "Đang có người thuê" else "Chưa có người thuê")) }
                item { AssetDetailSection("Điều khoản", tenancy?.termsVersionLabel?.let { listOf(it) } ?: listOf("Chưa có hợp đồng thuê đang hiệu lực.", "Cọc chào thuê: ${rentalPriceLabel(asset.advertisedDeposit)}")) }
                item { AssetDetailSection("Công nợ", finance?.charges?.map { "${it.label}: ${it.outstandingLabel ?: "Chưa có dữ liệu phân bổ"}" }?.ifEmpty { listOf("Chưa có khoản phải thu.") } ?: listOf("Chưa có khoản phải thu.")) }
                item { AssetDetailSection("Thanh toán", finance?.confirmedPayments?.map { "${it.amountLabel} · ${it.confirmationLabel ?: "Đã được xác nhận"}" }?.ifEmpty { listOf("Chưa có thanh toán được xác nhận.") } ?: listOf("Chưa có thanh toán được xác nhận."))
                    finance?.deposits.orEmpty().forEach { Text("Cọc đang giữ: ${it.heldLabel ?: "Chưa có dữ liệu"}", Modifier.padding(top = 12.dp)) } }
                item { AssetDetailSection("Sự cố", incidents.map { "${it.title} · ${incidentLabel(it.lifecycle)}" }.ifEmpty { listOf("Không có sự cố đang xử lý.") }) }
                item { AssetDetailSection("Hoạt động", tenancies.flatMap { state.read.noticesByTenancy[it.tenancyId].orEmpty() }.map { "${it.issuedAtLabel} · ${it.content}" }.ifEmpty { listOf("Tài sản chưa có hoạt động thuê được ghi nhận.") }) }
                item { AssetDetailSection("Tin đăng", listOf(when (asset.listingStatus) { ListingVisibility.PUBLISHED -> "Đang hiển thị trong Khám phá"; ListingVisibility.UNPUBLISHED -> "Đã gỡ khỏi Khám phá"; ListingVisibility.ARCHIVED -> "Đã lưu trữ"; else -> "Chưa đăng cho thuê" },
                    "Khu vực công khai: ${asset.publicArea}")) }
            }
        }
        if (confirmArchive) TroOiActionDialog({ if (!busy) confirmArchive = false }, title = { Text("Ngừng quản lý tài sản?") },
            text = { Column { Text("Tài sản không dùng slot quản lý và tin đăng được gỡ khỏi Khám phá. Lịch sử thuê và thanh toán vẫn được giữ."); error?.let { Text(it, color = MaterialTheme.colorScheme.error) } } },
            confirmButton = { TroOiButton("Ngừng quản lý", { scope.launch { busy = true; onArchive(asset.id).onSuccess { onClose() }.onFailure { error = "Chưa lưu được thay đổi. Vui lòng thử lại." }; busy = false } },
                enabled = !busy, busy = busy, modifier = Modifier.testTag("owner-archive-confirm"), style = TroOiButtonStyle.DESTRUCTIVE) },
            dismissButton = { TroOiButton("Giữ quản lý", { confirmArchive = false }, enabled = !busy, style = TroOiButtonStyle.SECONDARY) })
    }
}

@Composable
private fun AssetDetailSection(title: String, lines: List<String>) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        HorizontalDivider()
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        lines.forEach { Text(it, style = MaterialTheme.typography.bodyMedium) }
    }
}
