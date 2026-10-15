package com.trooi.app.features.profile

import com.trooi.app.ui.components.TroOiPage
import com.trooi.app.ui.components.TroOiPageHeader

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

/** Documents are bundled for offline reading; replacing them with published server versions
 * requires versioning, an effective date and independent legal review. */
enum class LegalDocumentType(val route: String, val filename: String, val title: String) {
    TERMS("legal:terms", "legal/terms-of-use.vi.md", "Điều khoản sử dụng"),
    PRIVACY("legal:privacy", "legal/privacy-policy.vi.md", "Chính sách quyền riêng tư");

    companion object {
        fun fromRoute(route: String): LegalDocumentType? =
            entries.firstOrNull { it.route == route }
    }
}

sealed interface LegalBlock {
    data class Section(val text: String) : LegalBlock
    data class Paragraph(val text: String) : LegalBlock
    data class Bullet(val text: String) : LegalBlock
}

/** Deliberately small Markdown subset, keeping the complete text offline and selectable. */
fun parseLegalMarkdown(content: String): List<LegalBlock> {
    val blocks = mutableListOf<LegalBlock>()
    val paragraph = StringBuilder()

    fun flush() {
        if (paragraph.isNotBlank()) {
            blocks.add(LegalBlock.Paragraph(paragraph.toString().trim()))
            paragraph.clear()
        }
    }

    content.lineSequence().forEach { line ->
        val clean = line.trim()
        when {
            clean.isBlank() -> flush()
            clean.startsWith("## ") -> {
                flush()
                blocks.add(LegalBlock.Section(clean.removePrefix("## ").trim()))
            }
            clean.startsWith("# ") -> flush() // The app shell already provides the document title.
            clean.startsWith("- ") -> {
                flush()
                blocks.add(LegalBlock.Bullet(clean.removePrefix("- ").trim()))
            }
            else -> {
                if (paragraph.isNotEmpty()) paragraph.append(' ')
                paragraph.append(clean)
            }
        }
    }
    flush()
    return blocks
}

@Composable
fun LegalDocumentContent(document: LegalDocumentType, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val blocks = remember(document) {
        runCatching {
            context.assets.open(document.filename).bufferedReader(Charsets.UTF_8).use { reader ->
                parseLegalMarkdown(reader.readText())
            }
        }.getOrNull()
    }

    if (blocks == null) {
        Surface(modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large) {
            Text(
                "Không mở được tài liệu trên thiết bị. Vui lòng thử lại sau.",
                Modifier.padding(20.dp),
                color = MaterialTheme.colorScheme.error,
            )
        }
        return
    }

    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        blocks.forEachIndexed { index, block ->
            when (block) {
                is LegalBlock.Section -> {
                    if (index > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    Text(
                        block.text,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                is LegalBlock.Paragraph -> Text(
                    block.text,
                    style = if (index == 0 || index == 1) MaterialTheme.typography.bodySmall
                        else MaterialTheme.typography.bodyMedium,
                    color = if (index == 0 || index == 1) MaterialTheme.colorScheme.onSurfaceVariant
                        else MaterialTheme.colorScheme.onBackground,
                )
                is LegalBlock.Bullet -> Row(Modifier.fillMaxWidth()) {
                    Text("•", color = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(10.dp))
                    Text(block.text, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

/** Makes legal text readable before account creation, without recording consent automatically. */
@Composable
fun LegalDocumentOverlay(document: LegalDocumentType, onDismiss: () -> Unit) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        TroOiPage(Modifier.fillMaxSize().safeDrawingPadding()) {
            Column(Modifier.fillMaxSize()) {
                Box(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)) {
                    TroOiPageHeader(document.title, onBack = onDismiss, backLabel = "Đóng tài liệu")
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                Box(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(20.dp)) {
                    LegalDocumentContent(document)
                }
            }
        }
    }
}
