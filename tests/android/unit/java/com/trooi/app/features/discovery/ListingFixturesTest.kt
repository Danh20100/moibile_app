package com.trooi.app.features.discovery

import org.junit.Assert.*
import org.junit.Test
import java.io.File

class ListingFixturesTest {
    @Test fun advertisedCostsStaySeparateFromRulesAndRentalFinance() {
        ListingFixtures.all.forEach { detail ->
            assertTrue(detail.costs.any { it.startsWith("Cọc dự kiến:") })
            assertTrue(detail.costs.any { it.startsWith("Điện") })
            assertFalse(detail.rules.any { it.startsWith("Cọc") || it.startsWith("Điện") || it.startsWith("Nước") })
        }
        val room = ListingFixtures.resolve("demo-room")!!
        assertTrue(room.costs.any { it.contains("trao đổi", ignoreCase = true) })
        assertFalse(room.costs.any { it.contains("3.500") })
    }
    @Test fun eachCardResolvesItsOwnConsistentDetailAndImages() {
        val cards = ListingFixtures.cards("", "Tất cả", "", "")
        assertEquals(2, cards.size)
        assertEquals(cards.size, cards.map { it.listingId }.toSet().size)
        cards.forEach { card ->
            val detail = requireNotNull(ListingFixtures.resolve(card.listingId))
            assertEquals(card, detail.card)
            assertTrue(detail.images.size >= 2)
            assertTrue(detail.amenities.isNotEmpty())
            assertTrue(detail.rules.isNotEmpty())
        }
        assertEquals(2, cards.map { ListingFixtures.resolve(it.listingId)!!.images.first() }.toSet().size)
        assertNull(ListingFixtures.resolve("unknown"))
    }

    @Test fun localSearchPreservesFixtureIdentityAndFilters() {
        val studio = ListingFixtures.cards("thu duc", "Căn hộ", "3000000", "4000000").single()
        assertEquals("demo-studio", studio.listingId)
        assertEquals(studio, ListingFixtures.resolve(studio.listingId)!!.card)
        assertTrue(ListingFixtures.cards("", "Tất cả", "6000000", "").isEmpty())
        assertTrue(ListingFixtures.cards("", "Tất cả", "invalid", "").isEmpty())
    }

    @Test fun detailUsesRealContactAndReportWithoutBookingOrPayment() {
        val source = File("src/main/java/com/trooi/app/features/discovery/ListingDetailScreen.kt").readText()
        listOf("listing-hero-pager", "listing-image-indicator", "listing-back", "listing-contact-cta", "listing-sticky-action", "listing-report-action", "InquiryComposer(").forEach { assertTrue(source.contains(it)) }
        assertTrue(source.contains("BackHandler(onBack = onBack)"))
        listOf("Đặt lịch xem", "PaymentGateway", "BackendApi").forEach { assertFalse(source.contains(it)) }
        val explore = File("src/main/java/com/trooi/app/features/discovery/DiscoveryExperience.kt").readText()
        assertTrue(explore.contains("onOpenListing(item.listingId)"))
        assertTrue(explore.contains("discoveryCards("))
        val app = File("src/main/java/com/trooi/app/ui/TroOiApp.kt").readText()
        assertTrue(app.contains("DiscoveryExperience("))
        assertTrue(app.contains("onSubmitInquiry = viewModel::submitInquiry"))
        assertTrue(app.contains("onOpenReport = viewModel::openTrustReport"))
    }
}
