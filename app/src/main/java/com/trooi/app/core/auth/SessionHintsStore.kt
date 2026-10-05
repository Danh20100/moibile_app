package com.trooi.app.core.auth

import android.content.Context
import com.trooi.app.core.model.SelectedContext
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import org.json.JSONArray
import org.json.JSONObject

@Singleton
class SessionHintsStore(
    context: Context,
    prefsName: String = PREFS,
) {
    @Inject
    constructor(@ApplicationContext context: Context) : this(context, PREFS)

    private val prefs = context.getSharedPreferences(prefsName, Context.MODE_PRIVATE)

    fun read(): SessionHints? {
        val userId = prefs.getString(KEY_USER_ID, null)?.takeIf { it.isNotBlank() } ?: return null
        if (!prefs.getBoolean(KEY_RESTORE, false)) return null
        return SessionHints(
            userId = userId,
            restoreEnabled = true,
            selectedContext = decodeContext(prefs.getString(KEY_CONTEXT, null)),
            pendingCheckouts = decodePending(prefs.getString(KEY_PENDING, null)),
        )
    }

    fun write(hints: SessionHints) {
        require(hints.userId.isNotBlank())
        prefs.edit()
            .putString(KEY_USER_ID, hints.userId)
            .putBoolean(KEY_RESTORE, hints.restoreEnabled)
            .putString(KEY_CONTEXT, encodeContext(hints.selectedContext))
            .putString(KEY_PENDING, encodePending(hints.pendingCheckouts))
            .apply()
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    fun snapshotValues(): Collection<String> = prefs.all.values.mapNotNull { it?.toString() }

    companion object {
        const val PREFS = "trooi_session_hints"
        private const val KEY_USER_ID = "userId"
        private const val KEY_RESTORE = "restoreEnabled"
        private const val KEY_CONTEXT = "selectedContext"
        private const val KEY_PENDING = "pendingCheckouts"

        fun encodeContext(context: SelectedContext): String = when (context) {
            SelectedContext.Discovery -> "discovery"
            is SelectedContext.Tenant -> "tenant:" + context.tenancyId
            is SelectedContext.Operations -> "operations:" + context.organizationId
        }

        fun decodeContext(raw: String?): SelectedContext = when {
            raw.isNullOrBlank() || raw == "discovery" -> SelectedContext.Discovery
            raw.startsWith("tenant:") ->
                raw.removePrefix("tenant:").takeIf { it.isNotBlank() }?.let(SelectedContext::Tenant)
                    ?: SelectedContext.Discovery
            raw.startsWith("operations:") ->
                raw.removePrefix("operations:").takeIf { it.isNotBlank() }?.let(SelectedContext::Operations)
                    ?: SelectedContext.Discovery
            else -> SelectedContext.Discovery
        }

        private fun encodePending(items: List<PendingCheckoutHint>): String {
            val array = JSONArray()
            items.forEach { item ->
                array.put(
                    JSONObject()
                        .put("tenancyId", item.tenancyId)
                        .put("amount", item.amount)
                        .put("idempotencyKey", item.idempotencyKey)
                        .put("checkoutId", item.checkoutId),
                )
            }
            return array.toString()
        }

        private fun decodePending(raw: String?): List<PendingCheckoutHint> {
            if (raw.isNullOrBlank()) return emptyList()
            return runCatching {
                val array = JSONArray(raw)
                buildList {
                    for (i in 0 until array.length()) {
                        val obj = array.getJSONObject(i)
                        add(
                            PendingCheckoutHint(
                                tenancyId = obj.getString("tenancyId"),
                                amount = obj.getString("amount"),
                                idempotencyKey = obj.getString("idempotencyKey"),
                                checkoutId = obj.optString("checkoutId").takeIf { it.isNotBlank() },
                            ),
                        )
                    }
                }
            }.getOrDefault(emptyList())
        }
    }
}
