package com.trooi.app.features.messages

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.*
import com.trooi.app.ui.components.*
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private fun messageTime(raw: String): String = runCatching {
    Instant.parse(raw).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).format(DateTimeFormatter.ofPattern("HH:mm · dd/MM"))
}.getOrDefault("")

@Composable
fun MessagesScreen(state: TroOiUiState, onExplore: () -> Unit, onReload: () -> Unit,
    onSave: suspend (String, String) -> Result<Unit>) {
    var selectedId by rememberSaveable(state.backendUserId) { mutableStateOf<String?>(null) }
    var search by rememberSaveable(state.backendUserId) { mutableStateOf("") }
    val selected = state.read.conversations.firstOrNull { it.id == selectedId }
    BackHandler(selected != null) { selectedId = null }
    if (selected != null) {
        ConversationScreen(selected, state.backendUserId, { selectedId = null }, onSave)
        return
    }
    val conversations = state.read.conversations.filter { search.isBlank() ||
        (it.counterpartName + " " + it.rentalLabel).contains(search.trim(), ignoreCase = true) }
        .sortedByDescending { it.messages.lastOrNull()?.createdAt }
    LazyColumn(Modifier.fillMaxSize().testTag("messages-screen"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        item { TroOiPageHeader("Tin nhắn", "Trao đổi quanh tài sản thuê") }
        if (state.messagesLoading) item { TroOiStateMessage(TroOiStateKind.LOADING, "Đang tải tin nhắn…") }
        else if (state.messagesLoadFailed) item {
            TroOiStateMessage(TroOiStateKind.ERROR, "Chưa tải được tin nhắn. Vui lòng thử lại.",
                actionText = "Thử lại", onAction = onReload, actionModifier = Modifier.testTag("messages-retry"))
        }
        else if (state.read.conversations.isEmpty()) item {
            Spacer(Modifier.height(28.dp))
            TroOiStateMessage(TroOiStateKind.EMPTY, "Các trao đổi về tài sản thuê sẽ xuất hiện ở đây.",
                title = "Chưa có cuộc trò chuyện", actionText = "Khám phá tài sản", onAction = onExplore,
                actionModifier = Modifier.testTag("messages-empty-explore"))
        } else {
            item { TroOiFormField(search, { search = it }, singleLine = true, label = { Text("Tìm tên hoặc tài sản") },
                leadingIcon = { Icon(Icons.Rounded.Search, null) }, modifier = Modifier.fillMaxWidth().testTag("messages-search")) }
            if (conversations.isEmpty()) item { TroOiStateMessage(TroOiStateKind.EMPTY, "Không tìm thấy cuộc trò chuyện phù hợp.") }
            items(conversations, key = { it.id }) { conversation ->
                Column(Modifier.fillMaxWidth().clickable(role = Role.Button) { selectedId = conversation.id }.testTag("conversation-${conversation.id}")) {
                    Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        LocalRentalPhoto(conversation.photoUri, conversation.photoResource, conversation.rentalLabel, Modifier.size(64.dp).clip(RoundedCornerShape(12.dp)))
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(conversation.counterpartName, style = MaterialTheme.typography.titleMedium)
                            Text(conversation.rentalLabel, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                            Text(conversation.messages.lastOrNull()?.text.orEmpty(), maxLines = 2, overflow = TextOverflow.Ellipsis,
                                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(if (conversation.messages.lastOrNull()?.localOnly == true) "Chưa gửi · Lưu trên thiết bị" else messageTime(conversation.messages.lastOrNull()?.createdAt.orEmpty()),
                                style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    HorizontalDivider(Modifier.padding(top = 12.dp))
                }
            }
        }
    }
}

@Composable
private fun ConversationScreen(conversation: ConversationCard, userId: String, onBack: () -> Unit,
    onSave: suspend (String, String) -> Result<Unit>) {
    var draft by rememberSaveable(userId, conversation.id) { mutableStateOf("") }
    var saving by remember(userId, conversation.id) { mutableStateOf(false) }
    var error by remember(userId, conversation.id) { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val list = rememberLazyListState()
    LaunchedEffect(conversation.id, conversation.messages.size) { if (conversation.messages.isNotEmpty()) list.animateScrollToItem(conversation.messages.lastIndex) }
    Column(Modifier.fillMaxSize().imePadding().testTag("conversation-detail")) {
        Box(Modifier.fillMaxWidth().padding(start = 8.dp, end = 20.dp, top = 12.dp, bottom = 12.dp)) {
            TroOiPageHeader(conversation.counterpartName, conversation.rentalLabel, onBack, "Quay lại Tin nhắn")
        }
        HorizontalDivider()
        LazyColumn(Modifier.weight(1f).fillMaxWidth().testTag("conversation-messages"), state = list,
            contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            items(conversation.messages, key = { it.id }) { message ->
                val own = message.senderUserId == userId
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (own) Arrangement.End else Arrangement.Start) {
                    Column(Modifier.widthIn(max = 300.dp), horizontalAlignment = if (own) Alignment.End else Alignment.Start) {
                        Surface(shape = RoundedCornerShape(12.dp), color = if (own) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
                            contentColor = if (own) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface) {
                            Text(message.text, Modifier.padding(14.dp), style = MaterialTheme.typography.bodyLarge)
                        }
                        Text(messageTime(message.createdAt), Modifier.padding(top = 5.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (message.localOnly) Text("Chưa gửi · Lưu trên thiết bị", style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.testTag("message-local-only"))
                    }
                }
            }
        }
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Tin nhắn mới được lưu trên thiết bị, chưa gửi cho người nhận.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            error?.let { TroOiFeedback(it, error = true) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                TroOiFormField(draft, { draft = it }, label = { Text("Viết tin nhắn") }, maxLines = 3,
                    isError = draft.length > 500,
                    enabled = !saving, modifier = Modifier.weight(1f).testTag("message-composer"))
                TroOiButton(if (saving) "Đang lưu" else "Lưu", onClick = { if (!saving) {
                    saving = true
                    scope.launch {
                        error = null
                        onSave(conversation.id, draft).fold({ draft = "" }, { error = "Chưa lưu được tin nhắn. Nội dung của bạn vẫn được giữ lại." })
                        saving = false
                    }
                } }, enabled = !saving && draft.isNotBlank() && draft.length <= 500, modifier = Modifier.testTag("message-save"))
            }
            Text("${draft.length}/500", style = MaterialTheme.typography.labelSmall,
                color = if (draft.length > 500) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
