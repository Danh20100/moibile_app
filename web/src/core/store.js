import { demoLandlord, demoRooms } from "../data/demo.js";

const STORAGE_KEY = "trooi.preview.state.v1";

export function createInitialState({ demoMode }) {
  return {
    session: null,
    role: "tenant",
    rooms: demoMode ? demoRooms.map((room) => ({ ...room })) : [],
    savedIds: demoMode ? [1, 2] : [],
    bookings: [],
    conversations: [],
    landlord: demoMode ? { ...demoLandlord } : null,
    notice: ""
  };
}

export function createStore(options) {
  let state = restore(options) ?? createInitialState(options);
  const listeners = new Set();

  const emit = () => listeners.forEach((listener) => listener(state));
  const persist = () => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* non-fatal */ }
  };

  return {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    update(updater) {
      const next = typeof updater === "function" ? updater(state) : updater;
      state = next;
      persist();
      emit();
    },
    reset() {
      state = createInitialState(options);
      persist();
      emit();
    }
  };
}

function restore(options) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return { ...createInitialState(options), ...parsed };
  } catch {
    return null;
  }
}

export function toggleSaved(state, roomId) {
  const saved = new Set(state.savedIds);
  if (saved.has(roomId)) saved.delete(roomId); else saved.add(roomId);
  return { ...state, savedIds: [...saved] };
}

export function addBooking(state, { roomId, date, time }) {
  const id = Date.now();
  return {
    ...state,
    bookings: [{ id, roomId, date, time, status: "pending" }, ...state.bookings],
    notice: "Đã gửi yêu cầu xem phòng."
  };
}
