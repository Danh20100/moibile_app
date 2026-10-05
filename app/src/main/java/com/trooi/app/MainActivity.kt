package com.trooi.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import com.trooi.app.features.tenancy.PaymentReturnUri
import com.trooi.app.ui.TroOiApp
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val paymentReturn = mutableStateOf<PaymentReturnUri?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        paymentReturn.value = paymentReturnFrom(intent)
        enableEdgeToEdge()
        setContent {
            TroOiApp(paymentReturnUri = paymentReturn.value)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        paymentReturn.value = paymentReturnFrom(intent)
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
