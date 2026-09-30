package com.trooi.app.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class LazyItemKeysTest {
    @Test
    fun theSameRoomInTwoDashboardSectionsNeverSharesAKey() {
        val debt = LazyItemKeys.dashboardDebt(2)
        val attention = LazyItemKeys.dashboardAttention(2)
        assertNotEquals(debt, attention)
        assertEquals(2, setOf(debt, attention).size)
    }

    @Test
    fun ticketAndRoomKeysRemainDistinctAcrossDashboard() {
        val allKeys = listOf(
            LazyItemKeys.dashboardDebt(2),
            LazyItemKeys.dashboardTicket("2"),
            LazyItemKeys.dashboardAttention(2),
            LazyItemKeys.financeDebt(2),
            LazyItemKeys.financeEntry(2L),
        )
        assertEquals(allKeys.size, allKeys.toSet().size)
    }
}
