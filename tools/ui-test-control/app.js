'use strict';

// Declarative screen catalogue. Protected destinations still respect app capability checks.
const FLOWS = [
  { group: 'Authentication', screens: [
    { id: 'welcome', label: 'Welcome', icon: '⌂', desc: 'Màn hình mở đầu, logo và hành động đăng nhập/đăng ký.', chips: ['Entry point', 'Public'] },
    { id: 'login', label: 'Login', icon: '↪', desc: 'Điền thông tin mẫu rồi mở màn hình đăng nhập. Không tự gửi form.', chips: ['Form prefill', 'Public'], fields: ['identifier','password'] },
    { id: 'signup', label: 'Register', icon: '✧', desc: 'Điền hồ sơ người thuê mẫu và mở trang tạo tài khoản. Không tự đăng ký.', chips: ['Form prefill', 'Public'], fields: ['fullName','phone','email','password'] },
    { id: 'forgot', label: 'Reset password', icon: '◌', desc: 'Đưa email/số điện thoại mẫu vào giao diện khôi phục.', chips: ['Form prefill', 'Public'], fields: ['identifier'] },
  ] },
  { group: 'Discovery', screens: [
    { id: 'discovery', label: 'Explore listings', icon: '⌕', desc: 'Danh sách phòng trọ công khai; Mock có fixture, Backend lấy từ API.', chips: ['Read-only', 'Public'] },
    { id: 'map', label: 'Explore map', icon: '⌖', desc: 'Bản đồ khám phá, có thể phụ thuộc Google Maps API key.', chips: ['Map', 'Public'] },
    { id: 'listing', label: 'Listing details', icon: '▤', desc: 'Mở tin đăng theo ID đã tồn tại trong nguồn dữ liệu hiện tại.', chips: ['Listing ID', 'Public'], fields: ['listingId'] },
    { id: 'favorites', label: 'Favorites', icon: '♡', desc: 'Danh sách yêu thích, cần phiên đăng nhập.', chips: ['Requires auth'] },
    { id: 'activity', label: 'Discover activity', icon: '◷', desc: 'Hoạt động trong bối cảnh khám phá.', chips: ['Read-only'] },
  ] },
  { group: 'Workspace', screens: [
    { id: 'workspace', label: 'Rental ledger', icon: '▥', desc: 'Sổ vận hành thuê trọ và trạng thái liên quan.', chips: ['Requires auth'] },
    { id: 'messages', label: 'Messages', icon: '▭', desc: 'Hộp thư, cuộc hội thoại và trạng thái tải.', chips: ['Requires auth'] },
    { id: 'account', label: 'Account', icon: '◎', desc: 'Hồ sơ tài khoản, cần đăng nhập.', chips: ['Requires auth'] },
    { id: 'context', label: 'Switch context', icon: '⇄', desc: 'Chọn không gian Tenant/Operations hợp lệ.', chips: ['Requires auth'] },
    { id: 'notifications', label: 'Notifications', icon: '♧', desc: 'Trung tâm thông báo và bằng chứng liên quan.', chips: ['Requires auth'] },
    { id: 'settings', label: 'Settings', icon: '⚙', desc: 'Cài đặt người dùng trong ứng dụng.', chips: ['Requires auth'] },
    { id: 'help', label: 'Help', icon: '?', desc: 'Trợ giúp, dành cho người dùng đã đăng nhập.', chips: ['Requires auth'] },
  ] },
  { group: 'Tenant lifecycle', screens: [
    { id: 'tenant-home', label: 'Tenant home', icon: '⌂', desc: 'Tổng quan không gian đang thuê.', chips: ['Tenant access'] },
    { id: 'tenant-rental', label: 'My rental', icon: '▣', desc: 'Phòng thuê, hợp đồng và dữ liệu tenancy.', chips: ['Tenant access'] },
    { id: 'tenant-finance', label: 'Payments', icon: '◈', desc: 'Giao diện thanh toán và công nợ; không có auto-pay từ web.', chips: ['Tenant access', 'No auto-pay'] },
    { id: 'tenant-incidents', label: 'Incidents', icon: '⚑', desc: 'Ticket báo sự cố phòng trọ.', chips: ['Tenant access'] },
  ] },
  { group: 'Owner operations', screens: [
    { id: 'owner-dashboard', label: 'Dashboard', icon: '▦', desc: 'Bảng điều khiển vận hành khu trọ.', chips: ['Owner access'] },
    { id: 'owner-properties', label: 'Properties', icon: '▤', desc: 'Cấu trúc và thông tin phòng/khu trọ.', chips: ['Owner access'] },
    { id: 'owner-finance', label: 'Finance', icon: '⌑', desc: 'Công nợ và báo cáo tài chính.', chips: ['Owner access'] },
    { id: 'owner-incidents', label: 'Issue tickets', icon: '♢', desc: 'Vận hành và xử lý sự cố.', chips: ['Owner access'] },
  ] },
];
const FIELDS = {
  identifier: { label: 'Email / Phone', type: 'text', placeholder: 'demo@trooi.test', hint: 'Dữ liệu mẫu; không lưu trên server.' },
  password: { label: 'Test password', type: 'password', placeholder: 'Nhập mật khẩu thử nghiệm', hint: 'Không sử dụng mật khẩu cá nhân/thật.' },
  fullName: { label: 'Full name', type: 'text', placeholder: 'Nguyễn Văn Demo' },
  phone: { label: 'Phone number', type: 'tel', placeholder: '0912345678' },
  email: { label: 'Email', type: 'email', placeholder: 'demo@trooi.test' },
  listingId: { label: 'Listing ID', type: 'text', placeholder: 'ID tin đăng có sẵn trên app', hint: 'Chỉ mở được tin đăng hiện đang khả dụng.' },
};
// These accounts/IDs are from Debug's DemoData and DemoRentalGraph, not guessed credentials.
const MOCK_USERS = Object.freeze({
  tenant: { label: 'Tenant', identifier: 'tenant@trooi.local', password: 'TroOi2026!' },
  owner: { label: 'Owner', identifier: 'owner@trooi.local', password: 'TroOi2026!' },
  onboarding: { label: 'Onboarding', identifier: 'onboarding@trooi.local', password: 'TroOi2026!' },
});
const FIELD_DEFAULTS = Object.freeze({
  login: { ...MOCK_USERS.tenant },
  signup: { fullName: 'Nguyễn Văn Demo', phone: '0912345678', email: 'newdemo@trooi.local', password: 'TroOi2026!' },
  forgot: { identifier: MOCK_USERS.tenant.identifier },
  listing: { listingId: 'demo-studio' },
});
let selectedPersona = 'tenant';
const $ = id => document.getElementById(id);
let current = FLOWS[0].screens[0];
let availableDevices = [];
let screenshotUrl = null;
let autoTimer = null;
let busy = false;
let toastTimer = null;

