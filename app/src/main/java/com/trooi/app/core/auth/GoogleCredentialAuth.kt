package com.trooi.app.core.auth

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.trooi.app.BuildConfig
import javax.inject.Inject

/** Retrieves a Google ID Token only; Backend remains the identity verifier. */
class GoogleCredentialAuth @Inject constructor() {
    suspend fun getIdToken(context: Context): Result<String> = runCatching {
        val clientId = BuildConfig.GOOGLE_WEB_CLIENT_ID.trim()
        require(clientId.isNotEmpty()) {
            "Thiếu TROOI_GOOGLE_WEB_CLIENT_ID/trooiGoogleWebClientId cho Google sign-in."
        }

        val option = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(clientId)
            .setAutoSelectEnabled(false)
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(option)
            .build()
        val credential = CredentialManager.create(context)
            .getCredential(context = context, request = request)
            .credential

        if (credential !is CustomCredential ||
            credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
            error("Credential trả về không phải Google ID Token.")
        }

        GoogleIdTokenCredential.createFrom(credential.data).idToken
            .takeIf(String::isNotBlank)
            ?: error("Google ID Token trống.")
    }
}
