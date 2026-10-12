package com.trooi.app.features.tenancy

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.trooi.app.core.auth.PendingCheckoutHint
import com.trooi.app.core.model.*
import com.trooi.app.features.shared.GatewayCheckout
import com.trooi.app.ui.components.*
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

/** Only backend checkout and refreshed Payment history can produce the confirmation state. */
@Composable
fun RentPaymentScreen(
    state: TroOiUiState,
    onBack: () -> Unit,
    onDone: () -> Unit,
    onReload: () -> Unit,
    remembered: () -> PendingCheckoutHint?,
    create: suspend (String, String) -> Result<GatewayCheckout>,
    refresh: suspend () -> Result<GatewayCheckout>,
) {
    val tenancy = state.read.tenancies.firstOrNull { it.tenancyId == (state.selectedContext as? SelectedContext.Tenant)?.tenancyId }
    val finance = tenancy?.let { state.read.tenantFinanceByTenancy[it.tenancyId] }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var amount by remember(state.backendUserId, tenancy?.tenancyId) { mutableStateOf(remembered()?.amount ?:
        finance?.charges?.sumOf { it.amountLabel.filter(Char::isDigit).toLongOrNull() ?: 0 }?.toString().orEmpty()) }
    var reviewing by remember(state.backendUserId, tenancy?.tenancyId) { mutableStateOf(remembered() != null) }
    var checkout by remember(state.backendUserId, tenancy?.tenancyId) { mutableStateOf<GatewayCheckout?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var resume by remember { mutableIntStateOf(0) }
    LaunchedEffect(finance) {
        if (amount.isBlank()) amount = finance?.charges?.sumOf { it.amountLabel.filter(Char::isDigit).toLongOrNull() ?: 0 }?.toString().orEmpty()
    }
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) resume++ }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }
    LaunchedEffect(resume, state.backendUserId, tenancy?.tenancyId) {
        if (busy || remembered()?.checkoutId == null) return@LaunchedEffect
        busy = true
        refresh().fold({ checkout = it; error = null }, { error = "Chưa kiểm tra được thanh toán. Thử lại để cập nhật." })
        busy = false
    }
    val confirmed = isConfirmedGatewayPayment(checkout) && finance?.payments?.any { it.paymentId == checkout?.resultingPaymentId } == true
    val locked = remembered() != null
    fun money(raw: String) = NumberFormat.getIntegerInstance(Locale.forLanguageTag("vi-VN")).format(raw.toLongOrNull() ?: 0) + "đ"
    fun openBrowser(payUrl: String?) {
        val url = launchableHttpsPayUrl(payUrl, allowLocalHttp = true)
        if (url == null) { error = "Chưa mở được trang thanh toán. Thử lại để lấy liên kết mới."; return }
        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
            .onFailure { error = "Không mở được trình duyệt. Kiểm tra ứng dụng trình duyệt rồi thử lại." }
    }

    TroOiScreenScaffold(modifier = Modifier.fillMaxSize().imePadding().testTag("rent-payment-screen"),
        topBar = { TroOiPageTopAppBar(title = { Text("Thanh toán") }, navigationIcon = {
            IconButton(onClick = onBack) { Icon(Icons.Rounded.ArrowBack, "Về Sổ") }
        }) }) { insets ->
        Column(Modifier.fillMaxSize().padding(insets).consumeWindowInsets(insets)) {
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            if (tenancy == null || finance == null) {
                TroOiStateMessage(TroOiStateKind.UNAVAILABLE, "Chưa tải được thông tin khoản thuê. Kiểm tra kết nối rồi thử lại.")
                TroOiButton("Thử lại", onReload, enabled = !state.runtimeLoading, modifier = Modifier.testTag("rent-finance-retry"))
            } else {
                val media = state.read.rentalAssetPresentationByRoom[tenancy.roomId]
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    LocalRentalPhoto(media?.photoUris?.firstOrNull(), media?.photoResources?.firstOrNull(), tenancy.roomLabel,
                        Modifier.size(72.dp).clip(RoundedCornerShape(12.dp)))
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(tenancy.roomLabel, style = MaterialTheme.typography.titleMedium)
                        Text(media?.publicArea.orEmpty(), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                HorizontalDivider()
                if (confirmed) {
                    Icon(Icons.Rounded.CheckCircle, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(48.dp))
                    Text("Thanh toán đã được xác nhận", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.testTag("rent-payment-confirmed"))
                    Text(money(amount), style = MaterialTheme.typography.headlineLarge)
                    Text("Đang chờ đối chiếu với các khoản phải thu.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Khoản thanh toán đã có trong lịch sử của bạn.", style = MaterialTheme.typography.bodyMedium)
                } else {
                    Text(if (reviewing) "Kiểm tra thanh toán" else "Bạn muốn thanh toán bao nhiêu?", style = MaterialTheme.typography.headlineMedium)
                    if (reviewing) {
                        TroOiInformationRow("Số tiền", money(amount))
                        TroOiInformationRow("Phí thanh toán", "0đ")
                    } else {
                        TroOiFormField(value = amount, onValueChange = { value -> if (value.length <= 8 && value.all(Char::isDigit)) amount = value },
                            label = { Text("Số tiền (đ)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            supportingText = { Text("Từ 1.000đ đến 50.000.000đ") }, modifier = Modifier.fillMaxWidth().testTag("rent-payment-amount"))
                    }
                    if (checkout != null || locked) Text("Thanh toán đang chờ xác nhận. Bạn có thể mở lại trang thanh toán hoặc kiểm tra trạng thái.",
                        style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Các khoản đã ghi nhận", style = MaterialTheme.typography.titleMedium)
                    finance.charges.forEach { TroOiInformationRow(it.label, it.amountLabel) }
                    Text("Thanh toán được ghi nhận riêng; các khoản thu chỉ được tất toán sau khi đối chiếu.",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("rent-payment-error")) }
            if (busy) Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                Text("Đang cập nhật thanh toán…", style = MaterialTheme.typography.bodyMedium)
            }
        }
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (confirmed) TroOiButton("Về Sổ", onDone, modifier = Modifier.fillMaxWidth().testTag("rent-payment-done"))
            else if (finance != null && tenancy != null) {
                TroOiButton(if (!reviewing) "Tiếp tục" else if (locked) "Mở lại trang thanh toán" else "Mở trang thanh toán",
                    onClick = {
                        if (!reviewing) reviewing = true else scope.launch {
                            busy = true; error = null
                            create(tenancy.tenancyId, amount).fold(
                                onSuccess = {
                                    checkout = it
                                    if (isConfirmedGatewayPayment(it)) refresh().fold({ updated -> checkout = updated }, { error = "Chưa tải được lịch sử. Kiểm tra lại thanh toán." })
                                    else openBrowser(it.payUrl)
                                },
                                onFailure = { error = it.message ?: "Hiện chưa thể mở thanh toán. Vui lòng thử lại sau." },
                            )
                            busy = false
                        }
                    }, enabled = !busy && validGatewayAmount(amount), modifier = Modifier.fillMaxWidth().testTag(if (reviewing) "rent-payment-open" else "rent-payment-review"))
                if (reviewing && !locked) TroOiButton("Sửa số tiền", onClick = { reviewing = false }, enabled = !busy,
                    modifier = Modifier.fillMaxWidth(), style = TroOiButtonStyle.TERTIARY)
                if (locked) TroOiButton("Kiểm tra thanh toán", onClick = { resume++ }, enabled = !busy,
                    modifier = Modifier.fillMaxWidth().testTag("rent-payment-refresh"), style = TroOiButtonStyle.SECONDARY)
            }
        }
        }
    }
}
