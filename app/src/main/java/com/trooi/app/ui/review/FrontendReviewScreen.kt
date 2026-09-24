package com.trooi.app.ui.review

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.trooi.app.features.auth.presentation.LoginScreen
import com.trooi.app.features.landlord.dashboard.presentation.LandlordDashboardScreen
import com.trooi.app.features.tenant.home.presentation.TenantHomeScreen

@Composable
fun FrontendReviewScreen(modifier: Modifier = Modifier) {
    val tabs = listOf("Đăng nhập", "Người thuê", "Chủ trọ")
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        bottomBar = {
            Column {
                TabRow(selectedTabIndex = selectedTab) {
                    tabs.forEachIndexed { index, title ->
                        Tab(
                            selected = selectedTab == index,
                            onClick = { selectedTab = index },
                            text = {
                                Text(
                                    text = title,
                                    style = MaterialTheme.typography.labelLarge,
                                )
                            },
                        )
                    }
                }
                Text(
                    text = "DEBUG FRONTEND REVIEW · không dùng làm nguồn quyền người dùng",
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
    ) { innerPadding ->
        when (selectedTab) {
            0 -> LoginScreen(
                onLogin = { _, _ -> },
                modifier = Modifier.padding(innerPadding),
            )
            1 -> TenantHomeScreen(modifier = Modifier.padding(innerPadding))
            else -> LandlordDashboardScreen(modifier = Modifier.padding(innerPadding))
        }
    }
}
