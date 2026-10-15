package com.trooi.app.core.network.dto

data class MessagingParticipant(val userId: String, val displayName: String, val lastReadAt: String?)
data class MessagingConversation(val id: String, val contextType: String, val contextId: String,
    val participants: List<MessagingParticipant>, val lastReadAt: String?)
data class MessagingAttachment(val id: String, val byteSize: Int, val contentType: String)
data class MessagingMessage(val id: String, val conversationId: String, val senderUserId: String,
    val text: String, val createdAt: String, val delivery: String, val attachments: List<MessagingAttachment>)
data class MessagingMessagePage(val messages: List<MessagingMessage>, val nextCursor: String?, val hasMore: Boolean)
data class MessagingOpen(val id: String)
data class MessagingImageBytes(val contentType: String, val base64: String)
