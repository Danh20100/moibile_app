package com.trooi.app.features.discovery

import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.trooi.app.core.model.PublicGeoPoint
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ListingShareIntentTest {
    @get:Rule val compose = createComposeRule()

    private class RecordingContext(base: Context) : ContextWrapper(base) {
        var startedIntent: Intent? = null

        override fun startActivity(intent: Intent?) {
            startedIntent = intent
        }
    }

    @Test fun chooserSharesOnlyPublicListingText() {
        val base = ApplicationProvider.getApplicationContext<Context>()
        val context = RecordingContext(base)
        val fixture = ListingFixtures.resolve("demo-studio")!!.copy(
            host = "PRIVATE_HOST_MARKER",
            description = "PRIVATE_DESCRIPTION_MARKER",
            locationDescription = "PRIVATE_ADDRESS_MARKER",
            costs = listOf("PRIVATE_COST_MARKER"),
            photoUris = emptyList(),
            publicGeoPoint = PublicGeoPoint(10.123456, 106.654321),
            publicPhotoIds = listOf("PRIVATE_PHOTO_ID_MARKER"),
        )

        compose.setContent {
            CompositionLocalProvider(LocalContext provides context) {
                TroOiTheme {
                    ListingDetailScreen(fixture.card.listingId, onBack = {}, presentation = fixture)
                }
            }
        }

        compose.onNodeWithTag("listing-share").performClick()

        val chooser = context.startedIntent
        assertNotNull(chooser)
        assertEquals(Intent.ACTION_CHOOSER, chooser!!.action)
        assertEquals("Chia sẻ tin đăng", chooser.getCharSequenceExtra(Intent.EXTRA_TITLE))
        val send = chooser.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
        assertNotNull(send)
        assertEquals(Intent.ACTION_SEND, send!!.action)
        assertEquals("text/plain", send.type)
        assertEquals(fixture.shareText(), send.getStringExtra(Intent.EXTRA_TEXT))
        listOf(
            "PRIVATE_HOST_MARKER",
            "PRIVATE_DESCRIPTION_MARKER",
            "PRIVATE_ADDRESS_MARKER",
            "PRIVATE_COST_MARKER",
            "PRIVATE_PHOTO_ID_MARKER",
            "10.123456",
            "106.654321",
        ).forEach { assertFalse(send.getStringExtra(Intent.EXTRA_TEXT)!!.contains(it)) }
    }
}
