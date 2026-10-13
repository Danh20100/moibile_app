package com.trooi.app.features.profile

import org.junit.Assert.*
import org.junit.Test

class AccountInputTest {
    @Test fun marketingOptOutRetainsSecurityAndTransactionChannels() {
        assertEquals("Bảo mật và xác thực,Công nợ và biên nhận,Sự cố và hoạt động thuê trọ",
            marketingOptOutChannels("Ưu đãi,Bảo mật và xác thực,Phản hồi,Công nợ và biên nhận,Sự cố và hoạt động thuê trọ"))
        assertEquals("", marketingOptOutChannels("Ưu đãi,Cập nhật ứng dụng"))
    }
    @Test fun personalFieldsRejectInvalidInputs() {
        assertFalse(personalInputValid("Tên pháp lý", " "))
        assertFalse(personalInputValid("Tên pháp lý", "Nguyễn Lan"))
        assertFalse(personalInputValid("Số điện thoại", "lan@example.com"))
        assertTrue(personalInputValid("Số điện thoại", "0901234567"))
        assertFalse(personalInputValid("Email", "0901234567"))
        assertFalse(personalInputValid("Email", "lan @example.com"))
        assertTrue(personalInputValid("Email", "lan@example.com"))
        assertFalse(personalInputValid("Địa chỉ cư trú", ""))
    }
}
