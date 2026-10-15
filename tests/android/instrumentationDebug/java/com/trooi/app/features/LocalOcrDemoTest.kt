package com.trooi.app.features

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import androidx.test.platform.app.InstrumentationRegistry
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.google.android.gms.tasks.Tasks
import com.google.gson.JsonParser
import com.trooi.app.features.profile.LocalOcrRecognizer
import com.trooi.app.features.profile.LocalOcrDemoActivity
import java.util.concurrent.TimeUnit
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.Rule

class LocalOcrDemoTest {
    @get:Rule val compose = createAndroidComposeRule<LocalOcrDemoActivity>()

    @Test fun demoOffersLocalImageChoice() {
        compose.onNodeWithTag("ocr-select-image").assertIsDisplayed()
    }

    @Test fun bundledRecognizerReadsSyntheticTextWithoutBackendOrKycDecision() {
        val context = InstrumentationRegistry.getInstrumentation().context
        val f = context.assets.open("fixtures/ocr/demo.json").bufferedReader().use { JsonParser.parseReader(it).asJsonObject }
        require(f.get("version").asInt == 1)
        val bitmap = Bitmap.createBitmap(f.get("width").asInt, f.get("height").asInt, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            textSize = f.get("textSize").asFloat
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        }
        f.get("text").asString.lines().forEachIndexed { index, line ->
            canvas.drawText(line, f.get("textX").asFloat, f.get("firstBaseline").asFloat + index * f.get("lineHeight").asFloat, paint)
        }
        val reader = LocalOcrRecognizer()
        try {
            val result = Tasks.await(reader.read(bitmap), 30, TimeUnit.SECONDS)
            f.getAsJsonArray("expectedWords").forEach {
                assertTrue("Synthetic fixture OCR missing ${it.asString}: $result", result.contains(it.asString))
            }
        } finally { reader.close(); bitmap.recycle() }
    }
}
