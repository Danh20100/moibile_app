package com.trooi.app.features

import android.app.Instrumentation
import android.os.ParcelFileDescriptor
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Test-only dumps on failure. Host pulls from /sdcard/TroOiFailureEvidence/. */
object FailureEvidenceCapture {
    private fun shell(instrumentation: Instrumentation, command: String): String =
        ParcelFileDescriptor.AutoCloseInputStream(
            instrumentation.uiAutomation.executeShellCommand(command)
        ).bufferedReader().use { it.readText() }

    fun visibleTexts(instrumentation: Instrumentation): String {
        fun visit(node: android.view.accessibility.AccessibilityNodeInfo?): List<String> {
            if (node == null) return emptyList()
            val self = listOfNotNull(
                node.text?.toString()?.takeIf { it.isNotBlank() },
                node.contentDescription?.toString()?.takeIf { it.isNotBlank() },
                node.viewIdResourceName?.takeIf { it.isNotBlank() },
            ).joinToString("|").takeIf { it.isNotBlank() }
            return listOfNotNull(self) + (0 until node.childCount).flatMap { visit(node.getChild(it)) }
        }
        val roots = instrumentation.uiAutomation.windows.mapNotNull { it.root }
            .ifEmpty { listOfNotNull(instrumentation.uiAutomation.rootInActiveWindow) }
        return roots.flatMap(::visit).distinct().take(80).joinToString("; ")
    }

    fun foregroundPackage(instrumentation: Instrumentation): String =
        shell(instrumentation, "dumpsys activity activities")
            .lineSequence()
            .map { it.trim() }
            .firstOrNull { it.contains("mResumedActivity") || it.contains("topResumedActivity") }
            ?: "unknown"

    fun diagnosticSummary(instrumentation: Instrumentation = InstrumentationRegistry.getInstrumentation()): String {
        val wake = shell(instrumentation, "dumpsys power").lineSequence()
            .firstOrNull { it.contains("mWakefulness") }?.trim() ?: "wake=?"
        val keyguard = shell(instrumentation, "dumpsys window").lineSequence()
            .firstOrNull { it.contains("mInputRestricted") || it.contains("isStatusBarKeyguard") }?.trim()
            ?: "keyguard=?"
        val pkg = foregroundPackage(instrumentation)
        val texts = visibleTexts(instrumentation).ifBlank { "(no visible text)" }
        return "fg=$pkg | $wake | $keyguard | texts=[$texts]"
    }

    fun dump(testName: String, instrumentation: Instrumentation = InstrumentationRegistry.getInstrumentation()) {
        val stamp = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date())
        val safe = testName.replace(Regex("[^A-Za-z0-9._-]"), "_").take(120)
        // App-scoped external dir (adb pull …/Android/data/<pkg>/files/TroOiFailureEvidence).
        val dir = File(instrumentation.targetContext.getExternalFilesDir(null), "TroOiFailureEvidence/$stamp-$safe")
            .apply { mkdirs() }
        fun write(name: String, body: String) = File(dir, name).writeText(body)
        write("summary.txt", diagnosticSummary(instrumentation))
        write("dumpsys-window.txt", shell(instrumentation, "dumpsys window windows"))
        write("dumpsys-power.txt", shell(instrumentation, "dumpsys power"))
        write("dumpsys-activity.txt", shell(instrumentation, "dumpsys activity activities"))
        write("uiautomator.xml", shell(instrumentation, "uiautomator dump /dev/tty"))
        shell(instrumentation, "screencap -p ${dir.absolutePath}/screen.png")
        write("logcat-tail.txt", shell(instrumentation, "logcat -d -t 500"))
        android.util.Log.e("TroOiFailureEvidence", "dumped to ${dir.absolutePath}")
    }
}
