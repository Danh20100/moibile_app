package com.trooi.app.features

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.core.auth.PendingCheckoutHint
import com.trooi.app.core.auth.SessionHints
import com.trooi.app.core.auth.SessionHintsStore
import com.trooi.app.core.model.SelectedContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SessionHintsPersistenceTest {
    @Test
    fun roundTripPersistsOnlyNonSecretHintsAndClears() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val store = SessionHintsStore(context, "trooi_session_hints_test")
        store.clear()
        val hints = SessionHints(
            userId = "user-1",
            restoreEnabled = true,
            selectedContext = SelectedContext.Tenant("t-1"),
            pendingCheckouts = listOf(
                PendingCheckoutHint("t-1", "50000.00", "idem-1", "chk-1"),
            ),
        )
        store.write(hints)
        val values = store.snapshotValues()
        assertFalse(values.any { it.contains("Bearer", ignoreCase = true) })
        assertFalse(values.any { it.contains("payUrl", ignoreCase = true) })
        assertFalse(values.any { it.contains("idToken", ignoreCase = true) })
        assertEquals(hints.userId, store.read()?.userId)
        assertEquals(SelectedContext.Tenant("t-1"), store.read()?.selectedContext)
        assertEquals("idem-1", store.read()?.pendingCheckouts?.single()?.idempotencyKey)
        store.clear()
        assertNull(store.read())
    }
}
