package com.trooi.app.features.organization

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RoomOperationsTest {
    @Test
    fun legalMatrixAllowsOnlyFiveManualTransitions() {
        assertEquals(setOf("MAINTENANCE", "INACTIVE"), legalRoomTargets("VACANT"))
        assertEquals(setOf("VACANT", "INACTIVE"), legalRoomTargets("maintenance"))
        assertEquals(setOf("VACANT"), legalRoomTargets("INACTIVE"))
        assertEquals(emptySet<String>(), legalRoomTargets("OCCUPIED"))
        assertEquals(emptySet<String>(), legalRoomTargets("occupied"))
        assertEquals(emptySet<String>(), legalRoomTargets("unknown"))
        assertEquals(emptySet<String>(), legalRoomTargets(""))

        val legal = listOf(
            "VACANT" to "MAINTENANCE",
            "VACANT" to "INACTIVE",
            "MAINTENANCE" to "VACANT",
            "MAINTENANCE" to "INACTIVE",
            "INACTIVE" to "VACANT",
        )
        legal.forEach { (from, to) ->
            assertTrue("$from -> $to", to in legalRoomTargets(from))
        }
        assertFalse("OCCUPIED" in legalRoomTargets("VACANT"))
        assertFalse("VACANT" in legalRoomTargets("OCCUPIED"))
        assertFalse("MAINTENANCE" in legalRoomTargets("INACTIVE"))
        assertEquals("vacant", wireRoomOperationalState("VACANT"))
    }
}
