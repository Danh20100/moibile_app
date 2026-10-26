package com.trooi.app.features.auth

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import com.trooi.app.ui.components.TroOiFormField
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.foundation.text.ClickableText
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.trooi.app.ui.components.TroOiButton
import com.trooi.app.ui.components.TroOiButtonStyle
import com.trooi.app.ui.components.TroOiScreenScaffold
import com.trooi.app.features.profile.LegalDocumentOverlay
import com.trooi.app.features.profile.LegalDocumentType
import com.trooi.app.ui.theme.*

/**
 * Prominent Hero Brand Block for Auth Welcome.
 * Strong visual weight: ~210-230dp wordmark with smile accent curve and slogan.
 */
@Composable
fun AuthBrandHero(
    modifier: Modifier = Modifier,
    sloganSpacing: Dp = 18.dp,
) {
    val primaryColor = MaterialTheme.colorScheme.primary
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Hero Brand Wordmark (Strong scale ~56sp)
        Row(
            modifier = Modifier.clearAndSetSemantics { contentDescription = "TrọƠi" },
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.Center,
        ) {
            Text(
                text = "Trọ",
                style = MaterialTheme.typography.displayMedium.copy(
                    fontSize = 56.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.6).sp,
                ),
                color = MaterialTheme.colorScheme.onBackground,
            )
            Text(
                text = "Ơi",
                style = MaterialTheme.typography.displayMedium.copy(
                    fontSize = 56.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.6).sp,
                ),
                color = primaryColor,
            )
        }
        Spacer(Modifier.height(4.dp))
        Canvas(modifier = Modifier.size(width = 52.dp, height = 8.dp)) {
            val smilePath = Path().apply {
                moveTo(2f, 1f)
                quadraticTo(size.width / 2f, size.height + 2f, size.width - 2f, 1f)
            }
            drawPath(
                path = smilePath,
                color = primaryColor,
                style = Stroke(width = 4.0.dp.toPx(), cap = StrokeCap.Round),
            )
        }

        Spacer(Modifier.height(sloganSpacing))

        Text(
            text = "Thuê trọ rõ ràng\n· Vận hành an tâm",
            style = MaterialTheme.typography.bodyLarge.copy(
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                lineHeight = 24.sp,
            ),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

/**
 * Secondary Google entry uses the paired neutral surface; authentication callbacks are unchanged.
 */
@Composable
fun GoogleAuthButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    text: String = "Đăng nhập với Google",
    enabled: Boolean = true,
    authInProgress: Boolean = false,
) {
    val providerSurface = TroOiGoogleRed
    val providerInk = Color.White
    Button(
        onClick = onClick,
        enabled = enabled && !authInProgress,
        modifier = modifier
            .testTag("google-auth-button")
            .fillMaxWidth()
            .height(52.dp),
        shape = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = providerSurface,
            contentColor = providerInk,
            disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
        ),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp),
    ) {
        if (authInProgress) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp,
                color = LocalContentColor.current,
            )
            Spacer(Modifier.width(10.dp))
            Text(
                text = "Đang xác thực Google...",
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontWeight = FontWeight.SemiBold,
                    color = LocalContentColor.current,
                ),
            )
        } else {
            Surface(
                shape = RoundedCornerShape(4.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier.size(22.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = "G",
                        style = MaterialTheme.typography.labelLarge.copy(
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        ),
                    )
                }
            }
            Spacer(Modifier.width(10.dp))
            Text(
                text = text,
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontWeight = FontWeight.SemiBold,
                    color = LocalContentColor.current,
                ),
            )
        }
    }
}

/**
 * Bottom action block for Auth Welcome:
 * 1. [ Đăng nhập ] (Green primary)
 * 2. [ G   Đăng nhập với Google ] (Neutral secondary action)
 * 3. Bạn chưa có tài khoản? Đăng ký
 * (No Terms/Privacy text, no large register button)
 */