function toast(message, error = false) {
  const element = $('toast');
  element.textContent = message;
  element.className = 'toast' + (error ? ' error' : '');
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.hidden = true; }, 6500);
}

function activity(message, subtitle, failed = false) {
  const row = document.createElement('div'); row.className = 'event';
  const led = document.createElement('span'); led.className = 'event-dot ' + (failed ? 'bad' : 'good');
  const box = document.createElement('div'); box.textContent = message;
  const detail = document.createElement('small'); detail.textContent = subtitle;
  box.appendChild(detail); row.append(led, box);
  const log = $('log'); log.prepend(row);
  while (log.children.length > 6) log.lastElementChild.remove();
}

function renderNavigation() {
  const nav = $('flows'); nav.replaceChildren();
  let total = 0;
  for (const group of FLOWS) {
    const section = document.createElement('div'); section.className = 'nav-group';
    const title = document.createElement('div'); title.className = 'nav-section'; title.textContent = group.group;
    section.appendChild(title);
    for (const flow of group.screens) {
      total++;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-button' + (flow.id === current.id ? ' active' : '');
      const icon = document.createElement('span'); icon.className = 'nav-icon'; icon.textContent = flow.icon;
      const label = document.createElement('span'); label.textContent = flow.label;
      button.append(icon, label);
      button.addEventListener('click', () => selectFlow(flow));
      section.append(button);
    }
    nav.append(section);
  }
  $('flow-count').textContent = String(total);
}

