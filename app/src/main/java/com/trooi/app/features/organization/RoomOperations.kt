package com.trooi.app.features.organization

fun legalRoomTargets(state: String): Set<String> = when (state.trim().uppercase()) {
    "VACANT" -> setOf("MAINTENANCE", "INACTIVE")
    "MAINTENANCE" -> setOf("VACANT", "INACTIVE")
    "INACTIVE" -> setOf("VACANT")
    else -> emptySet()
}

fun wireRoomOperationalState(state: String): String = state.trim().uppercase().lowercase()
