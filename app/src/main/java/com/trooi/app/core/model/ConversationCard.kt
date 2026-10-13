package com.trooi.app.core.model

/** Local conversation presentation; never a delivery receipt or rental operation. */
data class ConversationMessage(
    val id: String,
    val senderUserId: String,
    val text: String,
    val createdAt: String,
    val localOnly: Boolean = false,
)

data class ConversationCard(
    val id: String,
    val counterpartUserId: String,
    val counterpartName: String,
    val rentalLabel: String,
    val contextId: String,
    val photoResource: Int?,
    val messages: List<ConversationMessage>,
    val photoUri: String? = null,
)
