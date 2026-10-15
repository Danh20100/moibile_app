package com.trooi.app.features

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.core.auth.RefreshCredentialStore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RefreshCredentialStorePersistenceTest {
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext

    @Test
    fun encryptedCredentialSurvivesStoreRecreationAndClearRemovesIt() {
        val store = RefreshCredentialStore(context)
        val credential = "opaque-refresh-credential-test-only"
        store.clear()

        try {
            store.write(credential)
            val values = context.getSharedPreferences("identity_refresh_v1", 0).all.values
            assertFalse(values.any { it == credential })
            assertEquals(credential, RefreshCredentialStore(context).read())

            store.clear()
            assertNull(RefreshCredentialStore(context).read())
        } finally {
            store.clear()
        }
    }

    @Test
    fun corruptedCiphertextFailsClosed() {
        val store = RefreshCredentialStore(context)
        store.clear()
        try {
            store.write("opaque-refresh-credential-test-only")
            context.getSharedPreferences("identity_refresh_v1", 0).edit()
                .putString("ciphertext", "corrupted")
                .commit()

            assertNull(RefreshCredentialStore(context).read())
        } finally {
            store.clear()
        }
    }
}
