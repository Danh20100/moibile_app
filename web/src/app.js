import { config } from "./core/config.js";
import { loginWithBackend, signUpWithBackend } from "./core/api.js";
import { currentPath, navigate, onRouteChange } from "./core/router.js";
import { addBooking, createStore, toggleSaved } from "./core/store.js";
import { scrollPositionForRender } from "./core/scroll.js";
import { isEmail, isPhone, normalizeText } from "./core/security.js";
import { loginView, signupView, welcomeView } from "./views/auth.js";
import { landlordDashboardView, landlordFinanceView, landlordProfileView, landlordRoomsView, landlordTicketsView } from "./views/landlord.js";
import { roomDetailView, tenantHomeView, tenantMessagesView, tenantProfileView, tenantSavedView, tenantScheduleView } from "./views/tenant.js";

const root = document.querySelector("#app");
const store = createStore({ demoMode: config.demoMode });

let lastRenderedPath = null;
const scrollByPath = new Map();
function render() {
  const state = store.getState();
  const path = currentPath();
  const changingPage = lastRenderedPath !== null && path !== lastRenderedPath;
  if (changingPage) scrollByPath.set(lastRenderedPath, window.scrollY);
  const oldScrollY = scrollPositionForRender(lastRenderedPath, path, window.scrollY);
  root.innerHTML = resolveView(path, state);
  lastRenderedPath = path;
  // State updates keep scroll; navigating back restores that page's previous position.
  const targetY = changingPage ? (scrollByPath.get(path) ?? 0) : oldScrollY;
  if (changingPage || targetY > 0) window.scrollTo(0, targetY);
}

function resolveView(path, state) {
  if (path === "/") return welcomeView();
  if (path === "/login") return loginView();
  if (path === "/signup") return signupView();

  if (path.startsWith("/tenant")) {
    if (!state.session) return redirectMarkup("/login");
    const detail = path.match(/^\/tenant\/room\/(\d+)$/);
    if (detail) return roomDetailView(state, detail[1]);
    if (path === "/tenant/saved") return tenantSavedView(state);
    if (path === "/tenant/schedule") return tenantScheduleView(state);
    if (path === "/tenant/messages") return tenantMessagesView(state);
    if (path === "/tenant/profile") return tenantProfileView(state);
    return tenantHomeView(state);
  }

  if (path.startsWith("/landlord")) {
    if (!state.session) return redirectMarkup("/login");
    if (path === "/landlord/rooms") return landlordRoomsView(state);
    if (path === "/landlord/finance") return landlordFinanceView(state);
    if (path === "/landlord/tickets") return landlordTicketsView(state);
    if (path === "/landlord/profile") return landlordProfileView(state);
    return landlordDashboardView(state);
  }

  return redirectMarkup("/");
}

function redirectMarkup(path) {
  queueMicrotask(() => navigate(path, { replace: true }));
  return "";
}

root.addEventListener("click", (event) => {
  const link = event.target.closest("[data-link]");
  if (link) {
    event.preventDefault();
    navigate(link.getAttribute("href"));
    return;
  }

  const save = event.target.closest("[data-save-room]");
  if (save) {
    event.preventDefault();
    event.stopPropagation();
    const id = Number(save.dataset.saveRoom);
    store.update((state) => toggleSaved(state, id));
    return;
  }

  const logout = event.target.closest("[data-logout]");
  if (logout) {
    // Navigate first: resetting state while still on a protected route would
    // queue a stale redirect to /login after we have rendered the welcome page.
    navigate("/", { replace: true });
    store.reset();
    return;
  }

  const switchRole = event.target.closest("[data-switch-role]");
  if (switchRole) {
    const role = switchRole.dataset.switchRole;
    store.update((state) => ({ ...state, role, session: { ...state.session, role } }));
    navigate(role === "landlord" ? "/landlord" : "/tenant");
  }
});

root.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const error = form.querySelector("[data-form-error]");
  if (error) error.textContent = "";

  try {
    if (form.id === "login-form") {
      const data = new FormData(form);
      const identifier = normalizeText(data.get("identifier"), 120);
      const password = String(data.get("password") ?? "");
      const role = data.get("role") === "landlord" ? "landlord" : "tenant";
      if (!(isEmail(identifier) || isPhone(identifier)) || password.length < 6) throw new Error("Kiểm tra email/số điện thoại và mật khẩu.");
      await loginWithBackend({ role, identifier, password });
      store.update((state) => ({ ...state, role, session: { name: "Tài khoản demo", role } }));
      navigate(role === "landlord" ? "/landlord" : "/tenant");
      return;
    }

    if (form.id === "signup-form") {
      const data = new FormData(form);
      const name = normalizeText(data.get("name"), 80);
      const phone = normalizeText(data.get("phone"), 20);
      const email = normalizeText(data.get("email"), 120);
      const password = String(data.get("password") ?? "");
      const role = data.get("role") === "landlord" ? "landlord" : "tenant";
      if (name.length < 2 || !isPhone(phone) || !isEmail(email) || password.length < 8) throw new Error("Thông tin đăng ký chưa hợp lệ.");
      await signUpWithBackend({ role, name, phone, email, password });
      store.update((state) => ({ ...state, role, session: { name, role } }));
      navigate(role === "landlord" ? "/landlord" : "/tenant");
      return;
    }

    if (form.id === "booking-form") {
      const data = new FormData(form);
      const roomId = Number(form.querySelector("[data-room-id]")?.dataset.roomId);
      const date = String(data.get("date") ?? "");
      const time = String(data.get("time") ?? "");
      if (!date || !time || !roomId) throw new Error("Chọn ngày và giờ xem phòng.");
      store.update((state) => addBooking(state, { roomId, date, time }));
      navigate("/tenant/schedule");
    }
  } catch (cause) {
    if (error) error.textContent = cause instanceof Error ? cause.message : "Có lỗi xảy ra.";
  }
});

onRouteChange(render);
store.subscribe(render);
render();
