package com.trooi.app.features

import android.content.Context
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.core.data.TroOiRepositoryImpl
import com.trooi.app.core.model.*
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class LocalManagementPersistenceTest {
    @Test fun enrollmentSurvivesRestartWithoutSavingPersonalOrIdentityInput() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val prefs = context.getSharedPreferences("local-enrollment-test", Context.MODE_PRIVATE)
        assertTrue(prefs.edit().clear().commit())
        try {
            val repository = TroOiRepositoryImpl(prefs)
            val tenant = repository.login("tenant@trooi.local", "TroOi2026!").getOrThrow()
            val before = repository.refreshAuthorizedRead(tenant.access).getOrThrow()
            val asset = LocalRentalAsset("enrolled-room", "enrolled-property", "Phòng trọ", "Phòng L01", "Địa chỉ riêng", "Bình Thạnh", "24", "3200000", "3200000",
                "Phòng sáng", photoResources = listOf(com.trooi.app.R.drawable.rental_studio))
            val application = LocalLandlordApplication("Legal name input", "1995-06-15", "0901234567", "contact@example.test", true, true, true, asset, false)
            val enrolled = repository.completeLocalLandlordOnboarding(application).getOrThrow()
            val restored = TroOiRepositoryImpl(prefs)
            assertEquals(enrolled, restored.refreshSessionContext().getOrThrow())
            val read = restored.refreshAuthorizedRead(enrolled.access).getOrThrow()
            assertEquals(before.tenantFinanceByTenancy, read.tenantFinanceByTenancy)
            assertEquals(1, read.localManagement!!.used)
            assertTrue(read.operatorFinanceByRoom.isEmpty())
            assertEquals(setOf("userId", "organization:${tenant.userId}", "management:${tenant.userId}"), prefs.all.keys)
            listOf(application.fullName, application.birthDate, application.phone, application.email).forEach { sensitive ->
                assertTrue(prefs.all.values.none { it.toString().contains(sensitive) })
            }
            val owner = restored.login("owner@trooi.local", "TroOi2026!").getOrThrow()
            assertTrue(restored.refreshAuthorizedRead(owner.access).getOrThrow().localManagement!!.assets.none { it.id == asset.id })
        } finally { assertTrue(prefs.edit().clear().commit()) }
    }
    @Test fun repositoryRecreationPreservesAssetsCapacityAndAccountBoundaries() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val prefs = context.getSharedPreferences("local-management-test", Context.MODE_PRIVATE)
        assertTrue(prefs.edit().clear().commit())
        try {
            val original = TroOiRepositoryImpl(prefs)
            val owner = original.login("owner@trooi.local", "TroOi2026!").getOrThrow()
            val before = original.refreshAuthorizedRead(owner.access).getOrThrow()
            val asset = LocalRentalAsset("persisted-room", "persisted-property", "Phòng trọ", "Phòng C01",
                "Địa chỉ riêng tư", "Bình Thạnh", "20", "3000000", "3000000", "Phòng sáng",
                photoResources = before.localManagement!!.assets.first().photoResources)
            original.purchaseLocalCapacity("confirmed-order").getOrThrow()
            original.saveLocalAsset(asset, true, true).getOrThrow()

            val recreated = TroOiRepositoryImpl(prefs)
            assertEquals(owner, recreated.refreshSessionContext().getOrThrow())
            val restored = recreated.refreshAuthorizedRead(owner.access).getOrThrow()
            assertEquals(before.localManagement!!.used + 1, restored.localManagement!!.used)
            assertEquals(before.localManagement!!.capacity() + 1, restored.localManagement!!.capacity())
            assertEquals(asset.id, restored.localManagement!!.assets.last().id)
            assertEquals(before.operatorFinanceByOrganization, restored.operatorFinanceByOrganization)
            assertEquals(before.localManagement!!.capacity() + 1, recreated.purchaseLocalCapacity("confirmed-order").getOrThrow().localManagement!!.capacity())
            recreated.clearSession()
            val tenant = recreated.login("tenant@trooi.local", "TroOi2026!").getOrThrow()
            val tenantRead = recreated.refreshAuthorizedRead(tenant.access).getOrThrow()
            assertNull(tenantRead.localManagement)
            assertTrue(tenantRead.properties.isEmpty())
            assertEquals("Bình Thạnh", tenantRead.publicListings.single { it.listingId == asset.listingId }.publicAreaLabel)
            assertTrue(recreated.archiveLocalAsset(asset.id).isFailure)
            recreated.login("owner@trooi.local", "TroOi2026!").getOrThrow()
            recreated.archiveLocalAsset(asset.id).getOrThrow()
            val archived = TroOiRepositoryImpl(prefs).refreshAuthorizedRead(owner.access).getOrThrow()
            assertEquals(before.localManagement!!.used, archived.localManagement!!.used)
            assertEquals(before.localManagement!!.capacity() + 1, archived.localManagement!!.capacity())
            assertTrue(archived.publicListings.none { it.listingId == asset.listingId })
        } finally {
            assertTrue(prefs.edit().clear().commit())
        }
    }
}
