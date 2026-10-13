package com.trooi.app.features.profile

import android.graphics.Bitmap
import com.google.android.gms.tasks.Task
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

/** Debug-only on-device text extraction; never a verification decision. */
class LocalOcrRecognizer : AutoCloseable {
    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    fun read(bitmap: Bitmap): Task<String> = recognizer.process(InputImage.fromBitmap(bitmap, 0))
        .continueWith { it.result.text }
    override fun close() = recognizer.close()
}
