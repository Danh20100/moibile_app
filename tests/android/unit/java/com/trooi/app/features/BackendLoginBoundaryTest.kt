package com.trooi.app.features

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BackendLoginBoundaryTest {
    private fun source(path: String): String =
        File(System.getProperty("user.dir"), "src/main/java/com/trooi/app/$path").readText()

    @Test fun signupUsesOneOtpRequestActionAndNoLegacySignupAction() {
        val screen = source("features/auth/AuthScreens.kt")
        val panel = File(System.getProperty("user.dir"), "src/main/java/com/trooi/app/features/auth/EmailOtpPanel.kt").readText()
        assertTrue(screen.contains("else if (emailOtpEnabled) \"Gửi mã xác nhận\" else \"Tạo tài khoản\""))
        assertTrue(screen.contains("onRequestEmailOtp(fullName, phone, email, password)"))
        assertTrue(screen.contains("onVerifyEmailOtp(otpCode)"))
        assertTrue(panel.contains("trailingIcon = if (allowSend)"))
    }

    @Test fun debugBackendModeCannotRouteThroughDemoCredentials() {
        val debugRepository = File(
            System.getProperty("user.dir"),
            "../app/src/debug/java/com/trooi/app/core/data/DebugTroOiRepository.kt",
        ).readText()
        assertFalse(debugRepository.contains("DemoBackendLogin"))
        assertFalse(debugRepository.contains("DEMO_BACKEND_ENABLED"))
        assertFalse(debugRepository.contains("demoLogin"))
    }

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
    @Test fun backendSessionRefreshAndLoginUseRolePriorityLanding() {
        val viewModel = source("ui/TroOiViewModel.kt")
        assertTrue(viewModel.contains("resolvePostLoginLanding(access, remembered)"))
        assertTrue(viewModel.contains("val postLoginPage = if (RuntimeDataSource.isBackendBacked())"))
        assertTrue(viewModel.contains("page = postLoginPage,"))
        assertFalse(viewModel.contains("page = returnPage ?: if (current.demoPreview)"))
    }

}
