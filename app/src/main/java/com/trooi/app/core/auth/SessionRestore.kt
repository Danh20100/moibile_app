package com.trooi.app.core.auth

import com.trooi.app.core.data.UserSession
import com.trooi.app.core.model.ContextResolution
import com.trooi.app.core.model.SelectedContext
import com.trooi.app.core.model.reconcileContext

class NoRestoreCredential : Exception("NO_RESTORE_CREDENTIAL")

data class PendingCheckoutHint(
    val tenancyId: String,
    val amount: String,
    val idempotencyKey: String,
    val checkoutId: String? = null,
)

data class SessionHints(
    val userId: String,
    val restoreEnabled: Boolean,
    val selectedContext: SelectedContext,
    val pendingCheckouts: List<PendingCheckoutHint> = emptyList(),
)

sealed interface RestoreOutcome {
    data class Restored(val session: UserSession, val resolution: ContextResolution) : RestoreOutcome
    data object NeedsLogin : RestoreOutcome
    data object FailedClosed : RestoreOutcome
}

suspend fun restoreVerifiedSession(
    reacquire: suspend () -> Result<String>,
    authenticateGoogle: suspend (String) -> Result<Unit>,
    loadMe: suspend () -> Result<UserSession>,
    hintsFor: (String) -> SessionHints?,
    log: MutableList<String> = mutableListOf(),
): RestoreOutcome {
    val credential = reacquire()
    log += "credential"
    when {
        credential.exceptionOrNull() is NoRestoreCredential -> return RestoreOutcome.NeedsLogin
        credential.isFailure -> return RestoreOutcome.FailedClosed
        credential.getOrNull().isNullOrBlank() -> return RestoreOutcome.NeedsLogin
    }
    val idToken = credential.getOrThrow()

    val google = authenticateGoogle(idToken)
    log += "auth/google"
    if (google.isFailure) return RestoreOutcome.FailedClosed

    val me = loadMe()
    log += "me"
    val session = me.getOrNull() ?: return RestoreOutcome.FailedClosed

    val hints = hintsFor(session.userId)?.takeIf { it.userId == session.userId && it.restoreEnabled }
    log += "hints"
    val resolution = reconcileContext(hints?.selectedContext, session.access)
    log += "context"
    return RestoreOutcome.Restored(session, resolution)
}
