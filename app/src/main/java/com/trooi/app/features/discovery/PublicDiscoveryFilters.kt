package com.trooi.app.features.discovery

import com.trooi.app.core.model.PublicListingCard
import com.trooi.app.core.model.publicDiscoveryFeed
import java.math.BigDecimal

/** Price-only filtering on PUBLISHED projections. Public location search awaits an authoritative Backend contract. */
data class PublicDiscoveryFilters(
    val minPrice: String = "",
    val maxPrice: String = "",
) {
    fun validationMessage(): String? {
        val min = minPrice.takeIf { it.isNotBlank() }?.toBigDecimalOrNull()
        val max = maxPrice.takeIf { it.isNotBlank() }?.toBigDecimalOrNull()
        if (minPrice.isNotBlank() && min == null || maxPrice.isNotBlank() && max == null) {
            return "Giá phải là số không âm (VND)."
        }
        if ((min != null && min < BigDecimal.ZERO) || (max != null && max < BigDecimal.ZERO)) {
            return "Khoảng giá không được âm."
        }
        if (min != null && max != null && min > max) {
            return "Giá thấp nhất phải nhỏ hơn hoặc bằng giá cao nhất."
        }
        return null
    }

    fun apply(listings: List<PublicListingCard>): List<PublicListingCard> {
        val public = publicDiscoveryFeed(listings)
        if (validationMessage() != null) return public
        val min = minPrice.takeIf { it.isNotBlank() }?.toBigDecimalOrNull()
        val max = maxPrice.takeIf { it.isNotBlank() }?.toBigDecimalOrNull()
        return public.filter { listing ->
            if (min == null && max == null) return@filter true
            val price = listing.askingPriceLabel?.toBigDecimalOrNull() ?: return@filter false
            (min == null || price >= min) && (max == null || price <= max)
        }
    }
}