function selectFlow(flow) {
  current = flow;
  $('flow-title').textContent = flow.label;
  $('flow-description').textContent = flow.desc;
  const chips = $('flow-chips'); chips.replaceChildren();
  for (const name of flow.chips) {
    const span = document.createElement('span'); span.className = 'chip' + (/auth|access|auto-pay/i.test(name) ? ' warning' : '');
    span.textContent = name; chips.append(span);
  }
  const fields = $('fields'); fields.replaceChildren();
  const keys = flow.fields || [];
  const presets = $('presets'); presets.replaceChildren();
  presets.hidden = flow.id !== 'login';
  if (flow.id === 'login') {
    selectedPersona = 'tenant';
    const caption = document.createElement('div');
    caption.className = 'preset-label';
    caption.textContent = 'MOCK ACCOUNTS · ONE CLICK';
    presets.append(caption);
    const buttons = document.createElement('div');
    buttons.className = 'preset-buttons';
    for (const [key, profile] of Object.entries(MOCK_USERS)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'preset-button';
      button.textContent = profile.label;
      button.dataset.persona = key;
      button.addEventListener('click', () => {
        selectedPersona = key;
        applyCurrentDefaults();
      });
      buttons.append(button);
    }
    presets.append(buttons);
    const note = document.createElement('div');
    note.className = 'preset-note';
    note.textContent = 'Các tài khoản trên chỉ đăng nhập được khi chọn Mock Data.';
    presets.append(note);
  }
  for (const key of keys) {
    const spec = FIELDS[key];
    const wrapper = document.createElement('div'); wrapper.className = 'field' + (keys.length === 1 ? ' wide' : '');
    const label = document.createElement('label'); label.htmlFor = 'field-' + key; label.textContent = spec.label;
    const input = document.createElement('input'); input.type = spec.type; input.id = 'field-' + key;
    input.name = key; input.placeholder = spec.placeholder; input.maxLength = 180;
    input.value = ((FIELD_DEFAULTS[flow.id] || {})[key] || '');
    input.spellcheck = false; input.autocomplete = 'off';
    wrapper.append(label, input);
    if (spec.hint) { const hint = document.createElement('small'); hint.textContent = spec.hint; wrapper.append(hint); }
    fields.append(wrapper);
  }
  $('field-hint').textContent = keys.length ? keys.length + ' test fields' : 'No fields required';
  $('empty-fields').hidden = keys.length > 0;
  $('reset-input').hidden = keys.length === 0;
  applyCurrentDefaults();
  renderNavigation();
}

function applyCurrentDefaults() {
  const defaults = current.id === 'login' ? MOCK_USERS[selectedPersona] : (FIELD_DEFAULTS[current.id] || {});
  for (const key of current.fields || []) {
    const field = $('field-' + key);
    if (field) field.value = defaults[key] || '';
  }
  document.querySelectorAll('.preset-button').forEach(button => {
    const active = button.dataset.persona === selectedPersona;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', ...options });
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) throw new Error(data.error || 'Request failed (' + response.status + ')');
  return data;
}

async function refreshDevices(quiet = false) {
  try {
    const { devices } = await api('/api/devices');
    availableDevices = devices;
    const previous = $('device').value;
    const selector = $('device'); selector.replaceChildren();
    if (!devices.length) {
      const option = new Option('No emulator online', '');
      selector.add(option);
      $('led').classList.remove('on');
      $('device-pill').textContent = 'Disconnected';
      $('device-pill').style.color = 'var(--error)';
      $('device-status').textContent = 'Offline';
    } else {
      for (const device of devices) selector.add(new Option(device, device));
      if (previous && devices.includes(previous)) selector.value = previous;
      $('led').classList.add('on');
      $('device-pill').textContent = devices.length + ' ready';
      $('device-pill').style.color = 'var(--green)';
      $('device-status').textContent = 'Connected';
    }
    if (!quiet) activity('ADB device scan', devices.length ? devices.join(', ') : 'Chưa có Emulator bật');
    return devices.length > 0;
  } catch (error) {
    $('device-status').textContent = 'ADB error';
    if (!quiet) toast(error.message, true);
    return false;
  }
}

function device() { return $('device').value; }
async function sendControl(payload) {
  if (busy) return;
  busy = true;
  $('enter').disabled = true;
  document.querySelectorAll('.mode-button').forEach(b => { b.disabled = true; });
  try {
    const result = await api('/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Trooi-Test-Control': 'local-ui' },
      body: JSON.stringify({ device: device(), ...payload }),
    });
    const detail = (result.route || 'mode') + (result.mode ? ' · ' + result.mode : '') + ' → ' + result.device;
    activity('Command delivered', detail);
    toast('Đã gửi tới ' + result.device + '. Kiểm tra ảnh/màn hình để xác nhận.');
    if (!$('preview-dialog').hidden) {
      await new Promise(resolve => setTimeout(resolve, 1150));
      await capture(true);
    }
    return true;
  } catch (error) {
    activity('Test command failed', error.message, true);
    toast(error.message, true);
    return false;
  } finally {
    busy = false;
    $('enter').disabled = false;
    document.querySelectorAll('.mode-button').forEach(b => { b.disabled = false; });
  }
}