@Composable
fun AuthWelcomeActions(
    onLogin: () -> Unit,
    onSignUp: () -> Unit,
    onSignInWithGoogle: (() -> Unit)? = null,
    authInProgress: Boolean = false,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        TroOiButton(
            text = "Đăng nhập",
            onClick = onLogin,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            enabled = !authInProgress,
        )

        Spacer(Modifier.height(12.dp))

        if (onSignInWithGoogle != null) {
        GoogleAuthButton(
            onClick = { onSignInWithGoogle?.invoke() },
            text = "Đăng nhập với Google",
            enabled = onSignInWithGoogle != null,
            authInProgress = authInProgress,
        )
        }

        Spacer(Modifier.height(18.dp))

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            Text(
                text = "Bạn chưa có tài khoản? ",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = "Đăng ký",
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontWeight = FontWeight.Bold,
                ),
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier
                    .clickable(enabled = !authInProgress, onClick = onSignUp)
                    .heightIn(min = 48.dp).wrapContentHeight(Alignment.CenterVertically),
            )
        }
    }
}

@Composable
fun AuthWelcomeContent(
    onLogin: () -> Unit,
    onSignUp: () -> Unit,
    modifier: Modifier = Modifier,
    onSignInWithGoogle: (() -> Unit)? = null,
    googleBacked: Boolean = false,
    authInProgress: Boolean = false,
    includeBrandHeader: Boolean = true,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (includeBrandHeader) {
            AuthBrandHero()
            Spacer(Modifier.height(36.dp))
        }

        AuthWelcomeActions(
            onLogin = onLogin,
            onSignUp = onSignUp,
            onSignInWithGoogle = onSignInWithGoogle,
            authInProgress = authInProgress,
        )
    }
}

@Composable
fun AuthWelcomeScreen(
    onLogin: () -> Unit,
    onSignUp: () -> Unit,
    onSignInWithGoogle: (() -> Unit)? = null,
    googleBacked: Boolean = false,
    authInProgress: Boolean = false,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        // Brand Hero: true visual center
        Box(
            modifier = Modifier
                .align(Alignment.Center)
                .offset(y = (-60).dp),
            contentAlignment = Alignment.Center,
        ) {
            AuthBrandHero()
        }

        // Action Section: bottom-aligned with fixed padding
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 36.dp),
        ) {
            AuthWelcomeActions(
                onLogin = onLogin,
                onSignUp = onSignUp,
                onSignInWithGoogle = onSignInWithGoogle,
                authInProgress = authInProgress,
            )
        }
    }
}

/**
 * Strong brand + title header lockup for Login and Register forms.
 */
@Composable
fun AuthScreenBrandHeader(
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
) {
    val primaryColor = MaterialTheme.colorScheme.primary
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.Start,
        ) {
            Text(
                text = "Trọ",
                style = MaterialTheme.typography.headlineLarge.copy(
                    fontSize = 44.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.6).sp,
                ),
                color = MaterialTheme.colorScheme.onBackground,
            )
            Text(
                text = "Ơi",
                style = MaterialTheme.typography.headlineLarge.copy(
                    fontSize = 44.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.6).sp,
                ),
                color = primaryColor,
            )
        }
        Spacer(Modifier.height(3.dp))
        Canvas(modifier = Modifier.size(width = 40.dp, height = 6.dp)) {
            val smilePath = Path().apply {
                moveTo(2f, 1f)
                quadraticTo(size.width / 2f, size.height + 2f, size.width - 2f, 1f)
            }
            drawPath(
                path = smilePath,
                color = primaryColor,
                style = Stroke(width = 3.4.dp.toPx(), cap = StrokeCap.Round),
            )
        }

        Spacer(Modifier.height(18.dp))

        Text(
            text = title,
            style = MaterialTheme.typography.headlineMedium.copy(
                fontSize = 26.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.3).sp,
            ),
            color = MaterialTheme.colorScheme.onBackground,
        )

        Spacer(Modifier.height(4.dp))

        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodyMedium.copy(
                fontSize = 15.sp,
                lineHeight = 22.sp,
            ),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
