package com.trooi.app.features.profile

import android.content.Intent
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag

@Composable
fun LocalOcrEntry() {
    val context = LocalContext.current
    TextButton(onClick = { context.startActivity(Intent(context, LocalOcrDemoActivity::class.java)) },
        modifier = Modifier.testTag("profile-ocr-demo")) { Text("Thử đọc chữ từ ảnh") }
}
