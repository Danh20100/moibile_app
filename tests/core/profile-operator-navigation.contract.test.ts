import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string): string => readFileSync(path, 'utf8');
const root = read('app/src/main/java/com/trooi/app/features/profile/ProfileScreen.kt');
const settings = read('app/src/main/java/com/trooi/app/features/profile/AccountSettingsFlow.kt');
const onboarding = read('app/src/main/java/com/trooi/app/features/profile/LandlordOnboardingScreen.kt');
const operator = read('app/src/main/java/com/trooi/app/features/organization/OperatorWorkspace.kt');

function section(source: string, start: string, end: string): string {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, 'Missing screen section: ' + start);
  return source.slice(first, last);
}

test('Profile root preserves the six approved menu actions in their canonical order', () => {
  const ordered = [
    'ActionRow(Icons.Rounded.PersonOutline, "Xem hồ sơ"',
    'ActionRow(Icons.Rounded.Settings, "Cài đặt tài khoản"',
    'ActionRow(Icons.Rounded.Shield, "Quyền riêng tư & Pháp lý"',
    'ActionRow(Icons.Rounded.HomeWork, "Giới thiệu chủ nhà"',
    'ActionRow(Icons.AutoMirrored.Rounded.HelpOutline, "Nhận trợ giúp"',
    'ActionRow(Icons.AutoMirrored.Rounded.Logout, "Đăng xuất"',
  ];
  let prior = -1;
  for (const item of ordered) {
    const index = root.indexOf(item);
    assert.ok(index > prior, 'Missing/out-of-order approved Profile item: ' + item);
    prior = index;
  }
  assert.match(root, /ProfileShortcut\("Lịch sử thuê"/);
  assert.match(root, /ProfileShortcut\("Kết nối"/);
  assert.match(root, /profile-landlord-cta/);
});

test('Personal details cannot surface login email or Google linked accounts', () => {
  const personalFields = section(settings, 'private val personalFields', 'fun personalInputValid');
  assert.match(personalFields, /Tên pháp lý/);
  assert.match(personalFields, /Số điện thoại/);
  assert.match(personalFields, /Địa chỉ cư trú/);
  assert.doesNotMatch(personalFields, /"Email"/);
  const personal = section(settings, 'page == "personal" ->', 'page == "edit:Tên hiển thị"');
  assert.match(personal, /Tên hiển thị/);
  assert.match(personal, /Xác minh danh tính/);
  assert.doesNotMatch(personal, /Email đăng nhập|Tài khoản liên kết/);
});

test('Security retains PIN, password, login email and linked provider in one location', () => {
  const security = section(settings, 'page == "security" ->', 'page == "password" ->');
  for (const entry of ['Mã PIN bảo mật', 'Mật khẩu', 'Email đăng nhập', 'Tài khoản liên kết']) {
    assert.ok(security.includes(entry), 'Missing security entry: ' + entry);
  }
  assert.match(settings, /page == "pin" ->/);
  assert.match(settings, /page == "login-email" ->/);
});

test('Notification categories, channels and marketing-only opt-out stay discoverable', () => {
  const notifications = section(settings, 'page == "notifications" ->', 'page.startsWith("channel:")');
  for (const item of [
    'Ưu đãi', 'Cập nhật ứng dụng', 'Nhắc việc thuê trọ', 'Tin tức dịch vụ', 'Phản hồi',
    'operationalNotificationGroups', 'Quyền thông báo trên thiết bị',
    'Ngừng nhận tất cả ưu đãi và cập nhật',
  ]) assert.ok(notifications.includes(item), 'Missing notification category: ' + item);
  const channels = section(settings, 'page.startsWith("channel:")', 'page == "payments" ->');
  assert.match(channels, /"Trong ứng dụng"/);
  assert.match(channels, /"Email"/);
});

test('Finance and Operator routes remain available without fabricating transaction evidence', () => {
  const payments = section(settings, 'page == "payments" ->', 'page == "method" || page == "payout"');
  for (const item of [
    'Phương thức thanh toán', 'Các khoản thanh toán của bạn',
    'Phương thức nhận tiền', 'Lịch sử giao dịch / biên nhận',
  ]) assert.ok(payments.includes(item), 'Missing finance section: ' + item);
  for (const route of [
    'OperatorRoute.Dashboard', 'OperatorRoute.Properties', 'OperatorRoute.Rooms',
    'OperatorRoute.Rentals', 'OperatorRoute.Inquiries', 'OperatorRoute.Listing',
    'OperatorRoute.RoomHistory',
  ]) assert.ok(operator.includes(route), 'Missing operator workspace: ' + route);
  for (const title of [
    'Quét căn cước công dân', 'Kiểm tra thông tin', 'Thông tin liên hệ',
    'Bước $step / 3', 'scanCitizenId(bitmap)', 'firstAsset = null',
  ]) assert.ok(onboarding.includes(title), 'Missing three-step owner onboarding: ' + title);

});


test('Profile redesign prioritizes identity and account actions before supporting operations', () => {
  const anchors = [
    'TÀI KHOẢN CỦA TÔI',
    'ProfileSectionLabel("Tài khoản"',
    'ProfileSectionLabel("Hoạt động của bạn"',
    'ProfileSectionLabel("Thông tin & hỗ trợ"',
  ];
  let previous = -1;
  for (const anchor of anchors) {
    const index = root.indexOf(anchor);
    assert.ok(index > previous, 'Profile visual hierarchy is missing or out of order: ' + anchor);
    previous = index;
  }
  assert.match(root, /profile-hero-edit/);
  assert.match(root, /profile-landlord-cta/);
  assert.match(root, /Danh sách liên hệ/);
});

test('Account settings group functional destinations with release-friendly content', () => {
  for (const anchor of [
    'SettingsGroup("Hồ sơ & truy cập")',
    'SettingsGroup("Quyền riêng tư & thông báo")',
    'SettingsGroup("Tiện ích tài khoản")',
    'PersonalDetailRow(',
    'IdentityVerificationEntry('
  ]) assert.ok(settings.includes(anchor), 'Missing account hierarchy or honest preview: ' + anchor);
  const presentation = read('app/src/main/java/com/trooi/app/features/profile/ProfilePresentation.kt');
  assert.match(presentation, /operates && rents -> "Chủ trọ · Người thuê"/);
});

test('Support and legal material use one offline profile catalog', () => {
  const catalog = JSON.parse(read('app/src/main/assets/content/profile-catalog.vi.json'));
  assert.equal(catalog.version, 1);
  assert.equal(catalog.locale, 'vi-VN');
  assert.deepEqual(catalog.legal.map((item: { id: string }) => item.id), ['terms', 'privacy']);
  assert.ok(catalog.help.length >= 4);
  for (const article of catalog.help) {
    assert.ok(article.id && article.title && article.summary && article.paragraphs.length);
    assert.ok(article.paragraphs.every((paragraph: string) => paragraph.trim().length >= 20));
  }
  assert.match(settings, /loadProfileCatalog\(context\)/);
  assert.match(settings, /profileCatalog\?\.help/);
  assert.match(settings, /profileCatalog\?\.legal/);
});

test('Three-step onboarding does not require a first property and keeps OCR separate from KYC', () => {
  assert.match(onboarding, /Bước \$step \/ 3/);
  assert.match(onboarding, /scanCitizenId\(bitmap\)/);
  assert.match(onboarding, /firstAsset = null/);
  assert.doesNotMatch(onboarding, /"Bước \$step \/ 5"/);
  assert.match(read('app/src/main/java/com/trooi/app/features/profile/CitizenIdOcr.kt'), /NOT identity verification/);
});

test('Standalone Settings wires Operator/onboarding callbacks and blocks back during Profile save', () => {
  const wrapper = read('app/src/main/java/com/trooi/app/features/shared/SharedSettingsHelpScreens.kt');
  assert.match(wrapper, /onOpenOperatorWorkspace = onOpenWorkspace/);
  assert.match(wrapper, /onStartLandlordOnboarding = \{ onboarding = true \}/);
  assert.match(wrapper, /if \(onboarding\) LandlordOnboardingScreen/);
  const app = read('app/src/main/java/com/trooi/app/ui/TroOiApp.kt');
  assert.match(app, /SettingsScreen\([\s\S]*?onOpenWorkspace = viewModel::openOperatorWorkspaceFromAccount[\s\S]*?onCompleteLandlord = viewModel::completeLocalLandlordOnboarding/);
  assert.match(settings, /fun requestBack\(\) \{ if \(savingProfile\) return/);
});