fun LoginScreen(
    onBack: () -> Unit,
    onSignUp: () -> Unit,
    onForgotPassword: () -> Unit,
    onLogin: (String, String) -> Unit,
    onSignInWithGoogle: (() -> Unit)? = null,
    authInProgress: Boolean = false,
    initialIdentifier: String = "",
    initialPassword: String = "",
    prefillKey: Long = 0L,
    demoBackend: Boolean = false,
    backendOnly: Boolean = false,
) {
    val focusManager = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    var identifier by remember(initialIdentifier, prefillKey) { mutableStateOf(initialIdentifier) }
    var password by remember(initialPassword, prefillKey) { mutableStateOf(initialPassword) }
    var showPassword by remember { mutableStateOf(false) }
    val identifierOk = if (backendOnly) isValidEmail(identifier) else isValidIdentifier(identifier)
    val passwordOk = isValidPassword(password)

    AuthFormScaffold(
        onBack = onBack,
        title = "chào mừng trở lại",
        subtitle = "Đăng nhập để tiếp tục với TrọƠi",
    ) {
        if (demoBackend) {
            Text(
                "DEMO BACKEND · chỉ dùng test account; không phải đăng nhập Google",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.tertiary,
            )
            Spacer(Modifier.height(12.dp))
        }
        AuthTextField(
            value = identifier,
            onValueChange = { identifier = it },
            label = if (backendOnly) "Email" else "Email hoặc số điện thoại",
            icon = Icons.Rounded.Person,
            keyboardType = KeyboardType.Email,
        )

        Spacer(Modifier.height(12.dp))

        AuthTextField(
            value = password,
            onValueChange = { password = it },
            label = "Mật khẩu",
            icon = Icons.Rounded.Lock,
            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
            trailing = {
                IconButton(onClick = { showPassword = !showPassword }) {
                    Icon(
                        if (showPassword) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility,
                        contentDescription = if (showPassword) "Ẩn mật khẩu" else "Hiện mật khẩu",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            },
        )

        TroOiButton(
            text = "Quên mật khẩu?",
            onClick = onForgotPassword,
            modifier = Modifier.align(Alignment.End),
            enabled = !authInProgress,
            style = TroOiButtonStyle.TERTIARY,
        )

        Spacer(Modifier.height(4.dp))

        TroOiButton(
            text = "Đăng nhập",
            onClick = { focusManager.clearFocus(); keyboard?.hide(); onLogin(identifier.trim(), password) },
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            enabled = identifierOk && passwordOk && !authInProgress,
        )
        if (onSignInWithGoogle != null) {
        // Divider: ──────────── hoặc ────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            HorizontalDivider(
                modifier = Modifier.weight(1f),
                color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.7f),
            )
            Text(
                text = "hoặc",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 14.dp),
            )
            HorizontalDivider(
                modifier = Modifier.weight(1f),
                color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.7f),
            )
        }

        // Google provider action: Red button with white text
        GoogleAuthButton(
            onClick = { onSignInWithGoogle?.invoke() },
            text = "Đăng nhập với Google",
            enabled = onSignInWithGoogle != null,
            authInProgress = authInProgress,
        )
        }

        Spacer(Modifier.height(20.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Bạn chưa có tài khoản? ",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                text = "Đăng ký",
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier
                    .clickable(onClick = onSignUp)
                    .heightIn(min = 48.dp).wrapContentHeight(Alignment.CenterVertically),
            )
        }
    }
}

