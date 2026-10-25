package com.trooi.app.features

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RoomLedgerDesignRegressionTest {
    private fun source(relative: String): String =
        File(System.getProperty("user.dir"), "src/main/java/" + relative).readText()

    @Test
    fun approvedMossPaletteAndFlatSurfacesMatchNativeBrief() {
        val colors = source("com/trooi/app/ui/theme/Color.kt")
        listOf(
            "0xFFEAF0E3", "0xFFFFFFFF", "0xFFDCE6D4", "0xFF202D25",
            "0xFF52634F", "0xFF94A58D", "0xFF235A46", "0xFF4F6744",
        ).forEach { assertTrue(colors.contains(it)) }

        val preview = source("com/trooi/app/ui/components/V1Components.kt")
        val components = source("com/trooi/app/ui/components/TroOiPrimitives.kt")
        val theme = source("com/trooi/app/ui/theme/Theme.kt")
        assertTrue(preview.contains("fun V1PreviewNotice"))
        assertTrue(preview.contains("MaterialTheme.colorScheme.tertiaryContainer"))
        assertFalse(preview.contains("RoundedCornerShape("))
        assertTrue(theme.contains("large = RoundedCornerShape(12.dp)"))
        assertTrue(theme.contains("medium = RoundedCornerShape(10.dp)"))
        assertTrue(components.contains("shape = MaterialTheme.shapes.large"))
        assertTrue(components.contains("shape = MaterialTheme.shapes.medium"))
        assertFalse(components.contains("shadowElevation"))
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
        assertFalse(app.contains("AppPage.GuestActivity"))
        listOf("Khám phá", "Tin nhắn", "Hồ sơ").forEach {
            assertTrue(discoveryNav.contains("\"$it\""))
        }
        assertTrue(discoveryNav.contains("CoreTabIdentity.TEMPORARY_LABEL"))
        assertFalse(discoveryNav.contains("\"Yêu thích\""))
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
