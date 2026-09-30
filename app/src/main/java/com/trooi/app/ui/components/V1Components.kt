package com.trooi.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.trooi.app.ui.theme.*

@Composable
fun V1Panel(
    title: String,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(19.dp),
        color = Color.White,
        border = BorderStroke(1.dp, TroOiLine),
        shadowElevation = 1.dp,
    ) {
        Column(Modifier.padding(17.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = TroOiText, fontWeight = FontWeight.Bold)
            content()
        }
    }
}

@Composable
fun V1PageTitle(title: String, subtitle: String) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = TroOiText)
        Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
    }
}

@Composable
fun V1PreviewNotice() {
    Surface(color = Color(0xFFFFF5DC), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
        Text(
            "DỮ LIỆU MINH HỌA · Chưa kết nối Backend",
            modifier = Modifier.padding(11.dp),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF76521D),
        )
    }
}

@Composable
fun V1Pending(text: String = "Đang chờ dữ liệu có phân quyền từ Backend.") {
    Text(text, style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
}

@Composable
fun V1Metric(label: String, value: String) {
    Column {
        Text(label, style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, color = TroOiGreen)
    }
}

@Composable
fun V1Action(label: String, onClick: () -> Unit, enabled: Boolean = true, modifier: Modifier = Modifier) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = TroOiGreen),
    ) { Text(label) }
}