@Composable
fun ForgotPasswordScreen(
    onBack: () -> Unit,
    onSubmit: (String) -> Unit,
    initialIdentifier: String = "",
    prefillKey: Long = 0L,
    backendOnly: Boolean = false,
    authInProgress: Boolean = false,
    otpChallengeId: String = "",
    otpExpiresAt: Long = 0L,
    otpResendAt: Long = 0L,
    onVerify: (String, String) -> Unit = { _, _ -> },
    onEmailChangedAfterOtp: () -> Unit = {},
) {
    var identifier by remember(initialIdentifier, prefillKey) { mutableStateOf(initialIdentifier) }
    var code by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(otpChallengeId, otpResendAt) {
        if (otpChallengeId.isNotBlank()) {
            while (true) {
                now = System.currentTimeMillis()
                kotlinx.coroutines.delay(1_000)
            }
        }
    }
    val expired = otpExpiresAt > 0L && now >= otpExpiresAt
    val waitSeconds = ((otpResendAt - now + 999) / 1000).coerceAtLeast(0)
    AuthFormScaffold(
        onBack = onBack,
        title = "khôi phục mật khẩu",
        subtitle = if (backendOnly) "Nhận mã xác nhận qua email để đặt lại mật khẩu." else "Nhập email hoặc số điện thoại đã đăng ký.",
    ) {
        AuthTextField(
            identifier,
            {
                if (!authInProgress) { identifier = it; onEmailChangedAfterOtp() }
            },
            if (backendOnly) "Email" else "Email hoặc số điện thoại",
            Icons.Rounded.AlternateEmail,
            keyboardType = KeyboardType.Email,
            enabled = !authInProgress,
        )
        if (backendOnly && otpChallengeId.isNotEmpty()) {
            Spacer(Modifier.height(14.dp))
            AuthTextField(
                code, { code = it.filter(Char::isDigit).take(6) },
                "Mã xác nhận 6 chữ số", Icons.Rounded.Password,
                keyboardType = KeyboardType.NumberPassword,
                enabled = !authInProgress,
            )
            Spacer(Modifier.height(10.dp))
            AuthTextField(
                password, { password = it }, "Mật khẩu mới (tối thiểu 8 ký tự)",
                Icons.Rounded.Lock, visualTransformation = PasswordVisualTransformation(),
                enabled = !authInProgress,
            )
            Spacer(Modifier.height(10.dp))
            AuthTextField(
                confirmPassword, { confirmPassword = it }, "Nhập lại mật khẩu mới",
                Icons.Rounded.LockReset, visualTransformation = PasswordVisualTransformation(),
                enabled = !authInProgress,
            )
            if (expired) {
                Text("Mã đã hết hạn. Hãy yêu cầu mã mới.", color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.labelMedium)
            }
            if (confirmPassword.isNotEmpty() && confirmPassword != password) {
                Text("Mật khẩu nhập lại chưa khớp.", color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.labelMedium)
            }
            Spacer(Modifier.height(16.dp))
            TroOiButton(
                text = if (authInProgress) "Đang xác nhận…" else "Xác nhận đổi mật khẩu",
                onClick = { onVerify(code, password) },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                enabled = code.length == 6 && password.length in 8..128 && confirmPassword == password &&
                    !expired && !authInProgress,
            )
            Spacer(Modifier.height(8.dp))
            TroOiButton(
                text = if (waitSeconds > 0) "Gửi lại sau ${waitSeconds}s" else "Gửi lại mã",
                onClick = { onSubmit(identifier.trim()) },
                modifier = Modifier.fillMaxWidth(),
                style = TroOiButtonStyle.TERTIARY,
                enabled = waitSeconds == 0L && !authInProgress,
            )
        } else {
            Spacer(Modifier.height(18.dp))
            TroOiButton(
                text = if (backendOnly) "Gửi mã xác nhận" else "Gửi hướng dẫn khôi phục",
                onClick = { onSubmit(identifier.trim()) },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                enabled = (if (backendOnly) isValidEmail(identifier) else identifier.trim().length >= 5) &&
                    !authInProgress,
            )
        }
    }
}

