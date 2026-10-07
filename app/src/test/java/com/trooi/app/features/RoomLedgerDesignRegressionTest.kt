package com.trooi.app.features

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RoomLedgerDesignRegressionTest {
    private fun source(relative: String): String =
        File(System.getProperty("user.dir"), "src/main/java/" + relative).readText()

    @Test
    fun roomLedgerPaletteAndFlatSurfaceTokensMatchDesignAuthority() {
        val colors = source("com/trooi/app/ui/theme/Color.kt")
        listOf(
            "0xFFEEEAE2", "0xFFFFFDF8", "0xFFF4F1E9", "0xFF242D2A",
            "0xFF606B64", "0xFFD8DCD3", "0xFF235A46", "0xFFA95034",
        ).forEach { assertTrue(colors.contains(it)) }

        val components = source("com/trooi/app/ui/components/V1Components.kt")
        assertTrue(components.contains("RoundedCornerShape(12.dp)"))
        assertTrue(components.contains("RoundedCornerShape(10.dp)"))
        assertTrue(components.contains("shadowElevation = 0.dp"))
        assertFalse(components.contains("RoundedCornerShape(19.dp)"))
        assertFalse(components.contains("shadowElevation = 1.dp"))
    }

    @Test
    fun roomLedgerSignatureComponentsExist() {
        val ledger = source("com/trooi/app/ui/components/RoomLedgerComponents.kt")
        listOf(
            "RoomLedgerPlate",
            "LedgerStateLabel",
            "LedgerAttentionRow",
            "LedgerMoney",
            "LedgerHistoryEvent",
            "LedgerNavStrip",
            "LedgerMediaPlaceholder",
        ).forEach { assertTrue(ledger.contains("fun $it")) }
    }

    @Test
    fun rootNavigationMatchesThreePovDesign() {
        val app = source("com/trooi/app/ui/TroOiApp.kt")
        val discoveryNav = source("com/trooi/app/ui/navigation/TroOiBottomNavigation.kt")
        assertTrue(app.contains("AppPage.GuestMap"))
        assertTrue(app.contains("AppPage.GuestActivity"))
        listOf("Khám phá", "Yêu thích", "Tin nhắn", "Hồ sơ").forEach {
            assertTrue(discoveryNav.contains("\"$it\""))
        }
        assertTrue(discoveryNav.contains("CoreTabIdentity.TEMPORARY_LABEL"))
        assertFalse(discoveryNav.contains("\"Bản đồ\""))
        assertFalse(discoveryNav.contains("\"Hoạt động\""))
        listOf("Nhà tôi", "Thanh toán", "Sự cố").forEach {
            assertTrue(app.contains("\"$it\""))
        }
        listOf("Tổng quan", "Phòng", "Tài chính").forEach {
            assertTrue(app.contains("\"$it\""))
        }
        assertTrue(app.contains("NavigationRail"))
        assertTrue(app.contains("screenWidthDp >= 600"))
        assertTrue(app.contains("WindowInsets.safeDrawing"))
        assertTrue(app.contains("imePadding()"))
    }

    @Test
    fun representativeSurfacesUseRoomLedgerHierarchy() {
        val guest = source("com/trooi/app/features/tenant/TenantScreens.kt")
        val tenant = source("com/trooi/app/features/tenant/TenantPovScreens.kt")
        val landlord = source("com/trooi/app/features/landlord/LandlordScreens.kt")
        val operator = source("com/trooi/app/features/organization/OperatorWorkspace.kt")
        val rental = source("com/trooi/app/features/tenancy/RentalWorkspace.kt")
        val context = source("com/trooi/app/features/shared/ContextSwitcherScreen.kt")
        val app = source("com/trooi/app/ui/TroOiApp.kt")

        assertTrue(guest.contains("Tìm phòng\\nquanh bạn."))
        assertTrue(guest.contains("LedgerMediaPlaceholder"))
        assertTrue(guest.contains("LedgerMoney"))
        assertTrue(tenant.contains("RoomLedgerPlate"))
        assertTrue(tenant.contains("LedgerMoney"))
        assertTrue(landlord.contains("việc cần chú ý"))
        assertTrue(landlord.contains("FinanceLane"))
        assertTrue(operator.contains("LedgerNavStrip"))
        assertTrue(operator.contains("Lịch sử phòng"))
        assertTrue(rental.contains("Các khoản trong kỳ"))
        assertTrue(rental.contains("IncidentEvent append-only"))
        assertTrue(context.contains("Chọn nơi bạn muốn sử dụng"))
        assertTrue(app.contains("Mở lại không gian của bạn"))
    }
}