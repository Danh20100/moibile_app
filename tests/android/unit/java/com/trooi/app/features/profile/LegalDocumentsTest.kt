package com.trooi.app.features.profile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LegalDocumentsTest {
    @Test
    fun parsesHeadingsParagraphsAndBulletsWithoutDroppingFinalParagraph() {
        val blocks = parseLegalMarkdown(
            """
            # Điều khoản sử dụng

            Phiên bản dự thảo 0.1

            ## 1. Phạm vi

            Đây là đoạn đầu
            tiếp nối cùng một đoạn.

            - Quyền thứ nhất
            - Quyền thứ hai

            Nội dung cuối.
            """.trimIndent()
        )
        assertEquals(6, blocks.size)
        assertEquals(LegalBlock.Paragraph("Phiên bản dự thảo 0.1"), blocks[0])
        assertEquals(LegalBlock.Section("1. Phạm vi"), blocks[1])
        assertEquals(LegalBlock.Paragraph("Đây là đoạn đầu tiếp nối cùng một đoạn."), blocks[2])
        assertEquals(LegalBlock.Bullet("Quyền thứ nhất"), blocks[3])
        assertEquals(LegalBlock.Bullet("Quyền thứ hai"), blocks[4])
        assertEquals(LegalBlock.Paragraph("Nội dung cuối."), blocks[5])
    }

    @Test
    fun legalRoutesNeverResolveUnknownContent() {
        assertEquals(LegalDocumentType.TERMS, LegalDocumentType.fromRoute("legal:terms"))
        assertEquals(LegalDocumentType.PRIVACY, LegalDocumentType.fromRoute("legal:privacy"))
        assertNull(LegalDocumentType.fromRoute("legal:unknown"))
        assertEquals(2, LegalDocumentType.entries.size)
        assertTrue(LegalDocumentType.TERMS.filename.endsWith(".md"))
        assertFalse(LegalDocumentType.PRIVACY.title.isBlank())
    }
}
