import { escapeHtml } from "./core/security.js";

export function brand() {
  return `<div class="brand"><span class="brand-mark" aria-hidden="true">⌂</span><strong>TrọƠi</strong></div>`;
}

export function topBar(title, action = "") {
  return `<header class="topbar"><h1>${escapeHtml(title)}</h1>${action}</header>`;
}

export function formatVnd(value) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value) || 0)}đ`;
}

export function tenantNav(active) {
  const items = [
    ["/tenant", "⌂", "Trang chủ", "home"],
    ["/tenant/saved", "♡", "Yêu thích", "saved"],
    ["/tenant/schedule", "▣", "Lịch hẹn", "schedule"],
    ["/tenant/messages", "◌", "Tin nhắn", "messages"],
    ["/tenant/profile", "○", "Tài khoản", "profile"]
  ];
  return bottomNav(items, active);
}

export function landlordNav(active) {
  const items = [
    ["/landlord", "⌂", "Tổng quan", "dashboard"],
    ["/landlord/rooms", "▣", "Phòng", "rooms"],
    ["/landlord/finance", "₫", "Tài chính", "finance"],
    ["/landlord/tickets", "⚙", "Yêu cầu", "tickets"],
    ["/landlord/profile", "○", "Tài khoản", "profile"]
  ];
  return bottomNav(items, active);
}

function bottomNav(items, active) {
  return `<nav class="bottom-nav" aria-label="Điều hướng chính">${items.map(([href, icon, label, key]) => `
    <a href="${href}" data-link class="nav-item ${active === key ? "active" : ""}" aria-current="${active === key ? "page" : "false"}">
      <span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>
    </a>`).join("")}</nav>`;
}

export function emptyState(title, body) {
  return `<section class="empty"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></section>`;
}

export function notice(message) {
  if (!message) return "";
  return `<div class="toast" role="status">${escapeHtml(message)}</div>`;
}
