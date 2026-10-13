package com.trooi.app.features.profile

import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/** OCR assists data entry only. It is NOT identity verification or a KYC decision. */
internal data class CitizenIdDraft(val fullName: String? = null, val birthDate: String? = null)

internal fun extractCitizenIdDraft(text: String): CitizenIdDraft {
    val lines = text.lines().map { it.trim() }.filter(String::isNotBlank)
    val nameHeader = Regex("(?i)(họ\\s*và\\s*tên|full\\s*name|họ\\s*tên)")
    val birthdayHeader = Regex("(?i)(ngày\\s*tháng\\s*năm\\s*sinh|date\\s*of\\s*birth|ngày\\s*sinh)")
    val datePattern = Regex("\\b([0-3]?\\d)[/.-]([01]?\\d)[/.-]((?:19|20)\\d{2})\\b")

    val fullName = lines.indexOfFirst { nameHeader.containsMatchIn(it) }
        .takeIf { it >= 0 }?.let { index ->
            val current = lines[index].replace(nameHeader, "").trim(' ', ':', '-', '/')
            (if (current.length > 5) current else lines.getOrNull(index + 1).orEmpty())
                .trim().takeIf { candidate ->
                    candidate.length in 5..80 && candidate.any(Char::isLetter) &&
                        !candidate.any(Char::isDigit) && !birthdayHeader.containsMatchIn(candidate)
                }
        }

    val birthText = lines.indexOfFirst { birthdayHeader.containsMatchIn(it) }
        .takeIf { it >= 0 }?.let { index ->
            listOf(lines[index], lines.getOrNull(index + 1).orEmpty()).joinToString(" ")
        } ?: text
    val date = datePattern.find(birthText)?.let {
        val (day, month, year) = it.destructured
        runCatching { LocalDate.of(year.toInt(), month.toInt(), day.toInt()) }
            .getOrNull()?.takeIf { it.isBefore(LocalDate.now()) }
            ?.format(DateTimeFormatter.ofPattern("dd/MM/uuuu"))
    }
    return CitizenIdDraft(fullName = fullName, birthDate = date)
}

internal suspend fun scanCitizenId(bitmap: Bitmap): CitizenIdDraft {
    val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    return try {
        val text = suspendCancellableCoroutine<String> { continuation ->
            recognizer.process(InputImage.fromBitmap(bitmap, 0))
                .addOnSuccessListener { if (continuation.isActive) continuation.resume(it.text) }
                .addOnFailureListener { if (continuation.isActive) continuation.resumeWithException(it) }
        }
        extractCitizenIdDraft(text)
    } finally {
        recognizer.close()
    }
}
