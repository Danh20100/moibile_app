package com.trooi.app.ui.components

import android.graphics.ImageDecoder
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** App-private photo files are decoded off the UI thread, bounded to the display size. */
@Composable
fun LocalRentalPhoto(uri: String?, resource: Int?, description: String, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    if (uri == null && resource != null) {
        Image(painterResource(resource), description, modifier, contentScale = ContentScale.Crop)
        return
    }
    var finished by remember(uri) { mutableStateOf(false) }
    val bitmap by produceState<android.graphics.Bitmap?>(null, uri) {
        value = withContext(Dispatchers.IO) {
            runCatching {
                if (uri == null) return@runCatching null
                val sourceUri = Uri.parse(uri)
                if (Build.VERSION.SDK_INT >= 28) ImageDecoder.decodeBitmap(ImageDecoder.createSource(context.contentResolver, sourceUri)) { decoder, info, _ ->
                    val sample = maxOf(info.size.width, info.size.height) / 1200
                    decoder.setTargetSampleSize(sample.coerceAtLeast(1))
                    decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
                } else {
                    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                    context.contentResolver.openInputStream(sourceUri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
                    val options = BitmapFactory.Options().apply { inSampleSize = (maxOf(bounds.outWidth, bounds.outHeight) / 1200).coerceAtLeast(1) }
                    val decoded = context.contentResolver.openInputStream(sourceUri)?.use { BitmapFactory.decodeStream(it, null, options) }
                    val orientation = runCatching { context.contentResolver.openInputStream(sourceUri)?.use {
                        android.media.ExifInterface(it).getAttributeInt(android.media.ExifInterface.TAG_ORIENTATION, 1)
                    } ?: 1 }.getOrDefault(1)
                    val transform = android.graphics.Matrix().apply {
                        when (orientation) {
                            2 -> setScale(-1f, 1f)
                            3 -> setRotate(180f)
                            4 -> setScale(1f, -1f)
                            5 -> { setRotate(90f); postScale(-1f, 1f) }
                            6 -> setRotate(90f)
                            7 -> { setRotate(270f); postScale(-1f, 1f) }
                            8 -> setRotate(270f)
                        }
                    }
                    if (decoded != null && orientation in 2..8) android.graphics.Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, transform, true)
                        .also { if (it !== decoded) decoded.recycle() } else decoded
                }
            }.getOrNull()
        }
        finished = true
    }
    if (bitmap != null) Image(bitmap!!.asImageBitmap(), description, modifier, contentScale = ContentScale.Crop)
    else Box(modifier, contentAlignment = Alignment.Center) {
        if (!finished) CircularProgressIndicator() else Text("Lỗi đọc ảnh · chọn lại ảnh")
    }
}
