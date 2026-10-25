package com.trooi.app.features

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BackendLoginBoundaryTest {
    private fun source(path: String): String =
        File(System.getProperty("user.dir"), "src/main/java/com/trooi/app/$path").readText()

    @Test fun backendLoginNeverExposesLocalDemoOrWorkingPasswordForm() {
        val app = source("ui/TroOiApp.kt")
        val screen = source("features/auth/AuthScreens.kt")
        val repository = source("core/data/BackendTroOiRepository.kt")
        val api = source("core/network/BackendApi.kt")
        assertTrue(app.contains("backendOnly = RuntimeDataSource.isBackendBacked()"))
        assertTrue(screen.contains("if (!backendOnly)"))
        assertTrue(screen.contains("Email và mật khẩu sẽ được mở khi hoàn tất tích hợp OTP"))
        assertFalse(repository.contains("authenticateLocalDemo"))
        assertFalse(api.contains("identity-access/auth/local-demo"))
        assertFalse(api.contains("authenticateLocalDemo"))
    }
}
