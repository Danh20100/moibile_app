import { formatVnd, landlordNav, topBar } from "../components.js";
import { escapeHtml } from "../core/security.js";

export function landlordDashboardView(state) {
  const d = state.landlord ?? { rooms: 0, occupied: 0, collected: 0, expected: 0, debt: 0, openTickets: 0 };
  const rate = d.expected ? Math.round((d.collected / d.expected) * 100) : 0;
  return shell("dashboard", `${topBar("Tổng quan")}
    <section class="hero-card"><p>Thu tiền tháng này</p><strong>${formatVnd(d.collected)}</strong><span>${rate}% · ${d.occupied}/${d.rooms} phòng đang thuê</span></section>
    <section class="kpi-grid"><a href="/landlord/finance" data-link class="kpi"><span>Công nợ</span><strong>${formatVnd(d.debt)}</strong></a><a href="/landlord/tickets" data-link class="kpi"><span>Yêu cầu mở</span><strong>${d.openTickets}</strong></a><a href="/landlord/rooms" data-link class="kpi"><span>Phòng</span><strong>${d.rooms}</strong></a><div class="kpi"><span>Lấp đầy</span><strong>${d.rooms ? Math.round(d.occupied / d.rooms * 100) : 0}%</strong></div></section>`);
}

export function landlordRoomsView(state) {
  return shell("rooms", `${topBar("Phòng")}<section class="stack">${state.rooms.map((room, index) => `<article class="card landlord-room"><div><span class="eyebrow">P.${String(index + 101)}</span><h2>${escapeHtml(room.name)}</h2><p>${escapeHtml(room.area)}</p></div><strong>${formatVnd(room.price)}</strong></article>`).join("")}</section>`);
}

export function landlordFinanceView(state) {
  const d = state.landlord ?? { collected: 0, expected: 0, debt: 0 };
  return shell("finance", `${topBar("Tài chính")}<section class="hero-card light"><p>Đã thu</p><strong>${formatVnd(d.collected)}</strong><span>Dự kiến ${formatVnd(d.expected)}</span></section><section class="card"><div class="summary-row"><span>Công nợ</span><strong class="danger-text">${formatVnd(d.debt)}</strong></div></section>`);
}

export function landlordTicketsView(state) {
  const count = state.landlord?.openTickets ?? 0;
  return shell("tickets", `${topBar("Yêu cầu")}<section class="card ticket"><span class="status danger">Ưu tiên</span><h2>Rò rỉ ống nước bồn rửa</h2><p>P.202 · Đang chờ xử lý</p></section>${count > 1 ? `<section class="card ticket"><span class="status neutral">Bình thường</span><h2>Đèn hành lang chập chờn</h2><p>P.203 · Đang chờ xử lý</p></section>` : ""}`);
}

export function landlordProfileView(state) {
  return shell("profile", `${topBar("Tài khoản")}<section class="card profile-card"><div class="avatar large">${escapeHtml((state.session?.name || "C").slice(0, 1).toUpperCase())}</div><div><h2>${escapeHtml(state.session?.name || "Tài khoản demo")}</h2><p>Chủ trọ</p></div></section><button class="list-button" data-switch-role="tenant">Chuyển sang Người thuê <span>›</span></button><button class="list-button danger-text" data-logout>Đăng xuất <span>›</span></button>`);
}

function shell(active, content) {
  return `<div class="app-shell"><main class="content">${content}</main>${landlordNav(active)}</div>`;
}
