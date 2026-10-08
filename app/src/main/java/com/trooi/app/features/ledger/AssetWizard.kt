package com.trooi.app.features.ledger

import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import androidx.core.view.WindowCompat
import com.google.gson.Gson
import com.trooi.app.core.model.*
import com.trooi.app.features.discovery.*
import com.trooi.app.ui.components.LocalRentalPhoto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

/** Files stay app-private and are retained for saved drafts and published local listings. */
// ponytail: canceled drafts can leave private files; sweep unreferenced media if storage pressure matters.
internal suspend fun copyRentalPhotos(context: Context, uris: List<Uri>): List<String> = withContext(Dispatchers.IO) {
    val directory = File(context.filesDir, "rental-media").apply { check(exists() || mkdirs()) }
    val copied = mutableListOf<File>()
    try {
        uris.map { uri ->
            require(context.contentResolver.getType(uri)?.startsWith("image/") == true)
            val file = File(directory, "${UUID.randomUUID()}.image")
            copied += file
            requireNotNull(context.contentResolver.openInputStream(uri)).use { input ->
                file.outputStream().use { output ->
                    val buffer = ByteArray(8192)
                    var total = 0
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        total += read
                        require(total <= 20 * 1024 * 1024) { "Chọn ảnh nhỏ hơn 20 MB." }
                        output.write(buffer, 0, read)
                    }
                }
            }
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.path, bounds)
            require(bounds.outWidth > 0 && bounds.outHeight > 0) { "Không đọc được ảnh đã chọn." }
            Uri.fromFile(file).toString()
        }
    } catch (error: Exception) {
        copied.forEach { it.delete() }
        throw error
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun AssetWizard(
    initial: LocalRentalAsset?, catalog: LocalManagement, host: String,
    onClose: () -> Unit,
    onSave: suspend (LocalRentalAsset, Boolean, Boolean) -> Result<Unit>,
    onPurchase: suspend (String) -> Result<Unit>,
) {
    val gson = remember { Gson() }
    val saver = remember { Saver<LocalRentalAsset, String>(save = { gson.toJson(it) }, restore = { gson.fromJson(it, LocalRentalAsset::class.java) }) }
    var asset by rememberSaveable(stateSaver = saver) { mutableStateOf(initial ?: LocalRentalAsset(
        UUID.randomUUID().toString(), UUID.randomUUID().toString(), "", "", "", "", "", "", "")) }
    var step by rememberSaveable { mutableIntStateOf(if (initial == null) 0 else 1) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var preview by rememberSaveable { mutableStateOf(false) }
    var exitReview by remember { mutableStateOf(false) }
    var pin by remember { mutableStateOf(false) }
    var capacityStage by rememberSaveable { mutableIntStateOf(0) }
    var pendingPublish by rememberSaveable { mutableStateOf(false) }
    var purchaseId by rememberSaveable { mutableStateOf(UUID.randomUUID().toString()) }
    val context = LocalContext.current
    val focus = LocalFocusManager.current
    val keyboard = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current
    val scope = rememberCoroutineScope()
    val scroll = rememberLazyListState()
    LaunchedEffect(step) { scroll.scrollToItem(0) }
    val photos = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(10)) { uris ->
        if (uris.isNotEmpty()) scope.launch {
            busy = true
            runCatching { copyRentalPhotos(context, uris.take((10 - asset.photoUris.size).coerceAtLeast(0))) }
                .onSuccess { asset = asset.copy(photoUris = asset.photoUris + it); error = null }
                .onFailure { error = "Không lưu được ảnh. Hãy chọn ảnh hợp lệ, mỗi ảnh dưới 20 MB." }
            busy = false
        }
    }
    fun save(activate: Boolean, publish: Boolean) {
        focus.clearFocus()
        keyboard?.hide()
        scope.launch {
            busy = true
            error = null
            val full = activate && catalog.used >= catalog.capacity() && catalog.assets.none { it.id == asset.id && it.status == ManagedAssetStatus.ACTIVE }
            val result = onSave(asset, if (full) false else activate, if (full) false else publish)
            result.onSuccess {
                if (full) { pendingPublish = publish; capacityStage = 1 } else onClose()
            }.onFailure { error = "Chưa lưu được tài sản. Vui lòng kiểm tra thông tin và thử lại." }
            busy = false
        }
    }
    val titles = listOf("Bạn muốn thêm loại tài sản nào?", "Tài sản nằm ở đâu?", "Không gian của bạn", "Điều kiện cho thuê", "Tiện nghi & nội quy", "Cho người thuê thấy không gian", "Sẵn sàng cho thuê")
    val nextEnabled = when (step) {
        0 -> asset.type.isNotBlank()
        1 -> asset.name.isNotBlank() && asset.operationalAddress.isNotBlank() && asset.publicArea.isNotBlank() && (asset.area.toBigDecimalOrNull()?.signum() ?: 0) > 0
        2 -> asset.description.isNotBlank() && (asset.maxOccupants ?: 0) > 0 &&
            if (asset.type == "Phòng trọ") asset.bathroomArrangement != null
            else (asset.bedrooms.toIntOrNull() ?: -1) >= 0 && (asset.bathrooms.toIntOrNull() ?: 0) > 0
        3 -> asset.valid() && (asset.minimumTermMonths.toIntOrNull() ?: 0) > 0
        5 -> asset.photoUris.isNotEmpty() || asset.photoResources.isNotEmpty()
        else -> true
    }
    Dialog({ if (!busy) exitReview = true }, DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        val window = (LocalView.current.parent as DialogWindowProvider).window
        val lightSurface = MaterialTheme.colorScheme.surface.luminance() > 0.5f
        SideEffect { WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = lightSurface
            isAppearanceLightNavigationBars = lightSurface
        } }
        BackHandler { if (!busy) { if (step > 0) step-- else exitReview = true } }
        Scaffold(
            modifier = Modifier.fillMaxSize().testTag("asset-wizard"),
            topBar = { TopAppBar(title = { Text(if (step == 0) "Thêm tài sản" else "Bước $step / 6") },
                navigationIcon = { IconButton({ if (step > 0) step-- else exitReview = true }, enabled = !busy) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Quay lại") } },
                actions = { TextButton({ save(false, false) }, enabled = !busy && asset.name.isNotBlank() && asset.type.isNotBlank(), modifier = Modifier.testTag("asset-save-draft")) { Text("Lưu nháp") } }) },
            bottomBar = {
                Surface(shadowElevation = 4.dp) {
                    Column(Modifier.fillMaxWidth().navigationBarsPadding().imePadding().padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("asset-error")) }
                        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                        if (step < 6) Button({ focus.clearFocus(); keyboard?.hide(); step++ }, enabled = nextEnabled && !busy,
                            modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("asset-next")) { Text("Tiếp tục") }
                        else {
                            Button({ save(true, true) }, enabled = asset.readyToPublish() && !busy,
                                modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("asset-publish")) { Text("Đăng cho thuê") }
                            OutlinedButton({ save(true, false) }, enabled = asset.valid() && !busy,
                                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("asset-save-active")) { Text("Lưu tài sản · chưa đăng") }
                        }
                    }
                }
            },
        ) { padding ->
            LazyColumn(Modifier.fillMaxSize().padding(padding).imePadding().testTag("asset-wizard-scroll"), state = scroll,
                contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                item {
                    if (step > 0) { LinearProgressIndicator(progress = { step / 6f }, modifier = Modifier.fillMaxWidth()); Spacer(Modifier.height(24.dp)) }
                    Text(titles[step], style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
                }
                when (step) {
                    0 -> item {
                        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            listOf("Phòng trọ", "Căn hộ").forEach { type ->
                                OutlinedCard(onClick = { asset = asset.copy(type = type) }, modifier = Modifier.fillMaxWidth().testTag("asset-type-$type"),
                                    border = androidx.compose.foundation.BorderStroke(if (asset.type == type) 2.dp else 1.dp, if (asset.type == type) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant)) {
                                    Row(Modifier.padding(24.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                                        Icon(if (type == "Căn hộ") Icons.Rounded.Apartment else Icons.Rounded.Home, null, Modifier.size(40.dp))
                                        Column(Modifier.weight(1f)) { Text(type, style = MaterialTheme.typography.titleLarge); Text(if (type == "Căn hộ") "Không gian riêng, đầy đủ phòng chức năng" else "Phòng thuê riêng trong nhà", style = MaterialTheme.typography.bodyMedium) }
                                        if (asset.type == type) Icon(Icons.Rounded.CheckCircle, "Đã chọn", tint = MaterialTheme.colorScheme.primary)
                                    }
                                }
                            }
                        }
                    }
                    1 -> item { Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        AssetField("Tên / mã tài sản", asset.name, "asset-name") { asset = asset.copy(name = it) }
                        AssetField("Địa chỉ chính xác", asset.operationalAddress, "asset-address") { asset = asset.copy(operationalAddress = it) }
                        Text("Địa chỉ này chỉ dùng để quản lý tài sản.", style = MaterialTheme.typography.bodySmall)
                        AssetField("Khu vực công khai · phường, quận, thành phố", asset.publicArea, "asset-public-area") { asset = asset.copy(publicArea = it) }
                        OutlinedButton({ pin = true }, Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("asset-location-pin")) {
                            Icon(Icons.Rounded.LocationOn, null); Spacer(Modifier.width(8.dp)); Text(if (asset.operationalLatitude.isBlank()) "Ghim vị trí tài sản" else "Đã ghim vị trí · chỉnh sửa")
                        }
                        AssetField("Diện tích (m²)", asset.area, "asset-area", true) { asset = asset.copy(area = it) }
                    } }
                    2 -> item { Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        if (asset.type == "Căn hộ") Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            AssetField("Phòng ngủ", asset.bedrooms, "asset-bedrooms", true, Modifier.weight(1f)) { asset = asset.copy(bedrooms = it) }
                            AssetField("Phòng tắm", asset.bathrooms, "asset-bathrooms", true, Modifier.weight(1f)) { asset = asset.copy(bathrooms = it) }
                        }
                        else {
                            Text("Nhà vệ sinh", fontWeight = FontWeight.SemiBold)
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                BathroomArrangement.entries.forEach { value ->
                                    FilterChip(asset.bathroomArrangement == value, { asset = asset.copy(bathroomArrangement = value, amenities = if (value == BathroomArrangement.SHARED) asset.amenities - "Phòng tắm riêng" else asset.amenities) },
                                        { Text(if (value == BathroomArrangement.PRIVATE) "WC riêng" else "WC chung") }, Modifier.heightIn(min = 48.dp).testTag("asset-wc-$value"))
                                }
                            }
                        }
                        AssetField("Số người tối đa", asset.maxOccupants?.toString().orEmpty(), "asset-max-occupants", true) { asset = asset.copy(maxOccupants = it.toIntOrNull()) }
                        AssetField("Tầng · nếu có", asset.floorLabel.orEmpty(), "asset-floor") { asset = asset.copy(floorLabel = it) }
                        Text("Nội thất", fontWeight = FontWeight.SemiBold)
                        listOf("Chưa có nội thất", "Nội thất cơ bản", "Đầy đủ nội thất").forEach { value ->
                            Row(Modifier.fillMaxWidth().clickable { asset = asset.copy(furnishing = value) }, verticalAlignment = Alignment.CenterVertically) {
                                RadioButton(asset.furnishing == value, { asset = asset.copy(furnishing = value) }); Text(value)
                            }
                        }
                        AssetField("Mô tả không gian", asset.description, "asset-description", multiline = true) { asset = asset.copy(description = it) }
                    } }
                    3 -> item { Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        AssetField("Tiền thuê mỗi tháng (đ)", asset.monthlyRent, "asset-rent", true) { asset = asset.copy(monthlyRent = it) }
                        AssetField("Cọc dự kiến (đ)", asset.advertisedDeposit, "asset-deposit", true) { asset = asset.copy(advertisedDeposit = it) }
                        Text("Đây là điều kiện chào thuê. Điều khoản thống nhất với người thuê được ghi nhận riêng.", style = MaterialTheme.typography.bodySmall)
                        AssetField("Điện · đơn giá / cách tính", asset.electricityOffer, "asset-electricity") { asset = asset.copy(electricityOffer = it) }
                        AssetField("Nước · đơn giá / cách tính", asset.waterOffer, "asset-water") { asset = asset.copy(waterOffer = it) }
                        AssetField("Dịch vụ khác · nếu có", asset.serviceOffer, "asset-service") { asset = asset.copy(serviceOffer = it) }
                        AssetField("Có thể nhận phòng từ", asset.availableFrom, "asset-available") { asset = asset.copy(availableFrom = it) }
                        AssetField("Thời hạn thuê tối thiểu (tháng)", asset.minimumTermMonths, "asset-minimum-term", true) { asset = asset.copy(minimumTermMonths = it) }
                    } }
                    4 -> item { Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text("Tiện nghi", style = MaterialTheme.typography.titleLarge)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("Wi-Fi", "Điều hòa", "Máy giặt", "Bếp", "Phòng tắm riêng", "Ban công", "Chỗ để xe", "Thang máy", "Camera an ninh")
                                .filterNot { it == "Phòng tắm riêng" && asset.type == "Phòng trọ" && asset.bathroomArrangement == BathroomArrangement.SHARED }.forEach { value ->
                                FilterChip(value in asset.amenities, { asset = asset.copy(amenities = if (value in asset.amenities) asset.amenities - value else asset.amenities + value) }, { Text(value) }, Modifier.heightIn(min = 48.dp))
                            }
                        }
                        AssetField("Nội quy · mỗi dòng một điều", asset.rules.joinToString("\n"), "asset-rules", multiline = true) { asset = asset.copy(rules = it.split('\n')) }
                        Text("Gợi ý: thú cưng, hút thuốc, số người tối đa và giờ ra vào.", style = MaterialTheme.typography.bodySmall)
                    } }
                    5 -> {
                        item { Text("Ảnh đầu tiên là ảnh bìa. Chọn ảnh rõ, đủ sáng và thể hiện đúng không gian.")
                            Spacer(Modifier.height(12.dp))
                            OutlinedButton({ photos.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, enabled = !busy && asset.photoUris.size < 10,
                                modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp).testTag("asset-pick-photos")) { Icon(Icons.Rounded.AddPhotoAlternate, null); Spacer(Modifier.width(8.dp)); Text("Chọn ảnh · tối đa 10") } }
                        asset.photoUris.forEachIndexed { index, uri -> item(key = uri) {
                            LocalRentalPhoto(uri, null, "Ảnh ${index + 1}", Modifier.fillMaxWidth().height(190.dp).clip(RoundedCornerShape(16.dp)))
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                TextButton({ asset = asset.copy(photoUris = listOf(uri) + asset.photoUris.filterNot { it == uri }) }, Modifier.weight(1f).testTag("asset-cover-$index")) { Text(if (index == 0) "Ảnh bìa" else "Chọn làm bìa") }
                                IconButton({ val next = asset.photoUris.toMutableList(); java.util.Collections.swap(next, index, index - 1); asset = asset.copy(photoUris = next) }, enabled = index > 0,
                                    modifier = Modifier.testTag("asset-photo-up-$index")) { Icon(Icons.Rounded.ArrowUpward, "Đưa ảnh lên trước") }
                                IconButton({ asset = asset.copy(photoUris = asset.photoUris - uri) }, Modifier.testTag("asset-photo-remove-$index")) { Icon(Icons.Rounded.DeleteOutline, "Xóa ảnh ${index + 1}") }
                            }
                        } }
                        asset.photoResources.forEach { resource -> item { LocalRentalPhoto(null, resource, asset.name, Modifier.fillMaxWidth().height(190.dp).clip(RoundedCornerShape(16.dp))) } }
                    }
                    6 -> item { Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        LocalRentalPhoto(asset.photoUris.firstOrNull(), asset.photoResources.firstOrNull(), asset.name, Modifier.fillMaxWidth().height(230.dp).clip(RoundedCornerShape(16.dp)))
                        Text(asset.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        Text("${asset.type} · ${asset.publicArea}")
                        Text("${rentalPriceLabel(asset.monthlyRent)}/tháng", style = MaterialTheme.typography.titleLarge)
                        Text("${asset.area} m² · ${asset.furnishing}")
                        OutlinedButton({ preview = true }, Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("asset-detail-preview")) { Text("Xem trước tin đăng") }
                        Text("Lưu tài sản để quản lý riêng. Đăng cho thuê sẽ đưa tin vào Khám phá.", style = MaterialTheme.typography.bodyMedium)
                        if (asset.occupied) Text("Tài sản đang có người thuê, không thể đăng cho thuê.")
                    } }
                }
            }
        }
        if (pin) {
            var latitude by remember { mutableStateOf(asset.operationalLatitude) }
            var longitude by remember { mutableStateOf(asset.operationalLongitude) }
            val validPin = latitude.toDoubleOrNull()?.let { it.isFinite() && it in -90.0..90.0 } == true && longitude.toDoubleOrNull()?.let { it.isFinite() && it in -180.0..180.0 } == true
            AlertDialog({ pin = false }, shape = RoundedCornerShape(24.dp), containerColor = MaterialTheme.colorScheme.surface, title = { Text("Ghim vị trí tài sản") }, text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    StreetMapPicker(asset.publicArea, if (validPin) PublicGeoPoint(latitude.toDouble(), longitude.toDouble()) else null,
                        { latitude = it.latitude.toString(); longitude = it.longitude.toString() })
                    Text("Vị trí chính xác chỉ dùng để quản lý, không hiển thị công khai.")
                    if (validPin) Text("Đã ghim vị trí.", color = MaterialTheme.colorScheme.primary)
                }
            }, confirmButton = { TextButton({ asset = asset.copy(operationalLatitude = latitude, operationalLongitude = longitude); pin = false }, enabled = validPin) { Text("Lưu vị trí") } },
                dismissButton = { TextButton({ pin = false }) { Text("Hủy") } })
        }
        if (preview) Dialog({ preview = false }, DialogProperties(usePlatformDefaultWidth = false)) {
            ListingDetailScreen(asset.listingId, { preview = false }, publicRentalDetail(PublicListingCard(asset.listingId, asset.name, asset.publicArea, null,
                "${asset.monthlyRent}đ/tháng", ListingVisibility.DRAFT, asset.amenities, rentalDetails = asset.publicDetails(host))), preview = true)
        }
        if (exitReview) AlertDialog({ exitReview = false }, shape = RoundedCornerShape(24.dp), containerColor = MaterialTheme.colorScheme.surface, title = { Text("Rời bước thêm tài sản?") }, text = { Text("Bạn có thể lưu nháp và hoàn tất sau.") },
            confirmButton = { TextButton({ exitReview = false; save(false, false) }, enabled = asset.name.isNotBlank() && asset.type.isNotBlank()) { Text("Lưu nháp") } },
            dismissButton = { TextButton(onClose) { Text("Bỏ thay đổi") } })
        if (capacityStage > 0) AlertDialog({ if (!busy) capacityStage = 0 }, modifier = Modifier.testTag("capacity-dialog"),
            shape = RoundedCornerShape(24.dp), containerColor = MaterialTheme.colorScheme.surface,
            title = { Text(when (capacityStage) { 1 -> "Dung lượng quản lý đã đầy"; 2 -> "Xác nhận mở thêm dung lượng"; else -> "Đã mở thêm 1 slot" }) },
            text = { Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("${catalog.used} / ${catalog.capacity()} tài sản đang quản lý", modifier = Modifier.testTag("capacity-current"))
                if (capacityStage < 3) {
                    Text("+1 slot quản lý", style = MaterialTheme.typography.titleLarge)
                    Text("259.000đ / 1 năm", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text("Mỗi tài sản đang quản lý dùng 1 slot. Bản nháp và tài sản ngừng quản lý không dùng slot.")
                    if (capacityStage == 2) Text("Thanh toán mô phỏng: không chuyển tiền thật, không tự gia hạn. Dung lượng được lưu trên thiết bị.")
                } else Text("Dung lượng có hiệu lực 1 năm. Tiếp tục để ${if (pendingPublish) "đăng cho thuê" else "quản lý"} tài sản.")
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            } },
            confirmButton = { TextButton({ when (capacityStage) {
                1 -> capacityStage = 2
                2 -> scope.launch { busy = true; error = null; onPurchase(purchaseId).onSuccess { capacityStage = 3 }.onFailure { error = "Chưa mở được dung lượng. Vui lòng thử lại." }; busy = false }
                else -> { capacityStage = 0; purchaseId = UUID.randomUUID().toString(); save(true, pendingPublish) }
            } }, enabled = !busy, modifier = Modifier.testTag("capacity-confirm")) { Text(when (capacityStage) { 1 -> "Mở thêm 1 slot"; 2 -> "Xác nhận thanh toán mô phỏng"; else -> "Tiếp tục" }) } },
            dismissButton = { TextButton({ capacityStage = 0 }, enabled = !busy) { Text("Để sau · đã lưu nháp") } })
    }
}

@Composable
private fun AssetField(label: String, value: String, tag: String, numeric: Boolean = false, modifier: Modifier = Modifier, multiline: Boolean = false, onValue: (String) -> Unit) {
    val focus = LocalFocusManager.current
    val keyboard = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current
    OutlinedTextField(value, { onValue(if (numeric) it.filter { character -> character.isDigit() || character == '.' }.take(12) else it.take(2000)) },
        modifier.fillMaxWidth().testTag(tag), label = { Text(label) }, singleLine = !multiline, minLines = if (multiline) 3 else 1,
        keyboardOptions = KeyboardOptions(keyboardType = if (numeric) KeyboardType.Decimal else KeyboardType.Text,
            imeAction = if (multiline) androidx.compose.ui.text.input.ImeAction.Default else androidx.compose.ui.text.input.ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { focus.clearFocus(); keyboard?.hide() }))
}
