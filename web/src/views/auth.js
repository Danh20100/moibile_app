import { brand } from "../components.js";

export function welcomeView() {
  return `<main class="auth-shell">
    <section class="auth-card welcome-card">
      ${brand()}
      <h1>Tìm phòng và quản lý nhà trọ trên một ứng dụng.</h1>
      <p class="muted">Thông tin rõ ràng, thao tác gọn.</p>
      <div class="stack actions">
        <a class="btn primary" href="/login" data-link>Đăng nhập</a>
        <a class="btn secondary" href="/signup" data-link>Tạo tài khoản</a>
      </div>
    </section>
  </main>`;
}

export function loginView() {
  return `<main class="auth-shell"><section class="auth-card">
    <a class="back-link" href="/" data-link>← Quay lại</a>
    ${brand()}
    <h1>Đăng nhập</h1>
    <form id="login-form" class="stack" novalidate>
      <label>Vai trò<select name="role"><option value="tenant">Người thuê</option><option value="landlord">Chủ trọ</option></select></label>
      <label>Email hoặc số điện thoại<input name="identifier" autocomplete="username" required /></label>
      <label>Mật khẩu<input name="password" type="password" autocomplete="current-password" minlength="6" required /></label>
      <p class="form-error" data-form-error></p>
      <button class="btn primary" type="submit">Đăng nhập</button>
    </form>
    <p class="auth-foot">Chưa có tài khoản? <a href="/signup" data-link>Đăng ký</a></p>
  </section></main>`;
}

export function signupView() {
  return `<main class="auth-shell"><section class="auth-card">
    <a class="back-link" href="/" data-link>← Quay lại</a>
    ${brand()}
    <h1>Tạo tài khoản</h1>
    <form id="signup-form" class="stack" novalidate>
      <label>Vai trò<select name="role"><option value="tenant">Người thuê</option><option value="landlord">Chủ trọ</option></select></label>
      <label>Họ và tên<input name="name" autocomplete="name" maxlength="80" required /></label>
      <label>Số điện thoại<input name="phone" inputmode="tel" autocomplete="tel" required /></label>
      <label>Email<input name="email" type="email" autocomplete="email" required /></label>
      <label>Mật khẩu<input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>
      <p class="form-error" data-form-error></p>
      <button class="btn primary" type="submit">Tạo tài khoản</button>
    </form>
    <p class="auth-foot">Đã có tài khoản? <a href="/login" data-link>Đăng nhập</a></p>
  </section></main>`;
}
