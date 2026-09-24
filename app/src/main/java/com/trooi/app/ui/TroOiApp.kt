package com.trooi.app.ui

import androidx.compose.runtime.Composable
import com.trooi.app.BuildConfig
import com.trooi.app.features.auth.presentation.LoginScreen
import com.trooi.app.ui.review.FrontendReviewScreen
import com.trooi.app.ui.theme.TroOiTheme

@Composable
fun TroOiApp() {
    TroOiTheme {
        if (BuildConfig.DEBUG) {
            FrontendReviewScreen()
        } else {
            LoginScreen(onLogin = { _, _ -> })
        }
    }
}
