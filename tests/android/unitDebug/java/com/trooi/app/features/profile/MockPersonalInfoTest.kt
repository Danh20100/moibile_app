package com.trooi.app.features.profile

import com.trooi.app.core.demo.DemoData
import org.junit.Assert.*
import org.junit.Test

class MockPersonalInfoTest {
    @Test fun samplesBelongToTheirAuthenticatedPersona() {
        for (account in DemoData.accounts) {
            val email = MockPersonalInfo.value(account.userId, "Email")
            assertEquals(account.userId, DemoData.authenticate(email, "TroOi2026!")!!.userId)
            assertTrue(personalInputValid("Số điện thoại", MockPersonalInfo.value(account.userId, "Số điện thoại")))
            assertTrue(personalInputValid("Địa chỉ cư trú", MockPersonalInfo.value(account.userId, "Địa chỉ cư trú")))
            assertEquals("", MockPersonalInfo.value(account.userId, "Tên ưa dùng"))
        }
        assertEquals("", MockPersonalInfo.value("unknown-user", "Email"))
        assertEquals(DemoData.accounts.size, DemoData.accounts.map { MockPersonalInfo.value(it.userId, "Số điện thoại") }.toSet().size)
    }
}
