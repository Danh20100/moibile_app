package com.trooi.app.features.auth

import org.junit.Assert.*
import org.junit.Test

class EmailOtpLifecycleTest {
    @Test fun replacementRejectsEarlierResponse() {
        val lifecycle = EmailOtpLifecycle()
        val first = lifecycle.begin(EmailOtpLifecycle.Purpose.REGISTRATION)
        val replacement = lifecycle.begin(EmailOtpLifecycle.Purpose.REGISTRATION)
        assertFalse(lifecycle.isCurrent(first))
        assertTrue(lifecycle.isCurrent(replacement))
    }

    @Test fun switchingFlowsRejectsRegistrationResponseAndPurpose() {
        val lifecycle = EmailOtpLifecycle()
        val registration = lifecycle.begin(EmailOtpLifecycle.Purpose.REGISTRATION)
        val reset = lifecycle.begin(EmailOtpLifecycle.Purpose.PASSWORD_RESET)
        assertFalse(lifecycle.isCurrent(registration))
        assertTrue(lifecycle.isCurrent(reset))
        assertFalse(lifecycle.hasPurpose(EmailOtpLifecycle.Purpose.REGISTRATION))
        assertTrue(lifecycle.hasPurpose(EmailOtpLifecycle.Purpose.PASSWORD_RESET))
    }

    @Test fun editingCredentialsRejectsResponseAndClearsPurpose() {
        val lifecycle = EmailOtpLifecycle()
        val request = lifecycle.begin(EmailOtpLifecycle.Purpose.REGISTRATION)
        lifecycle.invalidate()
        assertFalse(lifecycle.isCurrent(request))
        assertFalse(lifecycle.hasPurpose(EmailOtpLifecycle.Purpose.REGISTRATION))
        assertFalse(lifecycle.hasRequest())
    }

    @Test fun oldResponseCannotBecomeCurrentAfterLeavingAndReturningToSameFlow() {
        val lifecycle = EmailOtpLifecycle()
        val old = lifecycle.begin(EmailOtpLifecycle.Purpose.PASSWORD_RESET)
        lifecycle.invalidate()
        val fresh = lifecycle.begin(EmailOtpLifecycle.Purpose.PASSWORD_RESET)
        assertFalse(lifecycle.isCurrent(old))
        assertTrue(lifecycle.isCurrent(fresh))
    }
    @Test fun verificationOwnershipIsRevokedOnInvalidation() {
        val lifecycle = EmailOtpLifecycle()
        lifecycle.begin(EmailOtpLifecycle.Purpose.REGISTRATION)
        val verification = lifecycle.capture(EmailOtpLifecycle.Purpose.REGISTRATION)!!
        lifecycle.invalidate()
        assertFalse(lifecycle.isCurrent(verification))
        assertNull(lifecycle.capture(EmailOtpLifecycle.Purpose.REGISTRATION))
    }

    @Test fun replacementRequestCannotBeOwnedByAnEarlierVerification() {
        val lifecycle = EmailOtpLifecycle()
        lifecycle.begin(EmailOtpLifecycle.Purpose.PASSWORD_RESET)
        val verification = lifecycle.capture(EmailOtpLifecycle.Purpose.PASSWORD_RESET)!!
        val replacement = lifecycle.begin(EmailOtpLifecycle.Purpose.PASSWORD_RESET)
        assertFalse(lifecycle.isCurrent(verification))
        assertTrue(lifecycle.isCurrent(replacement))
    }

    @Test fun verificationCannotCaptureAnotherPurpose() {
        val lifecycle = EmailOtpLifecycle()
        lifecycle.begin(EmailOtpLifecycle.Purpose.REGISTRATION)
        assertNull(lifecycle.capture(EmailOtpLifecycle.Purpose.PASSWORD_RESET))
        assertNotNull(lifecycle.capture(EmailOtpLifecycle.Purpose.REGISTRATION))
    }
}
