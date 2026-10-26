package com.trooi.app.features.ledger

import android.graphics.Bitmap
import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.QrCode
import androidx.compose.material.icons.rounded.QrCodeScanner
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import com.trooi.app.ui.components.TroOiActionDialog
import com.trooi.app.ui.components.TroOiFormField
import com.trooi.app.ui.components.TroOiButton
import com.trooi.app.ui.theme.TroOiDimens
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.MultiFormatReader
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.common.BitMatrix

fun joinQrBitmap(url: String): Bitmap {
    val matrix: BitMatrix = QRCodeWriter().encode(url, BarcodeFormat.QR_CODE, 384, 384)
    val pixels = IntArray(384 * 384)
    for (y in 0 until 384) {
        for (x in 0 until 384) {
            pixels[y * 384 + x] = if (matrix.get(x, y)) android.graphics.Color.BLACK else android.graphics.Color.WHITE
        }
    }
    return Bitmap.createBitmap(pixels, 384, 384, Bitmap.Config.ARGB_8888).apply {
        setPixels(pixels, 0, 384, 0, 0, 384, 384)
    }
}

fun scanJoinQr(bitmap: Bitmap): String? {
    val width = bitmap.width
    val height = bitmap.height
    val pixels = IntArray(width * height)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
    val reader = MultiFormatReader()
    val value = runCatching {
        reader.decode(BinaryBitmap(HybridBinarizer(RGBLuminanceSource(width, height, pixels)))).text
    }.getOrNull() ?: return null
    return if (value.startsWith("trooi://join?token=") || value.matches(Regex("[a-f0-9]{64}"))) value else null
}

@Composable
fun RentalJoinPrompt(
    currentToken: String,
    preview: RoomJoinPreview?,
    busy: Boolean,
    onPreview: (String) -> Unit,
    onAccept: () -> Unit,
) {
    var input by remember(currentToken) { mutableStateOf(currentToken) }
    val scanner = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        val decoded = bitmap?.let(::scanJoinQr)
        if (decoded != null) {
            input = decoded
            onPreview(decoded)
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        BookHeading("Liên kết phòng thuê", Icons.Rounded.QrCodeScanner)
        BookIllustration(Icons.Rounded.QrCode)
        Text("Chủ trọ gửi link hoặc QR của phòng. Bạn mở link, nhập mã hoặc quét QR để liên kết.")
        TroOiFormField(value = input, onValueChange = { input = it }, label = { Text("Link hoặc mã liên kết") },
            singleLine = true, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            BookOutlinedButton(onClick = { scanner.launch(null) }, modifier = Modifier.weight(1f)) {
                Icon(Icons.Rounded.QrCodeScanner, null)
                Spacer(Modifier.width(6.dp))
                Text("Quét QR")
            }
            BookButton(onClick = { onPreview(input) }, enabled = !busy && input.isNotBlank(), modifier = Modifier.weight(1f)) {
                Text("Kiểm tra")
            }
        }
        if (preview != null) {
            Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surfaceContainer) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Xác nhận phòng thuê", style = MaterialTheme.typography.titleMedium)
                    Text(preview.room + " · " + preview.property)
                    Text("Mã mời hết hạn: " + preview.expiresAt, style = MaterialTheme.typography.bodySmall)
                    Text("Sau khi xác nhận, tài khoản sẽ được liên kết với lượt thuê của phòng này.",
                        style = MaterialTheme.typography.bodySmall)
                    TroOiButton("Liên kết phòng", onAccept, modifier = Modifier.fillMaxWidth(), enabled = !busy)
                }
            }
        }
    }
}

@Composable
fun RentalInviteSheet(invitation: RoomJoinInvitation?, loading: Boolean, onCreate: () -> Unit, onDismiss: () -> Unit, eligible: Boolean = true) {
    var showingQr by remember(invitation?.token) { mutableStateOf(false) }
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    TroOiActionDialog(
        onDismissRequest = onDismiss,
        title = { Text("Liên kết người thuê") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (!eligible) {
                    BookEmpty(androidx.compose.material.icons.Icons.Rounded.QrCode,
                        "Phòng chưa thể tạo lời mời", "Cần có lượt thuê đang hoạt động với người đứng tên trước khi tạo link hoặc QR.")
                } else if (invitation == null) {
                    Text("Tạo link cho người đang đứng tên thuê phòng. Link có hiệu lực 24 giờ và chỉ liên kết được một lần.")
                    TroOiButton("Tạo link mời", onCreate, modifier = Modifier.fillMaxWidth(), enabled = !loading)
                } else {
                    Text(invitation.room + " · " + invitation.property)
                    Text("Hết hạn " + invitation.expiresAt, style = MaterialTheme.typography.bodySmall)
                    TroOiFormField(value = invitation.url, onValueChange = {}, readOnly = true, label = { Text("Link phòng") },
                        modifier = Modifier.fillMaxWidth())
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        BookOutlinedButton(onClick = { clipboard.setText(AnnotatedString(invitation.url)) }, modifier = Modifier.weight(1f)) {
                            Icon(Icons.Rounded.ContentCopy, null)
                            Text("Sao chép")
                        }
                        BookOutlinedButton(onClick = {
                            val intent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, invitation.url)
                            }
                            context.startActivity(Intent.createChooser(intent, "Gửi link phòng"))
                        }, modifier = Modifier.weight(1f)) {
                            Icon(Icons.Rounded.Share, null)
                            Text("Gửi link")
                        }
                    }
                    BookOutlinedButton(onClick = { showingQr = !showingQr }, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Rounded.QrCode, null)
                        Spacer(Modifier.width(8.dp))
                        Text(if (showingQr) "Ẩn QR" else "Hiện QR từ link")
                    }
                    if (showingQr) {
                        val bitmap = remember(invitation.url) { joinQrBitmap(invitation.url) }
                        Image(bitmap = bitmap.asImageBitmap(), contentDescription = "QR liên kết phòng",
                            modifier = Modifier.fillMaxWidth().heightIn(max = 256.dp))
                    }
                }
            }
        },
        confirmButton = { BookTextButton(onClick = onDismiss) { Text("Đóng") } },
    )
}
