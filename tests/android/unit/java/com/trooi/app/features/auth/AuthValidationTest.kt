package com.trooi.app.features.auth

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthValidationTest {
    @Test
    fun identifier_acceptsEmailAndVietnamesePhone() {
        assertTrue(isValidIdentifier("user@example.com"))
        assertTrue(isValidIdentifier("0901234567"))
        assertFalse(isValidIdentifier("not-an-account"))
    }

    @Test
    fun signup_requiresMatchingStrongEnoughPasswordAndTerms() {
        assertTrue(isValidSignup("Nguyen Van A", "0901234567", "user@example.com", "12345678", "12345678", true))
        assertFalse(isValidSignup("Nguyen Van A", "0901234567", "user@example.com", "12345678", "87654321", true))
        assertFalse(isValidSignup("Nguyen Van A", "0901234567", "user@example.com", "12345678", "12345678", false))
    }
}
