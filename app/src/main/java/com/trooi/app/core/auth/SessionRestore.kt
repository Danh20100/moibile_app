package com.trooi.app.core.auth

import com.trooi.app.core.data.UserSession
import com.trooi.app.core.model.ContextResolution
import com.trooi.app.core.model.SelectedContext
import com.trooi.app.core.model.resolvePostLoginLanding

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
    restore: suspend () -> Result<UserSession>,
    hintsFor: (String) -> SessionHints?,
    log: MutableList<String> = mutableListOf(),
): RestoreOutcome {
    val result = restore()
    log += "session/refresh"
    when {
        result.exceptionOrNull() is NoRestoreCredential -> return RestoreOutcome.NeedsLogin
        result.isFailure -> return RestoreOutcome.FailedClosed
    }
    val session = result.getOrNull() ?: return RestoreOutcome.FailedClosed

    val hints = hintsFor(session.userId)?.takeIf { it.userId == session.userId && it.restoreEnabled }
    log += "hints"
    val resolution = resolvePostLoginLanding(session.access, hints?.selectedContext)
    log += "context"
    return RestoreOutcome.Restored(session, resolution)
}