async function capture(quiet = false) {
  const chosen = device();
  if (!chosen) {
    if (!quiet) toast('Bật Emulator trong Android Studio trước.', true);
    return;
  }
  try {
    const res = await fetch('/api/screenshot?device=' + encodeURIComponent(chosen) + '&t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Screenshot error');
    }
    const blob = await res.blob();
    const next = URL.createObjectURL(blob);
    const img = $('screenshot');
    img.onload = () => {
      if (screenshotUrl) URL.revokeObjectURL(screenshotUrl);
      screenshotUrl = next;
    };
    img.onerror = () => { URL.revokeObjectURL(next); };
    img.src = next; img.hidden = false;
    $('screen-placeholder').hidden = true;
    if (!quiet) activity('Screenshot captured', chosen);
  } catch (error) {
    if (!quiet) toast(error.message, true);
  }
}

function initialize() {
  selectFlow(current);
  $('clock').textContent = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' });
  $('flow-form').addEventListener('submit', async event => {
    event.preventDefault();
    const fields = {};
    for (const key of current.fields || []) fields[key] = $('field-' + key).value;
    if (current.id === 'listing' && !fields.listingId?.trim()) {
      toast('Listing ID bắt buộc để mở chi tiết.', true); return;
    }
    await sendControl({ route: current.id, fields });
  });
  $('reset-input').addEventListener('click', applyCurrentDefaults);
  $('mode-mock').addEventListener('click', () => sendControl({ mode: 'mock' }));
  $('mode-backend').addEventListener('click', () => {
    if (confirm('Chuyển sang Backend thật? Phiên hiện tại có thể bị đăng xuất. Dùng dữ liệu test, không thao tác thanh toán thật.')) {
      sendControl({ mode: 'backend' });
    }
  });
  $('refresh-devices').addEventListener('click', () => refreshDevices());
  $('capture').addEventListener('click', () => capture());
  $('device').addEventListener('change', () => {
    if (!$('preview-dialog').hidden) capture();
  });
  function closePreview() {
    $('preview-dialog').hidden = true;
    $('auto-capture').checked = false;
    clearInterval(autoTimer);
    autoTimer = null;
  }
  $('preview-toggle').addEventListener('click', () => {
    $('preview-dialog').hidden = false;
    capture(true);
  });
  $('preview-close').addEventListener('click', closePreview);
  $('preview-dialog').addEventListener('click', event => {
    if (event.target === $('preview-dialog')) closePreview();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('preview-dialog').hidden) closePreview();
  });
  $('auto-capture').addEventListener('change', event => {
    clearInterval(autoTimer);
    if (event.target.checked) {
      autoTimer = setInterval(() => {
        if (!document.hidden && !busy) capture(true);
      }, 4000);
    }
  });
  $('clear-history').addEventListener('click', () => $('log').replaceChildren());
  refreshDevices(true);
  setInterval(() => refreshDevices(true), 12000);
}

document.addEventListener('DOMContentLoaded', initialize);
