package com.trooi.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import com.trooi.app.features.tenancy.PaymentReturnUri
import com.trooi.app.ui.TroOiApp
import com.trooi.app.ui.DebugTestCommand
import com.trooi.app.ui.DebugTestIntent
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val paymentReturn = mutableStateOf<PaymentReturnUri?>(null)
    private val rentalJoinToken = mutableStateOf<String?>(null)
    private val testCommand = mutableStateOf<DebugTestCommand?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        paymentReturn.value = paymentReturnFrom(intent)
        rentalJoinToken.value = rentalJoinTokenFrom(intent)
        testCommand.value = DebugTestIntent.parse(intent)
        enableEdgeToEdge()
        setContent {
            TroOiApp(paymentReturnUri = paymentReturn.value, debugTestCommand = testCommand.value, rentalJoinToken = rentalJoinToken.value)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        paymentReturn.value = paymentReturnFrom(intent)
        rentalJoinToken.value = rentalJoinTokenFrom(intent) ?: rentalJoinToken.value
        DebugTestIntent.parse(intent)?.let { testCommand.value = it }
    }
}

internal fun paymentReturnFrom(intent: Intent?): PaymentReturnUri? {
    if (intent?.action != Intent.ACTION_VIEW) return null
    val uri = intent.data ?: return null
    return PaymentReturnUri(
        scheme = uri.scheme,
        host = uri.host,
        path = uri.path,
        query = uri.queryParameterNames.associateWith { uri.getQueryParameter(it).orEmpty() },
    )
}

internal fun rentalJoinTokenFrom(intent: Intent?): String? {
    if (intent?.action != Intent.ACTION_VIEW) return null
    val uri = intent.data ?: return null
    if (uri.scheme != "trooi" || uri.host != "join") return null
    return uri.getQueryParameter("token")?.takeIf { it.matches(Regex("[a-fA-F0-9]{64}")) }
}
