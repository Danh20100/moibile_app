package com.trooi.app.features.auth

private val emailPattern = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
private val phonePattern = Regex("^(0|\\+84)\\d{9,10}$")

fun isValidIdentifier(value: String): Boolean {
    val normalized = value.trim().replace(" ", "")
    return emailPattern.matches(normalized) || phonePattern.matches(normalized)
}

fun isValidPassword(value: String, minimumLength: Int = 6): Boolean = value.length >= minimumLength

fun isValidSignup(
    fullName: String,
    phone: String,
    email: String,
    password: String,
    confirmPassword: String,
    acceptedTerms: Boolean,
): Boolean = fullName.trim().length >= 2 &&
    phonePattern.matches(phone.replace(" ", "")) &&
    emailPattern.matches(email.trim()) &&
    isValidPassword(password, minimumLength = 8) &&
    password == confirmPassword &&
    acceptedTerms
