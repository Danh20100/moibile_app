package com.trooi.app.ui.components

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.trooi.app.ui.theme.TroOiGreen
import com.trooi.app.ui.theme.TroOiText

@Composable
fun TroOiBrand(modifier: Modifier = Modifier) {
    Row(modifier = modifier) {
        Text("Trọ", style = MaterialTheme.typography.headlineMedium, color = TroOiText, fontWeight = FontWeight.Bold)
        Text("Ơi", style = MaterialTheme.typography.headlineMedium, color = TroOiGreen, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun TroOiPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Button(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        shape = RoundedCornerShape(18.dp),
        colors = ButtonDefaults.buttonColors(containerColor = TroOiGreen),
    ) {
        Text(text, fontWeight = FontWeight.Bold)
    }
}
