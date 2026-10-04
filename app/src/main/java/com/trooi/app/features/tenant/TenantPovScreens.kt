package com.trooi.app.features.tenant

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.*
import com.trooi.app.ui.components.*
import com.trooi.app.ui.theme.TroOiMuted

private fun linkedRentals(state: TroOiUiState): List<TenancyCard> =
    state.read.tenancies.filter { it.tenancyId in state.access.linkedTenancyIds }

@Composable
fun V1TenantHomeScreen(
    state: TroOiUiState,
    onRental: () -> Unit,
    onFinance: () -> Unit,
    onIncidents: () -> Unit,
    onContextSwitcher: () -> Unit,
) {
    val rentals = linkedRentals(state)
    val current = rentals.firstOrNull {
        it.lifecycle == TenancyLifecycle.ACTIVE || it.lifecycle == TenancyLifecycle.ENDING
    } ?: rentals.firstOrNull()
    val finance = current?.let { state.read.tenantFinanceByTenancy[it.tenancyId] }
    val roomIds = rentals.mapTo(mutableSetOf()) { it.roomId }
    val incidents = state.read.incidents.filter { it.roomId in roomIds }

    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("tenant-pov-home"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { V1PageTitle("Trang chủ", "Tổng quan theo quan hệ thuê do Backend xác nhận") }
        item {
            V1Panel("Context hiện tại") {
                V1Pending("Nhà của tôi · không phải global role")
                V1Action("Chuyển không gian", onContextSwitcher, modifier = Modifier.fillMaxWidth())
            }
        }
        if (current == null) {
            item { V1Panel("Chưa có lượt thuê") { V1Pending("Backend chưa liên kết Tenancy nào với tài khoản.") } }
        } else {
            item {
                V1Panel(current.roomLabel) {
                    V1Metric("Tenancy", current.lifecycle.name)
                    current.termsVersionLabel?.let { V1Metric("Điều khoản", it) }
                    V1Action("Mở Nhà tôi", onRental, modifier = Modifier.fillMaxWidth())
                }
            }
            item {
                V1Panel("Cần theo dõi") {
                    V1Metric("Khoản phải thu", finance?.charges?.size?.toString() ?: "0")
                    V1Metric("Payment đã ghi nhận", finance?.payments?.size?.toString() ?: "0")
                    V1Metric("Sự cố trong các phòng liên kết", incidents.size.toString())
                    V1Action("Thanh toán", onFinance, modifier = Modifier.fillMaxWidth())
                    V1Action("Sự cố", onIncidents, modifier = Modifier.fillMaxWidth())
                }
            }
        }
    }
}

@Composable
fun V1TenantFinanceScreen(state: TroOiUiState, onRental: () -> Unit) {
    val rentals = linkedRentals(state)
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("tenant-pov-finance"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { V1PageTitle("Thanh toán", "Billing, Payment, Deposit và Receipt là các fact riêng từ Backend") }
        if (rentals.isEmpty()) {
            item { V1Panel("Chưa có dữ liệu") { V1Pending("Không có Tenancy được liên kết.") } }
        }
        items(rentals, key = { "tenant-finance-" + it.tenancyId }) { tenancy ->
            val finance = state.read.tenantFinanceByTenancy[tenancy.tenancyId]
            V1Panel(tenancy.roomLabel) {
                V1Metric("Billing / Charge", finance?.charges?.size?.toString() ?: "0")
                V1Metric("Payment", finance?.payments?.size?.toString() ?: "0")
                V1Metric("Receipt", finance?.receipts?.size?.toString() ?: "0")
                finance?.deposits?.firstOrNull()?.let { deposit ->
                    V1Metric("Deposit state", deposit.state ?: "Chưa có")
                    deposit.heldLabel?.let { V1Metric("Deposit held", it) }
                }
                Text("Không tự cộng outstanding hoặc suy ra paid boolean ở client.", color = TroOiMuted)
            }
        }
        item { V1Action("Mở chi tiết Nhà tôi", onRental, modifier = Modifier.fillMaxWidth()) }
    }
}

@Composable
fun V1TenantIncidentsScreen(state: TroOiUiState, onRental: () -> Unit) {
    val rentals = linkedRentals(state)
    val roomIds = rentals.mapTo(mutableSetOf()) { it.roomId }
    val incidents = state.read.incidents.filter { it.roomId in roomIds }

    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("tenant-pov-incidents"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { V1PageTitle("Sự cố", "Incident và timeline đọc từ Backend theo Room của Tenancy liên kết") }
        if (incidents.isEmpty()) {
            item { V1Panel("Không có sự cố") { V1Pending("Chưa có Incident trong các phòng được liên kết.") } }
        } else {
            items(incidents, key = { "tenant-incident-" + it.incidentId }) { incident ->
                V1Panel(incident.title) {
                    V1Metric("Trạng thái", incident.lifecycle.name)
                    V1Metric("Số sự kiện", incident.timeline.size.toString())
                }
            }
        }
        item {
            V1Panel("Báo hoặc xem chi tiết") {
                V1Pending("Thao tác ghi và timeline chi tiết tiếp tục dùng Rental Workspace server-authoritative.")
                V1Action("Mở Nhà tôi", onRental, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}
