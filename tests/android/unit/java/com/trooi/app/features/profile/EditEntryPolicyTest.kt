package com.trooi.app.features.profile

import org.junit.Assert.*
import org.junit.Test

class EditEntryPolicyTest {
    @Test fun allEditRoutesRequireReauthentication() {
        listOf("edit:Email", "edit:Số điện thoại", "edit:Địa chỉ cư trú", "edit:Phương thức thanh toán",
            "edit:Phương thức nhận tiền", "password", "visibility", "channel:Ưu đãi").forEach {
            assertTrue(it, requiresEditReauthentication(it))
        }
    }
    @Test fun viewingAndLegalNameDoNotOpenAnEditForm() {
        listOf("settings", "personal", "security", "pin", "google", "privacy", "payments", "method",
            "payout", "identity", "language", "legal", "contact", "edit:Tên pháp lý").forEach {
            assertFalse(it, requiresEditReauthentication(it))
        }
    }

    @Test fun backendPasswordChangeUsesItsServerVerifiedForm() {
        assertFalse(requiresSettingsReauthentication(demoPreview = false, page = "password"))
        assertTrue(requiresSettingsReauthentication(demoPreview = true, page = "password"))
        listOf("edit:Email", "visibility", "channel:Ưu đãi").forEach {
            assertFalse(it, requiresSettingsReauthentication(demoPreview = false, page = it))
        }
        assertTrue(requiresAccountPassword("pin"))
        assertTrue(requiresAccountPassword("edit:Số điện thoại"))
        assertTrue(requiresAccountPassword("edit:Địa chỉ cư trú"))
        assertTrue(requiresAccountPassword("edit:Tên hiển thị"))
        assertTrue(requiresAccountPassword("edit:Email"))
        assertFalse(requiresAccountPassword("login-email"))
        assertFalse(requiresAccountPassword("edit:Tên pháp lý"))
    }
}
