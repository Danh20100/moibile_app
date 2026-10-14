package com.trooi.app.features.profile

import com.trooi.app.features.auth.*
import org.junit.Assert.*
import org.junit.Test

class ContactOtpSubmitTest {
    @Test fun neitherMockNorBackendCanVerifyWithoutARealDeliveryProvider() {
        for (mockMode in listOf(true, false)) {
            val form = ContactOtpForm(EmailOtpState("a@trooi.test"))
            form.code = "123456"
            assertFalse(form.validateOnSubmit("a@trooi.test", mockMode))
            assertTrue(form.unavailable)
            assertNotEquals(EmailOtpStatus.VERIFIED, form.state.status)
        }
    }
}
