package com.trooi.app.features.messages

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.CameraAlt
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Image
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import android.net.Uri
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.File
import java.io.ByteArrayOutputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
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
    onSave: suspend (String, String, List<LocalMessageImage>) -> Result<Unit>,
    onDetailVisibilityChanged: (Boolean) -> Unit = {},
    onOpenContext: (String, String) -> Unit = { _, _ -> },
    onRead: suspend (String) -> Unit = {},
    onAttachment: suspend (String, String) -> Result<ByteArray> = { _, _ -> Result.failure(IllegalStateException()) }) {
    var selectedId by rememberSaveable(state.backendUserId) { mutableStateOf<String?>(null) }
    var search by rememberSaveable(state.backendUserId) { mutableStateOf("") }
    var contextId by rememberSaveable(state.backendUserId) { mutableStateOf("") }
    var contextType by rememberSaveable(state.backendUserId) { mutableStateOf("inquiry") }
    val selected = state.read.conversations.firstOrNull { it.id == selectedId }
    LaunchedEffect(selected != null) { onDetailVisibilityChanged(selected != null) }
    DisposableEffect(Unit) { onDispose { onDetailVisibilityChanged(false) } }
    BackHandler(selected != null) { selectedId = null }
    if (selected != null) {
        LaunchedEffect(selected.id, selected.messages.lastOrNull()?.id, state.messagesLoading) {
            if (!state.messagesLoading) onRead(selected.id)
        }
        ConversationScreen(selected, state.backendUserId, { selectedId = null }, onSave, onAttachment,
            state.messagesLoadFailed, onReload)
        return
    }
    val conversations = state.read.conversations.filter { search.isBlank() ||
        (it.counterpartName + " " + it.rentalLabel).contains(search.trim(), ignoreCase = true) }
        .sortedByDescending { it.messages.lastOrNull()?.createdAt }
    LazyColumn(Modifier.fillMaxSize().testTag("messages-screen"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        if (com.trooi.app.core.data.RuntimeDataSource.isBackendBacked()) item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Mở cuộc trò chuyện từ yêu cầu hoặc hợp đồng", style = MaterialTheme.typography.titleMedium)
                Row {
                    FilterChip(contextType == "inquiry", { contextType = "inquiry" }, { Text("Yêu cầu") })
                    Spacer(Modifier.width(8.dp))
                    FilterChip(contextType == "tenancy", { contextType = "tenancy" }, { Text("Hợp đồng") })
                }
                TroOiFormField(contextId, { contextId = it }, label = { Text("ID yêu cầu / hợp đồng") }, singleLine = true)
                Button(onClick = { onOpenContext(contextType, contextId.trim()) }, enabled = runCatching {
                    java.util.UUID.fromString(contextId.trim()).toString().equals(contextId.trim(), true)
                }.getOrDefault(false)) { Text("Mở cuộc trò chuyện") }
                TextButton(onClick = onReload) { Text("Làm mới") }
            }
        }
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
            item { TroOiFormField(search, { search = it }, singleLine = true, label = { Text("Tìm người hoặc phòng thuê") },
                leadingIcon = { Icon(Icons.Rounded.Search, null) }, modifier = Modifier.fillMaxWidth().testTag("messages-search")) }
            if (conversations.isEmpty()) item { TroOiStateMessage(TroOiStateKind.EMPTY, "Không tìm thấy cuộc trò chuyện phù hợp.") }
            items(conversations, key = { it.id }) { conversation ->
                Surface(onClick = { selectedId = conversation.id }, shape = RoundedCornerShape(18.dp),
                    color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth().testTag("conversation-${conversation.id}")) {
                    Row(Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        LocalRentalPhoto(conversation.photoUri, conversation.photoResource, conversation.rentalLabel, Modifier.size(64.dp).clip(RoundedCornerShape(12.dp)))
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            if (conversation.messages.any { it.senderUserId != state.backendUserId &&
                                (conversation.lastReadAt == null || it.createdAt > conversation.lastReadAt) } &&
                                com.trooi.app.core.data.RuntimeDataSource.isBackendBacked()) {
                                Text("Chưa đọc", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                            }
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Text(conversation.counterpartName, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(messageTime(conversation.messages.lastOrNull()?.createdAt.orEmpty()).substringBefore(" · "),
                                    style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Surface(shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.primaryContainer) {
                                Text(conversation.rentalLabel, Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
                            }
                            Text(conversation.messages.lastOrNull()?.let { message ->
                                (if (message.senderUserId == state.backendUserId) "Bạn: " else "") +
                                    (message.text.takeIf { it.isNotBlank() } ?: if (message.imagePaths.orEmpty().isNotEmpty() || message.attachmentIds.isNotEmpty()) "Hình ảnh" else "")
                            }.orEmpty(), maxLines = 1, overflow = TextOverflow.Ellipsis,
                                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(if (conversation.messages.lastOrNull()?.localOnly == true) "Lưu trên thiết bị · Chưa gửi" else "",
                                style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }

                }
            }
        }
    }
}

@Composable
private fun ConversationScreen(conversation: ConversationCard, userId: String, onBack: () -> Unit,
    onSave: suspend (String, String, List<LocalMessageImage>) -> Result<Unit>,
    onAttachment: suspend (String, String) -> Result<ByteArray>, refreshFailed: Boolean, onReload: () -> Unit) {
    val maxLength = if (com.trooi.app.core.data.RuntimeDataSource.isBackendBacked()) 4000 else 500
    var draft by rememberSaveable(userId, conversation.id) { mutableStateOf("") }
    var saving by remember(userId, conversation.id) { mutableStateOf(false) }
    var error by remember(userId, conversation.id) { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val list = rememberLazyListState()
    val context = LocalContext.current
    val photos = remember(userId, conversation.id) { mutableStateListOf<DraftMessagePhoto>() }
    var loadingPhotos by remember(userId, conversation.id) { mutableStateOf(false) }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        if (bitmap != null && photos.size < 5) {
            val output = ByteArrayOutputStream()
            if (bitmap.compress(Bitmap.CompressFormat.JPEG, 80, output) && output.size() <= 2_000_000) {
                photos.add(DraftMessagePhoto(output.toByteArray(), bitmap.asImageBitmap()))
            } else error = "Không xử lý được ảnh. Hãy thử lại."
        }
    }
    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(5)) { chosen ->
        if (chosen.isNotEmpty()) scope.launch {
            loadingPhotos = true
            error = null
            try {
                chosen.take(5 - photos.size).forEach { uri -> photos.add(prepareMessagePhoto(context, uri)) }
            } catch (failure: Exception) {
                error = failure.message ?: "Không thể mở ảnh đã chọn."
            } finally {
                loadingPhotos = false
            }
        }
    }
    LaunchedEffect(conversation.id, conversation.messages.size) { if (conversation.messages.isNotEmpty()) list.animateScrollToItem(conversation.messages.lastIndex) }
    Column(Modifier.fillMaxSize().imePadding().testTag("conversation-detail")) {
        Box(Modifier.fillMaxWidth().padding(start = 8.dp, end = 20.dp, top = 12.dp, bottom = 12.dp)) {
            TroOiPageHeader(conversation.counterpartName, conversation.rentalLabel, onBack, "Quay lại Tin nhắn")
        }
        HorizontalDivider()
        if (refreshFailed) Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Chưa cập nhật được tin nhắn.", Modifier.weight(1f), color = MaterialTheme.colorScheme.error)
            TextButton(onClick = onReload) { Text("Thử lại") }
        }
        LazyColumn(Modifier.weight(1f).fillMaxWidth().testTag("conversation-messages"), state = list,
            contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            items(conversation.messages, key = { it.id }) { message ->
                val own = message.senderUserId == userId
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (own) Arrangement.End else Arrangement.Start) {
                    Column(Modifier.widthIn(max = 300.dp), horizontalAlignment = if (own) Alignment.End else Alignment.Start) {
                        Surface(shape = RoundedCornerShape(12.dp), color = if (own) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
                            contentColor = if (own) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface) {
                            Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                if (message.attachmentIds.isNotEmpty()) SecureMessagePhotoGrid(userId, conversation.id, message.attachmentIds, onAttachment)
                                if (message.imagePaths.orEmpty().isNotEmpty()) SavedMessagePhotoGrid(message.imagePaths.orEmpty())
                                if (message.text.isNotBlank()) Text(message.text, Modifier.padding(4.dp),
                                    style = MaterialTheme.typography.bodyLarge)
                            }
                        }
                        Text(messageTime(message.createdAt), Modifier.padding(top = 5.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (message.localOnly) Text("Chưa gửi · Lưu trên thiết bị", style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.testTag("message-local-only"))
                        else if (own && com.trooi.app.core.data.RuntimeDataSource.isBackendBacked()) Text("Đã lưu trên máy chủ", style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        Surface(color = MaterialTheme.colorScheme.background, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (photos.isNotEmpty()) DraftPhotoStrip(photos) { index -> photos.removeAt(index) }
                error?.let { TroOiFeedback(it, error = true) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (com.trooi.app.core.data.RuntimeDataSource.isBackendBacked()) IconButton(
                        onClick = { camera.launch(null) }, enabled = !saving && !loadingPhotos && photos.size < 5,
                        modifier = Modifier.size(48.dp)) { Icon(Icons.Rounded.CameraAlt, "Chụp ảnh") }
                    IconButton(
                        onClick = { photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                        modifier = Modifier.size(48.dp).testTag("message-add-photo"),
                        enabled = !saving && !loadingPhotos && photos.size < 5,
                    ) { Icon(Icons.Rounded.Image, "Chọn ảnh", tint = MaterialTheme.colorScheme.primary) }
                    TroOiFormField(draft, { draft = it }, label = { Text("Nhắn tin…") }, maxLines = 3,
                        isError = draft.length > maxLength,
                        enabled = !saving, modifier = Modifier.weight(1f).testTag("message-composer"))
                    FilledIconButton(
                        onClick = {
                            val content = draft
                            val attachments = photos.map { LocalMessageImage(it.bytes) }
                            saving = true
                            scope.launch {
                                error = null
                                onSave(conversation.id, content, attachments).fold(
                                    { draft = ""; photos.clear() },
                                    { error = "Chưa lưu được tin nhắn. Nội dung của bạn vẫn được giữ lại." }
                                )
                                saving = false
                            }
                        },
                        enabled = !saving && !loadingPhotos && draft.length <= maxLength &&
                            (draft.isNotBlank() || photos.isNotEmpty()),
                        modifier = Modifier.size(48.dp).testTag("message-save"),
                    ) { Icon(Icons.AutoMirrored.Rounded.Send, "Gửi tin nhắn", Modifier.size(23.dp)) }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(if (com.trooi.app.core.data.RuntimeDataSource.isBackendBacked()) "Gửi qua máy chủ · Tự làm mới mỗi 8 giây" else "Lưu trên thiết bị · Chưa gửi tới người nhận",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("${draft.length}/$maxLength", style = MaterialTheme.typography.labelSmall,
                        color = if (draft.length > maxLength) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
