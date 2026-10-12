package com.trooi.app.features.auth

import org.junit.Assert.*
import org.junit.Test

class EmailOtpStateTest {
    @Test fun cooldownExpiryWrongAndVerifiedAreDeterministic() {
        val sent = EmailOtpState("a@trooi.test").sent(1_000)
        assertFalse(sent.canResend(30_999))
        assertTrue(sent.canResend(31_000))
        val wrong = sent.verify("654321", 2_000, "123456")
        assertEquals(EmailOtpStatus.ERROR, wrong.status)
        assertEquals(1, wrong.attempts)
        val verified = wrong.verify("123456", 3_000, "123456")
        assertEquals(EmailOtpStatus.VERIFIED, verified.status)
        assertFalse(verified.canResend(200_000))
        assertEquals(EmailOtpStatus.EXPIRED, sent.verify("123456", 121_000, "123456").status)
        assertEquals(EmailOtpStatus.EXPIRED, wrong.expired(121_000).status)
    }

    @Test fun expiredCodeAndMissingCodeNeverAuthorizeFinalSubmit() {
        val sent = EmailOtpState("a@trooi.test").sent(1_000)
        assertEquals(EmailOtpStatus.ERROR, sent.verify("", 2_000, "123456").status)
        assertEquals(EmailOtpStatus.EXPIRED, sent.expired(121_000).verify("123456", 121_001, "123456").status)
        assertEquals("Hãy gửi mã trước khi tiếp tục.", sent.changedEmail("b@trooi.test").verify("123456", 2_000, "123456").error)
    }

    @Test fun changedEmailInvalidatesEveryChallengeState() {
        val verified = EmailOtpState("a@trooi.test").sent(0).verify("123456", 1, "123456")
        assertEquals(EmailOtpStatus.UNVERIFIED, verified.changedEmail("b@trooi.test").status)
        assertEquals(0, verified.changedEmail("b@trooi.test").expiresAt)
        assertEquals(verified, verified.changedEmail(" a@trooi.test "))
        assertEquals(EmailOtpStatus.UNVERIFIED, EmailOtpState("a@trooi.test", EmailOtpStatus.SENDING).changedEmail("b@trooi.test").status)
    }

    @Test fun attemptLimitAndEmptyFixtureCannotVerify() {
        var state = EmailOtpState("a@trooi.test").sent(0)
        repeat(5) { state = state.verify("000000", 1, "123456") }
        assertEquals(EmailOtpStatus.ERROR, state.verify("123456", 2, "123456").status)
        assertEquals(EmailOtpStatus.VERIFIED, state.sent(30_000).verify("123456", 30_001, "123456").status)
        assertEquals(EmailOtpStatus.ERROR, state.sent(0).verify("123456", 1, "").status)
        assertEquals("Hãy gửi mã trước khi tiếp tục.", EmailOtpState().verify("123456", 1, "123456").error)
    }
}
