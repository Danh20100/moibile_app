package com.trooi.app.features.profile

import org.junit.Assert.*
import org.junit.Test

class MockAccountSecurityTest {
    @Test fun existingPasswordAccountsAndPinOwnerStayConsistent() {
        for (id in listOf("fixture-user-lan", "fixture-user-linh")) {
            assertEquals(ReauthenticationMethod.PASSWORD, MockAccountSecurity.method(id))
            assertTrue(MockAccountSecurity.matches(id, ReauthenticationMethod.PASSWORD, "TroOi2026!"))
            assertFalse(MockAccountSecurity.matches(id, ReauthenticationMethod.PASSWORD, "wrong"))
        }
        assertTrue(MockAccountSecurity.matches("fixture-user-ha", ReauthenticationMethod.PIN, "482795"))
        assertFalse(MockAccountSecurity.matches("fixture-user-ha", ReauthenticationMethod.PIN, com.trooi.app.features.auth.MockEmailOtp.code))
        assertEquals(ReauthenticationMethod.PIN, MockAccountSecurity.method("fixture-user-ha"))
        assertEquals(ReauthenticationMethod.RECOVERY, MockAccountSecurity.method("fixture-google-only"))
        assertFalse(MockAccountSecurity.matches("fixture-google-only", ReauthenticationMethod.PASSWORD, "TroOi2026!"))
        assertEquals(ReauthenticationMethod.UNKNOWN, MockAccountSecurity.method("unknown"))
    }
}
