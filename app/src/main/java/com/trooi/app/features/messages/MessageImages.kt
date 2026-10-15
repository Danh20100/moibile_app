package com.trooi.app.features.messages

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Image as ImageIcon
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File

/** JPEG bytes are transient until a local conversation write succeeds. No server upload is implied. */
internal data class DraftMessagePhoto(val bytes: ByteArray, val thumbnail: ImageBitmap)

@Composable
internal fun SecureMessagePhotoGrid(userId: String, conversationId: String, ids: List<String>,
    load: suspend (String, String) -> Result<ByteArray>) {
    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
        ids.take(5).forEach { id ->
            var retry by remember(userId, id) { mutableIntStateOf(0) }
            var failed by remember(userId, id) { mutableStateOf(false) }
            val photo by produceState<ImageBitmap?>(null, userId, id, retry) {
                failed = false
                value = withContext(Dispatchers.IO) {
                    load(conversationId, id).getOrNull()?.let { bytes ->
                        if (bytes.size > 2_000_000) return@let null
                        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
                        if (bounds.outWidth <= 0 || bounds.outHeight <= 0 || maxOf(bounds.outWidth, bounds.outHeight) > 12000) return@let null
                        val options = BitmapFactory.Options().apply {
                            inSampleSize = 1
                            while (maxOf(bounds.outWidth, bounds.outHeight) / inSampleSize > 1024) inSampleSize *= 2
                        }
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)?.asImageBitmap()
                    }
                }
                failed = value == null
            }
            if (photo != null) Image(photo!!, "Ảnh đính kèm riêng tư", Modifier.fillMaxWidth().height(172.dp).clip(RoundedCornerShape(11.dp)), contentScale = ContentScale.Crop)
            else if (failed) com.trooi.app.ui.components.TroOiButton("Không tải được ảnh · Thử lại", { retry++ }, style = com.trooi.app.ui.components.TroOiButtonStyle.TERTIARY)
            else androidx.compose.material3.CircularProgressIndicator(Modifier.size(24.dp))
        }
    }
}

internal suspend fun prepareMessagePhoto(context: Context, uri: Uri): DraftMessagePhoto = withContext(Dispatchers.IO) {
    require(context.contentResolver.getType(uri)?.startsWith("image/") == true) { "Chỉ hỗ trợ hình ảnh." }
    val source = context.contentResolver.openInputStream(uri)?.use { input ->
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        while (true) {
            val n = input.read(buffer)
            if (n < 0) break
            require(output.size() + n <= 8_000_000) { "Ảnh quá lớn. Hãy chọn ảnh dưới 8 MB." }
            output.write(buffer, 0, n)
        }
        output.toByteArray()
    } ?: error("Không thể mở ảnh.")
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(source, 0, source.size, bounds)
    val longest = maxOf(bounds.outWidth, bounds.outHeight)
    require(bounds.outWidth > 0 && bounds.outHeight > 0 && longest <= 12_000) { "Ảnh không hợp lệ." }
    val settings = BitmapFactory.Options().apply {
        inSampleSize = 1
        while (longest / inSampleSize > 1280) inSampleSize *= 2
    }
    val bitmap = requireNotNull(BitmapFactory.decodeByteArray(source, 0, source.size, settings)) { "Không đọc được ảnh." }
    val encoded = ByteArrayOutputStream()
    require(bitmap.compress(Bitmap.CompressFormat.JPEG, 80, encoded)) { "Không thể xử lý ảnh." }
    val jpeg = encoded.toByteArray()
    require(jpeg.size <= 2_000_000) { "Ảnh quá lớn. Hãy thử ảnh khác." }
    DraftMessagePhoto(jpeg, bitmap.asImageBitmap())
}

@Composable
internal fun DraftPhotoStrip(photos: List<DraftMessagePhoto>, onRemove: (Int) -> Unit) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        photos.forEachIndexed { index, photo ->
            Box(Modifier.size(82.dp)) {
                Image(photo.thumbnail, "Ảnh chuẩn bị lưu",
                    Modifier.fillMaxSize().clip(RoundedCornerShape(12.dp)),
                    contentScale = ContentScale.Crop)
                IconButton(onClick = { onRemove(index) },
                    modifier = Modifier.align(Alignment.TopEnd).size(48.dp).testTag("message-photo-remove-$index")) {
                    Surface(shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.surface) {
                        Icon(Icons.Rounded.Close, "Xóa ảnh", Modifier.padding(5.dp).size(17.dp))
                    }
                }
            }
        }
    }
}

@Composable
internal fun SavedMessagePhotoGrid(paths: List<String>) {
    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
        paths.take(5).chunked(2).forEach { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                pair.forEach { relative ->
                    PrivateMessagePhoto(relative, Modifier.weight(1f).height(if (paths.size == 1) 172.dp else 122.dp))
                }
                if (pair.size == 1 && paths.size > 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun PrivateMessagePhoto(relative: String, modifier: Modifier) {
    val context = LocalContext.current
    val photo by produceState<ImageBitmap?>(initialValue = null, key1 = relative) {
        value = withContext(Dispatchers.IO) {
            // Only relative filenames generated by the local conversation repository are accepted.
            if (!Regex("^messages/[0-9a-f]{64}/[0-9a-f]{64}/[0-9a-f-]{36}\\.jpg$").matches(relative)) return@withContext null
            val root = File(context.filesDir, "messages").canonicalFile
            val file = File(context.filesDir, relative).canonicalFile
            if (!file.path.startsWith(root.path + File.separator) || !file.isFile) return@withContext null
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.path, bounds)
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return@withContext null
            val settings = BitmapFactory.Options().apply {
                inSampleSize = 1
                while (maxOf(bounds.outWidth, bounds.outHeight) / inSampleSize > 1024) inSampleSize *= 2
            }
            BitmapFactory.decodeFile(file.path, settings)?.asImageBitmap()
        }
    }
    if (photo != null) Image(photo!!, "Ảnh đính kèm", modifier.clip(RoundedCornerShape(11.dp)),
        contentScale = ContentScale.Crop)
    else Box(modifier, contentAlignment = Alignment.Center) {
        Icon(Icons.Rounded.ImageIcon, "Ảnh không khả dụng")
    }
}
