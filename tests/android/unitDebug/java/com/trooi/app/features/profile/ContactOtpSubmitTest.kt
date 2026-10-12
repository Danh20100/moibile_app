package com.trooi.app.features.profile

import com.trooi.app.features.auth.*
import org.junit.Assert.*
import org.junit.Test

class ContactOtpSubmitTest {
    @Test fun onlyFinalSubmitChecksCodeAndNeverRetainsAnAuthorization() {
        val form = ContactOtpForm(EmailOtpState("a@trooi.test"))
        form.code = MockEmailOtp.code
        assertFalse(form.validateOnSubmit("a@trooi.test", true))
        form.state = form.state.sent(System.currentTimeMillis())
        form.code = "000000"
        assertFalse(form.validateOnSubmit("a@trooi.test", true))
        assertEquals(1, form.state.attempts)
        form.code = MockEmailOtp.code
        assertTrue(form.validateOnSubmit("a@trooi.test", true))
        assertEquals(EmailOtpStatus.SENT, form.state.status)
        form.state = form.state.copy(expiresAt = System.currentTimeMillis() - 1)
        assertFalse(form.validateOnSubmit("a@trooi.test", true))
        assertEquals(EmailOtpStatus.EXPIRED, form.state.status)
        form.change("b@trooi.test")
        assertEquals("", form.code)
        assertEquals(0, form.state.expiresAt)
    }
    @Test fun backendCannotUseAValidFixture() {
        val form = ContactOtpForm(EmailOtpState("a@trooi.test").sent(System.currentTimeMillis()))
        form.code = MockEmailOtp.code
        assertFalse(form.validateOnSubmit("a@trooi.test", false))
        assertTrue(form.unavailable)
        assertNotEquals(EmailOtpStatus.VERIFIED, form.state.status)
    }
}
