package com.trooi.app.features

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BackendLoginBoundaryTest {
    private fun source(path: String): String =
        File(System.getProperty("user.dir"), "src/main/java/com/trooi/app/$path").readText()

    @Test fun backendLoginUsesVerifiedPasswordEndpointWithoutLocalDemo() {
        val app = source("ui/TroOiApp.kt")
        val screen = source("features/auth/AuthScreens.kt")
        val repository = source("core/data/BackendTroOiRepository.kt")
        val api = source("core/network/BackendApi.kt")
        assertTrue(app.contains("backendOnly = RuntimeDataSource.isBackendBacked()"))
        assertTrue(screen.contains("if (backendOnly) \"Email\" else \"Email hoặc số điện thoại\""))
        assertTrue(screen.contains("label = \"Mật khẩu\""))
        assertTrue(screen.contains("enabled = identifierOk && passwordOk && !authInProgress"))
        assertFalse(screen.contains("Đăng nhập email/mật khẩu và khôi phục mật khẩu chưa khả dụng"))
        assertFalse(screen.contains("Đăng ký bằng email chưa khả dụng"))
        assertTrue(screen.contains("if (onSignInWithGoogle != null)"))
        assertTrue(api.contains("identity-access/auth/password"))
        assertTrue(repository.contains("api.authenticatePassword("))
        assertFalse(repository.contains("authenticateLocalDemo"))
        assertFalse(api.contains("identity-access/auth/local-demo"))
        assertFalse(api.contains("authenticateLocalDemo"))
    }
}
