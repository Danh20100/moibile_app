package com.trooi.app.core.auth

import android.content.Context
import android.util.Log
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.trooi.app.BuildConfig
import javax.inject.Inject

/** Retrieves a Google ID Token only; Backend remains the identity verifier. */
class GoogleCredentialAuth @Inject constructor() {
    suspend fun getIdToken(context: Context): Result<String> {
        val result = runCatching {
            val clientId = BuildConfig.GOOGLE_WEB_CLIENT_ID.trim()
            require(clientId.isNotEmpty()) {
                "Thiếu cấu hình Google Web Client ID cho đăng nhập."
            }

            // Explicit Google button flow.
            val option = GetSignInWithGoogleOption.Builder(clientId).build()
            val request = GetCredentialRequest.Builder()
                .addCredentialOption(option)
                .build()

            val credential = CredentialManager.create(context)
                .getCredential(context = context, request = request)
                .credential

            if (credential !is CustomCredential ||
                credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
            ) {
                error("Google không trả về ID Token hợp lệ.")
            }

            GoogleIdTokenCredential.createFrom(credential.data).idToken
                .takeIf(String::isNotBlank)
                ?: error("Google ID Token trống.")
        }

        result.exceptionOrNull()?.let { error ->
            Log.w(TAG, "Credential Manager failed: " + error::class.java.simpleName + ": " + error.message)
        }
        return result
    }

    private companion object {
        const val TAG = "TroOiGoogleAuth"
    }
}
