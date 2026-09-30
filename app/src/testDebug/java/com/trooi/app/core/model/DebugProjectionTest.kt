package com.trooi.app.core.model

import com.trooi.app.core.data.TroOiRepositoryImpl
import com.trooi.app.core.demo.DemoData
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test

class DebugProjectionTest {
    @Test fun debugPublicFixturesContainOnlyPublishedListings() {
        assertTrue(DemoData.read.publicListings.all { it.visibility == ListingVisibility.PUBLISHED })
    }

    @Test fun debugInquiryDoesNotClaimBackendSuccess() = runBlocking {
        val result = TroOiRepositoryImpl().submitInquiry("preview-listing-a", "Tôi quan tâm")
        assertTrue(result.isFailure)
    }
}
