package com.trooi.app.features.auth

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.trooi.app.ui.components.TroOiBrand
import com.trooi.app.ui.components.TroOiPrimaryButton
import com.trooi.app.ui.theme.*

@Composable
fun AuthWelcomeScreen(onLogin: () -> Unit, onSignUp: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 24.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.weight(1f))
        Surface(
            shape = RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp, bottomEnd = 12.dp, bottomStart = 4.dp),
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(80.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(Icons.Rounded.HomeWork, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(48.dp))
            }
        }
        Spacer(Modifier.height(22.dp))
        TroOiBrand()
        Spacer(Modifier.height(10.dp))
        Text(
            "Tìm phòng. Quản lý nhà trọ.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.weight(1f))
        TroOiPrimaryButton("Đăng nhập", onLogin, Modifier.fillMaxWidth().height(54.dp))
        Spacer(Modifier.height(10.dp))
        OutlinedButton(
            onClick = onSignUp,
            modifier = Modifier.fillMaxWidth().height(54.dp),
            shape = RoundedCornerShape(10.dp),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary),
        ) {
            Text("Tạo tài khoản", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(12.dp))
        Text(
            "Tiếp tục nghĩa là bạn đồng ý với Điều khoản và Chính sách quyền riêng tư.",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
fun LoginScreen(onBack: () -> Unit, onSignUp: () -> Unit, onForgotPassword: () -> Unit, onLogin: (String, String) -> Unit) {
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    val identifierOk = isValidIdentifier(identifier)
    val passwordOk = isValidPassword(password)

    AuthFormScaffold(onBack = onBack, title = "Chào mừng trở lại", subtitle = "Đăng nhập để tiếp tục với TrọƠi") {
        AuthTextField(identifier, { identifier = it }, "Email hoặc số điện thoại", Icons.Rounded.Person, keyboardType = KeyboardType.Email)
        Spacer(Modifier.height(12.dp))
        AuthTextField(
            password,
            { password = it },
            "Mật khẩu",
            Icons.Rounded.Lock,
            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
            trailing = {
                IconButton(onClick = { showPassword = !showPassword }) {
                    Icon(if (showPassword) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility, null, tint = TroOiMuted)
                }
            },
        )
        TextButton(onClick = onForgotPassword, modifier = Modifier.align(Alignment.End)) { Text("Quên mật khẩu?", color = MaterialTheme.colorScheme.primary) }
        TroOiPrimaryButton(
            text = "Đăng nhập",
            onClick = { onLogin(identifier.trim(), password) },
            modifier = Modifier.fillMaxWidth().height(54.dp),
            enabled = identifierOk && passwordOk,
        )
        Spacer(Modifier.height(18.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            Text("Chưa có tài khoản?", color = MaterialTheme.colorScheme.onSurfaceVariant)
            TextButton(onClick = onSignUp) { Text("Đăng ký", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
fun ForgotPasswordScreen(onBack: () -> Unit, onSubmit: (String) -> Unit) {
    var identifier by remember { mutableStateOf("") }
    AuthFormScaffold(
        onBack = onBack,
        title = "Khôi phục mật khẩu",
        subtitle = "Nhập email hoặc số điện thoại đã đăng ký.",
    ) {
        AuthTextField(identifier, { identifier = it }, "Email hoặc số điện thoại", Icons.Rounded.AlternateEmail)
        Spacer(Modifier.height(18.dp))
        TroOiPrimaryButton("Gửi hướng dẫn khôi phục", { onSubmit(identifier.trim()) }, Modifier.fillMaxWidth().height(54.dp), enabled = identifier.trim().length >= 5)
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
        title = "Tạo tài khoản",
        subtitle = "Quyền truy cập sẽ được xác định theo quan hệ thuê và nơi bạn vận hành.",
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
        Spacer(Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.Top) {
            Checkbox(checked = accepted, onCheckedChange = { accepted = it }, colors = CheckboxDefaults.colors(checkedColor = MaterialTheme.colorScheme.primary))
            Text("Tôi đồng ý với Điều khoản sử dụng và Chính sách quyền riêng tư.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp))
        }
        Spacer(Modifier.height(12.dp))
        TroOiPrimaryButton("Tạo tài khoản", { onSignUp(fullName, phone, email, password) }, Modifier.fillMaxWidth().height(54.dp), enabled = valid)
        Spacer(Modifier.height(14.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            Text("Đã có tài khoản?", color = MaterialTheme.colorScheme.onSurfaceVariant)
            TextButton(onClick = onLogin) { Text("Đăng nhập", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
private fun AuthFormScaffold(onBack: () -> Unit, title: String, subtitle: String, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).verticalScroll(rememberScrollState()).padding(20.dp),
    ) {
        IconButton(onClick = onBack, modifier = Modifier.offset(x = (-10).dp)) { Icon(Icons.Rounded.ArrowBack, "Quay lại", tint = TroOiText) }
        Spacer(Modifier.height(10.dp))
        TroOiBrand()
        Spacer(Modifier.height(24.dp))
        Text(title, style = MaterialTheme.typography.headlineLarge)
        Spacer(Modifier.height(6.dp))
        Text(subtitle, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(26.dp))
        content()
        Spacer(Modifier.height(28.dp))
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
