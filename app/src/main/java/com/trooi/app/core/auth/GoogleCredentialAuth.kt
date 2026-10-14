package com.trooi.app.core.auth

import android.content.Context
import android.util.Log
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.trooi.app.BuildConfig
import com.trooi.app.core.network.BackendApi
import com.trooi.app.core.network.dto.ApiOutcome
import javax.inject.Inject

/** Retrieves a Google ID Token only; Backend remains the identity verifier. */
data class GoogleCredentialProof(val idToken: String, val nonce: String)

class GoogleCredentialAuth @Inject constructor(private val api: BackendApi) {
    suspend fun getIdToken(context: Context): Result<GoogleCredentialProof> = requestIdToken(context, returning = false)

    suspend fun getRegistrationIdToken(context: Context): Result<GoogleCredentialProof> =
        requestIdToken(context, returning = false, purpose = "REGISTER")

    suspend fun reacquireIdToken(context: Context): Result<GoogleCredentialProof> = requestIdToken(context, returning = true)

    suspend fun reacquireForReauthentication(context: Context, nonce: String): Result<String> =
        requestCredential(context, returning = false, nonce = nonce)

    suspend fun clearCredentialState(context: Context): Result<Unit> = runCatching {
        CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest())
    }.onFailure { error ->
        Log.w(TAG, "clearCredentialState failed: " + error::class.java.simpleName + ": " + error.message)
    }

    private suspend fun requestIdToken(
        context: Context,
        returning: Boolean,
        purpose: String = "LOGIN",
    ): Result<GoogleCredentialProof> {
        val challenge = when (val result = api.issueIdentityChallenge(purpose)) {
            is ApiOutcome.Data -> result.value
            is ApiOutcome.Failure -> return Result.failure(IllegalStateException("Identity challenge unavailable: ${result.kind}"))
        }
        val clientId = BuildConfig.GOOGLE_WEB_CLIENT_ID.trim()
        // ponytail: blank local config is not a revoked session; sign-in still fails closed below.
        if (clientId.isEmpty() && returning) return Result.failure(NoRestoreCredential())
        val result = runCatching {
            require(clientId.isNotEmpty()) {
                "Thiếu cấu hình Google Web Client ID cho đăng nhập."
            }
            GoogleCredentialProof(requestCredential(context, returning, challenge.nonce).getOrThrow(), challenge.nonce)
        }
        result.exceptionOrNull()?.let { error ->
            Log.w(TAG, "Credential Manager failed: " + error::class.java.simpleName + ": " + error.message)
        }
        return when (result.exceptionOrNull()) {
            is NoCredentialException -> Result.failure(NoRestoreCredential())
            is GetCredentialCancellationException -> result
            else -> result
        }
    }

    private suspend fun requestCredential(context: Context, returning: Boolean, nonce: String): Result<String> = runCatching {
        val clientId = BuildConfig.GOOGLE_WEB_CLIENT_ID.trim()
        require(clientId.isNotEmpty()) { "Thiếu cấu hình Google Web Client ID cho đăng nhập." }
        val option = if (returning) {
            GetGoogleIdOption.Builder().setFilterByAuthorizedAccounts(true).setAutoSelectEnabled(true)
                .setServerClientId(clientId).setNonce(nonce).build()
        } else {
            GetSignInWithGoogleOption.Builder(clientId).setNonce(nonce).build()
        }
        val request = GetCredentialRequest.Builder()
                .addCredentialOption(option)
                .build()
        val credential = CredentialManager.create(context)
                .getCredential(context = context, request = request)
                .credential
        if (credential !is CustomCredential ||
                credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) error("Google không trả về ID Token hợp lệ.")
        GoogleIdTokenCredential.createFrom(credential.data).idToken
                .takeIf(String::isNotBlank)
                ?: error("Google ID Token trống.")
    }

    private companion object {
        const val TAG = "TroOiGoogleAuth"
    }
}
