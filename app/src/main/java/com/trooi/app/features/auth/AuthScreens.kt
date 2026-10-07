package com.trooi.app.features.auth

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.trooi.app.ui.components.TroOiPrimaryButton
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
 * Prominent Google provider authentication button with red background and white text.
 */
@Composable
fun GoogleAuthButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    text: String = "Đăng nhập với Google",
    enabled: Boolean = true,
    authInProgress: Boolean = false,
) {
    val googleRed = Color(0xFFD93025)
    Button(
        onClick = onClick,
        enabled = enabled && !authInProgress,
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp),
        shape = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = googleRed,
            contentColor = Color.White,
            disabledContainerColor = googleRed.copy(alpha = 0.55f),
            disabledContentColor = Color.White.copy(alpha = 0.8f),
        ),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp),
    ) {
        if (authInProgress) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp,
                color = Color.White,
            )
            Spacer(Modifier.width(10.dp))
            Text(
                text = "Đang xác thực Google...",
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White,
                ),
            )
        } else {
            Surface(
                shape = RoundedCornerShape(4.dp),
                color = Color.White.copy(alpha = 0.22f),
                modifier = Modifier.size(22.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = "G",
                        style = MaterialTheme.typography.labelLarge.copy(
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = Color.White,
                        ),
                    )
                }
            }
            Spacer(Modifier.width(10.dp))
            Text(
                text = text,
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White,
                ),
            )
        }
    }
}

/**
 * Bottom action block for Auth Welcome:
 * 1. [ Đăng nhập ] (Green primary)
 * 2. [ G   Đăng nhập với Google ] (Red background, white text)
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
        TroOiPrimaryButton(
            text = "Đăng nhập",
            onClick = onLogin,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            enabled = !authInProgress,
        )

        Spacer(Modifier.height(12.dp))

        GoogleAuthButton(
            onClick = { onSignInWithGoogle?.invoke() },
            text = "Đăng nhập với Google",
            enabled = onSignInWithGoogle != null,
            authInProgress = authInProgress,
        )

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
                    .padding(vertical = 4.dp),
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
) {
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    val identifierOk = isValidIdentifier(identifier)
    val passwordOk = isValidPassword(password)

    AuthFormScaffold(
        onBack = onBack,
        title = "chào mừng trở lại",
        subtitle = "Đăng nhập để tiếp tục với TrọƠi",
    ) {
        AuthTextField(
            value = identifier,
            onValueChange = { identifier = it },
            label = "Email hoặc số điện thoại",
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
                        contentDescription = null,
                        tint = TroOiMuted,
                    )
                }
            },
        )

        TextButton(
            onClick = onForgotPassword,
            modifier = Modifier.align(Alignment.End),
        ) {
            Text("Quên mật khẩu?", color = MaterialTheme.colorScheme.primary)
        }

        Spacer(Modifier.height(4.dp))

        TroOiPrimaryButton(
            text = "Đăng nhập",
            onClick = { onLogin(identifier.trim(), password) },
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            enabled = identifierOk && passwordOk && !authInProgress,
        )

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
                    .padding(vertical = 4.dp),
            )
        }
    }
}

@Composable
fun ForgotPasswordScreen(onBack: () -> Unit, onSubmit: (String) -> Unit) {
    var identifier by remember { mutableStateOf("") }
    AuthFormScaffold(
        onBack = onBack,
        title = "khôi phục mật khẩu",
        subtitle = "Nhập email hoặc số điện thoại đã đăng ký.",
    ) {
        AuthTextField(identifier, { identifier = it }, "Email hoặc số điện thoại", Icons.Rounded.AlternateEmail)
        Spacer(Modifier.height(18.dp))
        TroOiPrimaryButton(
            text = "Gửi hướng dẫn khôi phục",
            onClick = { onSubmit(identifier.trim()) },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            enabled = identifier.trim().length >= 5,
        )
    }
}

@Composable
fun SignUpScreen(onBack: () -> Unit, onLogin: () -> Unit, onSignUp: (String, String, String, String) -> Unit) {
    var fullName by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var accepted by remember { mutableStateOf(false) }
    val valid = isValidSignup(fullName, phone, email, password, confirmPassword, accepted)

    AuthFormScaffold(
        onBack = onBack,
        title = "chào mừng thành viên mới",
        subtitle = "Tạo tài khoản để bắt đầu với TrọƠi.",
    ) {
        AuthTextField(fullName, { fullName = it }, "Họ và tên", Icons.Rounded.Badge)
        Spacer(Modifier.height(10.dp))
        AuthTextField(phone, { phone = it.filter { c -> c.isDigit() }.take(11) }, "Số điện thoại", Icons.Rounded.Phone, keyboardType = KeyboardType.Phone)
        Spacer(Modifier.height(10.dp))
        AuthTextField(email, { email = it }, "Email", Icons.Rounded.Email, keyboardType = KeyboardType.Email)
        Spacer(Modifier.height(10.dp))
        AuthTextField(
            password, { password = it }, "Mật khẩu (tối thiểu 8 ký tự)", Icons.Rounded.Lock,
            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
            trailing = { IconButton(onClick = { showPassword = !showPassword }) { Icon(if (showPassword) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility, null, tint = TroOiMuted) } },
        )
        Spacer(Modifier.height(10.dp))
        AuthTextField(confirmPassword, { confirmPassword = it }, "Nhập lại mật khẩu", Icons.Rounded.LockReset, visualTransformation = PasswordVisualTransformation())
        if (confirmPassword.isNotBlank() && confirmPassword != password) {
            Text("Mật khẩu nhập lại chưa khớp.", color = TroOiRed, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 6.dp))
        }
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.Top) {
            Checkbox(
                checked = accepted,
                onCheckedChange = { accepted = it },
                colors = CheckboxDefaults.colors(checkedColor = MaterialTheme.colorScheme.primary),
            )
            Text(
                text = "Tôi đồng ý với Điều khoản sử dụng và Chính sách quyền riêng tư.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 12.dp),
            )
        }
        Spacer(Modifier.height(14.dp))
        TroOiPrimaryButton(
            text = "Tạo tài khoản",
            onClick = { onSignUp(fullName, phone, email, password) },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            enabled = valid,
        )
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
                    .padding(vertical = 4.dp),
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
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
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

@Composable
private fun AuthTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    keyboardType: KeyboardType = KeyboardType.Text,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    trailing: @Composable (() -> Unit)? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text(label) },
        leadingIcon = { Icon(icon, null, tint = TroOiMuted) },
        trailingIcon = trailing,
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        visualTransformation = visualTransformation,
        shape = RoundedCornerShape(8.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            focusedLabelColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.outline,
            focusedContainerColor = MaterialTheme.colorScheme.surface,
            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
        ),
    )
}
