package com.trooi.app.features.profile

import org.junit.Assert.*
import org.junit.Test

class AccountSecurityTest {
    @Test fun pinFirstNeverDowngradesUnknownOrConfiguredPin() {
        assertEquals(ReauthenticationMethod.PIN, reauthenticationMethod(true, true))
        assertEquals(ReauthenticationMethod.PIN, reauthenticationMethod(true, false))
        assertEquals(ReauthenticationMethod.PASSWORD, reauthenticationMethod(false, true))
        assertEquals(ReauthenticationMethod.RECOVERY, reauthenticationMethod(false, false))
        assertEquals(ReauthenticationMethod.UNKNOWN, reauthenticationMethod(null, true))
        assertEquals(ReauthenticationMethod.UNKNOWN, reauthenticationMethod(false, null))
    }
    @Test fun onlySixAsciiDigitsAndCooldownAfterFiveErrors() {
        assertTrue(validSecurityPin("482795"))
        listOf("", "12345", "1234567", "12 456", "١٢٣٤٥٦").forEach { assertFalse(validSecurityPin(it)) }
        var retry = SecurityRetry()
        repeat(4) { retry = retry.failed(1_000); assertTrue(retry.canTry(1_000)) }
        retry = retry.failed(1_000)
        assertFalse(retry.canTry(30_999))
        assertTrue(retry.canTry(31_000))
    }
}
