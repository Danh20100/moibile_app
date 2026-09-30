import { emptyState, formatVnd, notice, tenantNav, topBar } from "../components.js";
import { escapeHtml } from "../core/security.js";

export function tenantHomeView(state) {
  const rooms = state.rooms;
  return shell("home", `${topBar("Tìm phòng")}
    <section class="search-row"><input id="room-search" type="search" placeholder="Khu vực hoặc tên phòng" aria-label="Tìm phòng" /><button class="icon-btn" id="search-button" aria-label="Tìm">⌕</button></section>
    <section class="chips" aria-label="Bộ lọc"><button class="chip active">2–6 triệu</button><button class="chip">Đã xác minh</button><button class="chip">Tiện ích</button></section>
    <section class="section"><div class="section-head"><h2>Phòng phù hợp</h2><span>${rooms.length} phòng</span></div>${rooms.map((room) => roomCard(room, state.savedIds.includes(room.id))).join("")}</section>${notice(state.notice)}`);
}

export function tenantSavedView(state) {
  const rooms = state.rooms.filter((room) => state.savedIds.includes(room.id));
  return shell("saved", `${topBar("Yêu thích")}${rooms.length ? rooms.map((room) => roomCard(room, true)).join("") : emptyState("Chưa có phòng đã lưu", "Bấm trái tim ở phòng bạn quan tâm.")}`);
}

export function tenantScheduleView(state) {
  return shell("schedule", `${topBar("Lịch hẹn")}${state.bookings.length ? state.bookings.map((booking) => {
    const room = state.rooms.find((item) => item.id === booking.roomId);
    return `<article class="card schedule-card"><div><h2>${escapeHtml(room?.name ?? "Phòng")}</h2><p>${escapeHtml(booking.date)} · ${escapeHtml(booking.time)}</p></div><span class="status warning">Chờ xác nhận</span></article>`;
  }).join("") : emptyState("Chưa có lịch hẹn", "Đặt lịch từ trang chi tiết phòng.")}`);
}

export function tenantMessagesView(state) {
  return shell("messages", `${topBar("Tin nhắn")}${state.conversations.length ? state.conversations.map((item) => `<article class="card row-card"><div class="avatar">${escapeHtml(item.landlord?.slice(-1) || "T")}</div><div><h2>${escapeHtml(item.landlord)}</h2><p>${escapeHtml(item.messages?.at(-1)?.text ?? "")}</p></div></article>`).join("") : emptyState("Chưa có cuộc trò chuyện", "Tin nhắn với chủ trọ sẽ xuất hiện tại đây.")}`);
}

export function tenantProfileView(state) {
  return shell("profile", `${topBar("Tài khoản")}
    <section class="card profile-card"><div class="avatar large">${escapeHtml((state.session?.name || "T").slice(0, 1).toUpperCase())}</div><div><h2>${escapeHtml(state.session?.name || "Tài khoản demo")}</h2><p>Người thuê</p></div></section>
    <button class="list-button" data-switch-role="landlord">Chuyển sang Chủ trọ <span>›</span></button>
    <button class="list-button danger-text" data-logout>Đăng xuất <span>›</span></button>`);
}

export function roomDetailView(state, roomId) {
  const room = state.rooms.find((item) => item.id === Number(roomId));
  if (!room) return shell("home", `${topBar("Chi tiết phòng")} ${emptyState("Không tìm thấy phòng", "Phòng này không còn trong danh sách.")}`);
  const saved = state.savedIds.includes(room.id);
  return `<div class="app-shell detail-shell"><main class="content">
    <header class="detail-top"><a class="icon-btn link-btn" href="/tenant" data-link aria-label="Quay lại">←</a><strong>Chi tiết phòng</strong><button class="icon-btn ${saved ? "saved" : ""}" data-save-room="${room.id}" aria-label="Lưu phòng">♥</button></header>
    <div class="room-photo" aria-hidden="true"><span>${room.size}</span></div>
    <section class="card detail-card"><div class="room-title"><div><h1>${escapeHtml(room.name)}</h1><p>${escapeHtml(room.area)}</p></div><strong class="price">${formatVnd(room.price)}<small>/tháng</small></strong></div>
      <div class="meta-grid"><span>${escapeHtml(room.size)}</span><span>${escapeHtml(room.type)}</span><span>★ ${room.score}</span></div>
    </section>
    <section class="card"><h2>Tiện ích</h2><div class="amenities">${room.amenities.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div></section>
    <section class="card"><h2>Địa chỉ</h2><p>${escapeHtml(room.address)}</p><p class="verified">${room.verified ? "✓ Đã xác minh" : "Chưa xác minh"}</p></section>
    <form id="booking-form" class="card stack"><h2>Đặt lịch xem phòng</h2><label>Ngày<input type="date" name="date" required /></label><label>Giờ<select name="time" required><option value="">Chọn giờ</option><option>09:00</option><option>10:30</option><option>14:00</option><option>16:00</option><option>18:00</option></select></label><p class="form-error" data-form-error></p><button class="btn primary" type="submit" data-room-id="${room.id}">Gửi yêu cầu</button></form>
  </main></div>`;
}

function roomCard(room, saved) {
  return `<article class="card room-card"><div class="room-link"><a href="/tenant/room/${room.id}" data-link class="room-hit-area" aria-label="Xem ${escapeHtml(room.name)}"></a><div class="thumb" aria-hidden="true"></div><div class="room-copy"><div class="room-heading"><h3>${escapeHtml(room.name)}</h3><button class="heart ${saved ? "saved" : ""}" type="button" data-save-room="${room.id}" aria-label="${saved ? "Bỏ lưu" : "Lưu phòng"}">♥</button></div><p>${escapeHtml(room.area)}</p><strong class="price">${formatVnd(room.price)}<small>/tháng</small></strong><div class="meta-row"><span>${escapeHtml(room.size)}</span><span>${escapeHtml(room.type)}</span><span>★ ${room.score}</span></div></div></div></article>`;
}

function shell(active, content) {
  return `<div class="app-shell"><main class="content">${content}</main>${tenantNav(active)}</div>`;
}
