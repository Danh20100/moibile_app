package com.trooi.app.features.discovery

import com.trooi.app.core.model.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class DiscoveryCardsTest {
    private fun listing(id: String = "real-listing", visibility: ListingVisibility = ListingVisibility.PUBLISHED) =
        PublicListingCard(id, "Studio thật", "Thủ Đức", null, "3200000", visibility)

    @Test fun backendInventoryWinsAndEmptySearchDoesNotBecomeDemo() {
        val cards = discoveryCards(listOf(listing(), listing("draft", ListingVisibility.DRAFT)), true)
        assertEquals(listOf("real-listing"), cards.map { it.listingId })
        assertEquals("Studio thật", cards.single().title)
        assertTrue(discoveryCards(emptyList(), false).isEmpty())
        assertTrue(discoveryCards(listOf(listing()), true, area = "Hà Nội").isEmpty())
        assertEquals(2, discoveryCards(emptyList(), true).size)
        assertEquals("demo-studio", discoveryCards(emptyList(), true, type = "Căn hộ").single().listingId)
    }

    @Test fun filtersAndDetailRoutingPreserveRealAndFixtureIdentity() {
        val real = listOf(listing())
        assertEquals("real-listing", discoveryCards(real, false, area = "thu duc", type = "Studio", maximum = "4000000").single().listingId)
        assertTrue(discoveryCards(real, false, minimum = "4000000").isEmpty())
        assertFalse(useFixtureDetail("real-listing", real))
        assertTrue(useFixtureDetail("demo-studio", real))
        assertFalse(useFixtureDetail("demo-studio", listOf(listing("demo-studio"))))
        assertNull(discoveryCards(listOf(listing("demo-studio")), true).single().rating)
    }

    @Test fun backendSearchResetAndV1DetailWiringRemainAvailable() {
        val app = File("src/main/java/com/trooi/app/ui/TroOiApp.kt").readText()
        listOf("onSearch = if (RuntimeDataSource.isBackendBacked()) viewModel::searchPublicListings else null",
            "onResetSearch = if (RuntimeDataSource.isBackendBacked()) viewModel::reloadPublicListings else null",
            "allowDemoFallback = !RuntimeDataSource.isBackendBacked()", "useFixtureDetail(page.listingId, state.read.publicListings, state.demoPreview)",
            "else V1ListingDetailScreen(").forEach { assertTrue(app.contains(it)) }
    }
}
