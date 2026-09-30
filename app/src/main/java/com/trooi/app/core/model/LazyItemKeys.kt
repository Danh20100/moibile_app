package com.trooi.app.core.model

/** Unique item keys within a shared LazyColumn, even if one room appears in several sections. */
object LazyItemKeys {
    fun dashboardDebt(roomId: Int) = "dashboard-debt-$roomId"
    fun dashboardTicket(ticketId: String) = "dashboard-ticket-$ticketId"
    fun dashboardAttention(roomId: Int) = "dashboard-attention-$roomId"
    fun financeDebt(roomId: Int) = "finance-debt-$roomId"
    fun financeEntry(entryId: Long) = "finance-entry-$entryId"
}