@Composable
fun SignUpScreen(
    onBack: () -> Unit,
    onLogin: () -> Unit,
    onSignUp: (String, String, String, String) -> Unit,
    initialFullName: String = "",
    initialPhone: String = "",
    initialEmail: String = "",
    initialPassword: String = "",
    prefillKey: Long = 0L,
    authInProgress: Boolean = false,
    onGoogleRegister: () -> Unit = {},
    googleBacked: Boolean = false,
    onRequestEmailOtp: (String, String, String, String) -> Unit = { _, _, _, _ -> },
    onVerifyEmailOtp: (String) -> Unit = {},
    onEmailChangedAfterOtp: () -> Unit = {},
    otpChallengeId: String = "",
    otpExpiresAt: Long = 0L,
    otpResendAt: Long = 0L,
) {
    var fullName by androidx.compose.runtime.saveable.rememberSaveable(initialFullName, prefillKey) { mutableStateOf(initialFullName) }
    var phone by androidx.compose.runtime.saveable.rememberSaveable(initialPhone, prefillKey) { mutableStateOf(initialPhone) }
    var email by androidx.compose.runtime.saveable.rememberSaveable(initialEmail, prefillKey) { mutableStateOf(initialEmail) }
    var password by remember(initialPassword, prefillKey) { mutableStateOf(initialPassword) }
    var confirmPassword by remember(initialPassword, prefillKey) { mutableStateOf(initialPassword) }
    var showPassword by androidx.compose.runtime.saveable.rememberSaveable { mutableStateOf(false) }
    var accepted by androidx.compose.runtime.saveable.rememberSaveable { mutableStateOf(false) }
    var otpCode by remember { mutableStateOf("") }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(otpChallengeId, otpResendAt) {
        if (otpChallengeId.isNotEmpty()) {
            while (true) {
                now = System.currentTimeMillis()
                kotlinx.coroutines.delay(1_000)
            }
        }
    }
    var legalDocument by remember { mutableStateOf<LegalDocumentType?>(null) }
    legalDocument?.let { LegalDocumentOverlay(it, onDismiss = { legalDocument = null }) }
    val valid = isValidSignup(fullName, phone, email, password, confirmPassword, accepted)
    AuthFormScaffold(
        onBack = onBack,
        title = "chào mừng thành viên mới",
        subtitle = "Tạo tài khoản để bắt đầu với TrọƠi.",
    ) {
        AuthTextField(fullName, { if (!authInProgress) { fullName = it; onEmailChangedAfterOtp() } }, "Họ và tên", Icons.Rounded.Badge)
        Spacer(Modifier.height(10.dp))
        AuthTextField(phone, { if (!authInProgress) { phone = it.filter { c -> c.isDigit() }.take(11); onEmailChangedAfterOtp() } }, "Số điện thoại", Icons.Rounded.Phone, keyboardType = KeyboardType.Phone)
        Spacer(Modifier.height(10.dp))
        // Submit the complete registration form before requesting a real email challenge.
        EmailOtpPanel(email, mockMode = false, onValueChange = {
            if (!authInProgress) { email = it; onEmailChangedAfterOtp() }
        }, allowSend = false)
        Spacer(Modifier.height(10.dp))
        AuthTextField(
            password, { if (!authInProgress) { password = it; onEmailChangedAfterOtp() } }, "Mật khẩu (tối thiểu 8 ký tự)", Icons.Rounded.Lock,
            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
            trailing = { IconButton(onClick = { showPassword = !showPassword }) { Icon(if (showPassword) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility, if (showPassword) "Ẩn mật khẩu" else "Hiện mật khẩu", tint = MaterialTheme.colorScheme.onSurfaceVariant) } },
        )
        Spacer(Modifier.height(10.dp))
        AuthTextField(confirmPassword, { if (!authInProgress) { confirmPassword = it; onEmailChangedAfterOtp() } }, "Nhập lại mật khẩu", Icons.Rounded.LockReset, visualTransformation = PasswordVisualTransformation())
        if (confirmPassword.isNotBlank() && confirmPassword != password) {
            Text("Mật khẩu nhập lại chưa khớp.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 6.dp))
        }
        Spacer(Modifier.height(12.dp))
        // Keep the legal documents inside the consent sentence. Opening a link must
        // never check the box automatically; consent remains an explicit user action.
        val linkStyle = SpanStyle(
            color = MaterialTheme.colorScheme.primary,
            textDecoration = TextDecoration.Underline,
            fontWeight = FontWeight.SemiBold,
        )
        val consentText = buildAnnotatedString {
            append("Tôi đồng ý với ")
            pushStringAnnotation(tag = "legal-document", annotation = LegalDocumentType.TERMS.route)
            withStyle(linkStyle) { append("Điều khoản sử dụng") }
            pop()
            append(" và ")
            pushStringAnnotation(tag = "legal-document", annotation = LegalDocumentType.PRIVACY.route)
            withStyle(linkStyle) { append("Chính sách quyền riêng tư") }
            pop()
            append(".")
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Checkbox(
                checked = accepted,
                onCheckedChange = { if (!authInProgress) { accepted = it; onEmailChangedAfterOtp() } },
                enabled = !authInProgress,
                colors = CheckboxDefaults.colors(checkedColor = MaterialTheme.colorScheme.primary),
                modifier = Modifier.testTag("signup-legal-consent"),
            )
            ClickableText(
                text = consentText,
                style = MaterialTheme.typography.bodyMedium.copy(
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                ),
                modifier = Modifier.padding(top = 12.dp).semantics {
                    customActions = listOf(
                        CustomAccessibilityAction("Mở Điều khoản sử dụng") {
                            legalDocument = LegalDocumentType.TERMS
                            true
                        },
                        CustomAccessibilityAction("Mở Chính sách quyền riêng tư") {
                            legalDocument = LegalDocumentType.PRIVACY
                            true
                        },
                    )
                },
                onClick = { offset ->
                    consentText.getStringAnnotations("legal-document", offset, offset)
                        .firstOrNull()?.item?.let { route ->
                            legalDocument = LegalDocumentType.fromRoute(route)
                        }
                },
            )
        }
        Spacer(Modifier.height(10.dp))
        if (otpChallengeId.isNotEmpty()) {
            AuthTextField(
                otpCode,
                { otpCode = it.filter(Char::isDigit).take(6) },
                "Mã xác nhận 6 chữ số", Icons.Rounded.Password,
                keyboardType = KeyboardType.NumberPassword,
            )
            val expired = otpExpiresAt > 0L && now >= otpExpiresAt
            val seconds = ((otpResendAt - now + 999) / 1000).coerceAtLeast(0)
            if (expired) {
                Text("Mã đã hết hạn. Hãy gửi lại mã.", color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.labelMedium)
            }
            Spacer(Modifier.height(10.dp))
            TroOiButton(
                text = if (authInProgress) "Đang xác nhận…" else "Xác nhận và tạo tài khoản",
                onClick = { onVerifyEmailOtp(otpCode) },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                enabled = valid && otpCode.length == 6 && !expired && !authInProgress,
            )
            TroOiButton(
                text = if (seconds > 0) "Gửi lại sau ${seconds}s" else "Gửi lại mã",
                onClick = { onRequestEmailOtp(fullName, phone, email, password) },
                modifier = Modifier.fillMaxWidth(),
                style = TroOiButtonStyle.TERTIARY,
                enabled = seconds == 0L && valid && googleBacked && !authInProgress,
            )
        } else {
            TroOiButton(
                text = if (authInProgress) "Đang gửi mã…" else "Tạo tài khoản",
                onClick = {
                    if (googleBacked) onRequestEmailOtp(fullName, phone, email, password)
                    else onSignUp(fullName, phone, email, password)
                },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                enabled = valid && !authInProgress,
            )
        }
        if (googleBacked) {
            Spacer(Modifier.height(18.dp))
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                HorizontalDivider(Modifier.weight(1f))
                Text("hoặc", style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                HorizontalDivider(Modifier.weight(1f))
            }
            Spacer(Modifier.height(18.dp))
            GoogleAuthButton(
                onClick = onGoogleRegister,
                text = "Đăng ký bằng Google",
                enabled = !authInProgress,
                authInProgress = authInProgress,
            )
        }
        Spacer(Modifier.height(16.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            Text("Đã có tài khoản? ", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            Text(
                text = "Đăng nhập",
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier
                    .clickable(onClick = onLogin)
                    .heightIn(min = 48.dp).wrapContentHeight(Alignment.CenterVertically),
            )
        }
    }
}

@Composable
private fun AuthFormScaffold(
    onBack: () -> Unit,
    title: String,
    subtitle: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    TroOiScreenScaffold { insets ->
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(insets)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 16.dp),
    ) {
        IconButton(
            onClick = onBack,
            modifier = Modifier.offset(x = (-12).dp),
        ) {
            Icon(
                Icons.AutoMirrored.Rounded.ArrowBack,
                contentDescription = "Quay lại",
                tint = MaterialTheme.colorScheme.onBackground,
            )
        }

        Spacer(Modifier.height(8.dp))

        AuthScreenBrandHeader(
            title = title,
            subtitle = subtitle,
        )

        Spacer(Modifier.height(24.dp))

        content()

        Spacer(Modifier.height(24.dp))
    }
    }
}

@Composable
private fun AuthTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    keyboardType: KeyboardType = KeyboardType.Text,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    trailing: @Composable (() -> Unit)? = null,
    enabled: Boolean = true,
) {
    TroOiFormField(
        value = value,
        onValueChange = onValueChange,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
        label = { Text(label) },
        leadingIcon = { Icon(icon, null, tint = MaterialTheme.colorScheme.onSurfaceVariant) },
        trailingIcon = trailing,
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        visualTransformation = visualTransformation,
    )
}
