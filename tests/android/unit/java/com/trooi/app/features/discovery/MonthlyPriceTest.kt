package com.trooi.app.features.discovery

import java.math.BigDecimal
import org.junit.Assert.*
import org.junit.Test

class MonthlyPriceTest {
    @Test fun formattedMonthlyPricesRemainSearchable() {
        listOf("3.200.000đ/tháng", "3,200,000 ₫", "3200000", "3,2 triệu/tháng").forEach {
            assertEquals(it, 0, BigDecimal("3200000").compareTo(requireNotNull(explorePriceVnd(it))))
        }
        listOf("3.20.000đ/tháng", "0đ", "-100đ", "Liên hệ").forEach { assertNull(it, explorePriceVnd(it)) }
    }
}
