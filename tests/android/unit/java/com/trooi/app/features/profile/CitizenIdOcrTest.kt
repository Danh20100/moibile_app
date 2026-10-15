package com.trooi.app.features.profile

import org.junit.Assert.*
import org.junit.Test

class CitizenIdOcrTest {
    @Test fun extractsNameAndDateFromMultilineVietnameseIdentityText() {
        val draft = extractCitizenIdDraft(
            """
            CĂN CƯỚC CÔNG DÂN
            Họ và tên / Full name
            NGUYỄN VĂN A
            Ngày, tháng, năm sinh / Date of birth
            09/07/1997
            """.trimIndent(),
        )
        assertEquals("NGUYỄN VĂN A", draft.fullName)
        assertEquals("09/07/1997", draft.birthDate)
    }

    @Test fun invalidDatesAndMissingNameAreNotInvented() {
        val draft = extractCitizenIdDraft(
            """
            Số/No: 012345678901
            Ngày sinh / Date of birth
            31/02/1990
            """.trimIndent(),
        )
        assertNull(draft.fullName)
        assertNull(draft.birthDate)
    }

    @Test fun futureBirthDatesAndNumericNamesAreNotSuggested() {
        val future = java.time.LocalDate.now().plusYears(1)
            .format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/uuuu"))
        val draft = extractCitizenIdDraft("Họ và tên: NGUYỄN VĂN 123\nNgày sinh: $future")
        assertNull(draft.fullName)
        assertNull(draft.birthDate)
    }
}
