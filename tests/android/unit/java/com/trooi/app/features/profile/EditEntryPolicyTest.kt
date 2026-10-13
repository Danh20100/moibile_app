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
}
