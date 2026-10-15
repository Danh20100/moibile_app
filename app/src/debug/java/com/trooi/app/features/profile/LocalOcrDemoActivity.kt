package com.trooi.app.features.profile

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import com.trooi.app.ui.theme.TroOiTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LocalOcrDemoActivity : ComponentActivity() {
    private val reader = LocalOcrRecognizer()
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            TroOiTheme {
                var busy by remember { mutableStateOf(false) }
                var result by remember { mutableStateOf("") }
                var error by remember { mutableStateOf<String?>(null) }
                val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
                    if (uri != null) {
                        busy = true
                        result = ""
                        error = null
                        lifecycleScope.launch {
                            val bitmap = try { withContext(Dispatchers.IO) { decodeBounded(uri) } }
                            catch (failure: Exception) {
                                busy = false
                                error = "Không đọc được ảnh. Hãy chọn ảnh rõ nét khác."
                                return@launch
                            }
                            reader.read(bitmap).addOnSuccessListener { text ->
                                result = text.ifBlank { "Chưa tìm thấy chữ. Hãy chọn ảnh rõ nét hơn." }
                            }.addOnFailureListener { error = "Không đọc được chữ. Hãy thử ảnh khác." }
                                .addOnCompleteListener { bitmap.recycle(); busy = false }
                        }
                    }
                }
                Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    Column(Modifier.safeDrawingPadding().padding(24.dp).verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        TextButton(onClick = { finish() }) { Text("Quay lại hồ sơ") }
                        Text("Đọc chữ từ ảnh", style = MaterialTheme.typography.headlineMedium)
                        Text("Demo xử lý ngay trên thiết bị. Kết quả không xác minh danh tính và không được lưu vào hồ sơ.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Button(onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                            enabled = !busy, modifier = Modifier.fillMaxWidth().testTag("ocr-select-image")) {
                            Text(if (busy) "Đang đọc ảnh…" else "Chọn ảnh để đọc chữ")
                        }
                        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                        if (result.isNotEmpty()) SelectionContainer { Text(result, modifier = Modifier.testTag("ocr-result")) }
                    }
                }
            }
        }
    }
    private fun decodeBounded(uri: Uri): Bitmap {
        // Technical memory bound: a 2048px edge (~16MiB ARGB), not an upload/identity policy.
        val edge = 2048
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return ImageDecoder.decodeBitmap(ImageDecoder.createSource(contentResolver, uri)) { decoder, info, _ ->
                val sample = maxOf(info.size.width, info.size.height).toDouble() / edge
                if (sample > 1) decoder.setTargetSize((info.size.width / sample).toInt().coerceAtLeast(1),
                    (info.size.height / sample).toInt().coerceAtLeast(1))
                decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            }
        }
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        contentResolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
        require(bounds.outWidth > 0 && bounds.outHeight > 0)
        val options = BitmapFactory.Options().apply {
            inSampleSize = 1
            while (bounds.outWidth / inSampleSize > edge || bounds.outHeight / inSampleSize > edge) inSampleSize *= 2
        }
        return requireNotNull(contentResolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, options) })
    }
    override fun onDestroy() { reader.close(); super.onDestroy() }
}
