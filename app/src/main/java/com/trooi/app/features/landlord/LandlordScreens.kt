package com.trooi.app.features.landlord

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.*
import com.trooi.app.ui.components.*
import com.trooi.app.ui.theme.*

@Composable
fun V1OwnerDashboardScreen(state: TroOiUiState) {
    val organizations = state.read.organizations.filter { it.organizationId in state.access.operatedOrganizationIds }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("v1-owner-dashboard"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { V1PageTitle("Tổng quan", "Số liệu chỉ được render từ Backend dashboard read model") }
        if (state.demoPreview) item { V1PreviewNotice() }
        if (organizations.isEmpty()) {
            item { V1Panel("Không gian vận hành") { V1Pending("Tài khoản chưa được liên kết với Organization.") } }
        }
        items(organizations, key = { it.organizationId }) { org ->
            V1Panel(org.displayName) {
                val projection = state.read.dashboardByOrganization[org.organizationId]
                if (projection == null) {
                    V1Pending("Chưa có Dashboard projection từ Backend cho Organization này.")
                } else {
                    projection.roomsByState.forEach { (status, count) ->
                        V1Metric("Room " + status.name, count.toString())
                    }
                    projection.activeTenancyCount?.let { V1Metric("Tenancy đang hoạt động", it.toString()) }
                    projection.outstandingReceivableLabel?.let { V1Metric("Khoản phải thu còn lại", it) }
                    projection.confirmedPaymentTotalLabel?.let { V1Metric("Payment đã xác nhận", it) }
                    projection.openIncidentCount?.let { V1Metric("Sự cố đang mở", it.toString()) }
                    V1Pending("Dashboard không thay thế Room, Payment hoặc Incident source of truth.")
                }
            }
        }
    }
}

@Composable
fun V1OwnerPropertiesScreen(state: TroOiUiState) {
    val organizations = state.read.organizations.filter { it.organizationId in state.access.operatedOrganizationIds }
    val properties = accessibleProperties(state.read, state.access)
    val rooms = accessibleRooms(state.read, state.access)
    val operatorListings = accessibleOperatorListings(state.read, state.access)
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("v1-owner-properties"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { V1PageTitle("Không gian vận hành", "Organization → Property → Room → Listing") }
        if (state.demoPreview) item { V1PreviewNotice() }
        if (organizations.isEmpty()) item { V1Panel("Organization") { V1Pending() } }
        items(organizations, key = { it.organizationId }) { org ->
            V1Panel(org.displayName) {
                val owned = properties.filter { it.organizationId == org.organizationId }
                if (owned.isEmpty()) V1Pending("Không có Property trong quyền truy cập hiện tại.")
                owned.forEach { property ->
                    Text(property.displayName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    val units = rooms.filter { it.propertyId == property.propertyId }
                    if (units.isEmpty()) V1Pending("Chưa có Room.")
                    units.forEach { room ->
                        V1Metric(room.label, room.operationalState.name + " · " + room.lifecycle.name)
                        val listings = operatorListings.filter { it.roomId == room.roomId }
                        listings.forEach { listing ->
                            Text("Listing: " + listing.title + " · " + listing.visibility.name, style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
                        }
                    }
                }
                V1Pending("Tạo/chuyển trạng thái là thao tác Backend: chưa có adapter OpenAPI.")
            }
        }
    }
}

@Composable
fun V1OwnerFinanceScreen(state: TroOiUiState) {
    val organizations = state.read.organizations.filter { it.organizationId in state.access.operatedOrganizationIds }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("v1-owner-finance"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { V1PageTitle("Tài chính", "Charge, Payment, Allocation, Deposit và Receipt là các nguồn riêng biệt") }
        if (state.demoPreview) item { V1PreviewNotice() }
        if (organizations.isEmpty()) item { V1Panel("Không gian vận hành") { V1Pending() } }
        items(organizations, key = { it.organizationId }) { org ->
            V1Panel(org.displayName) {
                val finance = state.read.operatorFinanceByOrganization[org.organizationId]
                if (finance == null) {
                    V1Pending("Đang chờ projection tài chính theo Organization từ Backend.")
                } else {
                    V1FinanceCategory("Charge · Khoản phải thu", finance.charges.map { it.label + ": " + it.amountLabel })
                    V1FinanceCategory("Payment · Tiền đã xác nhận", finance.confirmedPayments.map { it.amountLabel })
                    V1FinanceCategory("Payment Allocation", finance.allocations.map { it.amountLabel })
                    V1FinanceCategory("Deposit · Tiền thực tế giữ", finance.deposits.map { it.fundedLabel ?: "Chưa có số liệu" })
                    V1FinanceCategory("Receipt · Biên nhận", finance.receipts.map { it.receiptId })
                }
            }
        }
    }
}

@Composable
private fun V1FinanceCategory(title: String, values: List<String>) {
    Text(title, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.titleSmall, color = TroOiText)
    if (values.isEmpty()) V1Pending("Chưa có dữ liệu.") else values.forEach {
        Text(it, style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
    }
    HorizontalDivider(color = TroOiLine)
}

@Composable
fun V1OwnerIncidentsScreen(state: TroOiUiState) {
    val incidents = accessibleIncidents(state.read, state.access)
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("v1-owner-incidents"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { V1PageTitle("Sự cố", "Lifecycle và lịch sử phải do Backend xác nhận") }
        if (state.demoPreview) item { V1PreviewNotice() }
        if (incidents.isEmpty()) item { V1Panel("Danh sách sự cố") { V1Pending() } }
        items(incidents, key = { it.incidentId }) { incident ->
            V1Panel(incident.title) {
                V1Metric("Trạng thái", incident.lifecycle.name)
                Text("Room: " + incident.roomId, style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
                Text("Lịch sử xử lý", fontWeight = FontWeight.SemiBold, color = TroOiText)
                if (incident.timeline.isEmpty()) V1Pending("Chưa có Incident Event.")
                incident.timeline.forEach { event ->
                    Text(event.description + " · " + event.occurredAtLabel, style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
                }
                V1Pending("Mọi action phải gửi Backend và chờ state/event mới; không tự đổi trạng thái trong client.")
                if (incident.serverActions.isNotEmpty()) {
                    Text("Action được Backend công bố: " + incident.serverActions.joinToString(), color = TroOiMuted)
                }
            }
        }
    }
}
