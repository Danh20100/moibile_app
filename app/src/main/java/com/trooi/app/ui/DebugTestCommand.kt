package com.trooi.app.ui

/** Ephemeral test inputs supplied by the local desktop harness. Never saved as credentials. */
data class DebugTestCommand(
    val id: Long,
    val route: String,
    val mode: String = "",
    val identifier: String = "",
    val password: String = "",
    val fullName: String = "",
    val phone: String = "",
    val email: String = "",
    val listingId: String = "",
)
