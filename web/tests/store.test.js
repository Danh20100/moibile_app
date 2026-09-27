import test from "node:test";
import assert from "node:assert/strict";
import { addBooking, createInitialState, toggleSaved } from "../src/core/store.js";
import { escapeHtml, isEmail, isPhone } from "../src/core/security.js";

test("toggleSaved toggles a room id without duplicates", () => {
  const state = { ...createInitialState({ demoMode: true }), savedIds: [1] };
  assert.deepEqual(toggleSaved(state, 1).savedIds, []);
  assert.deepEqual(toggleSaved(state, 2).savedIds.sort(), [1, 2]);
});

test("addBooking creates a pending booking", () => {
  const state = createInitialState({ demoMode: true });
  const next = addBooking(state, { roomId: 1, date: "2026-10-01", time: "10:30" });
  assert.equal(next.bookings[0].roomId, 1);
  assert.equal(next.bookings[0].status, "pending");
});

test("input helpers validate and escape user content", () => {
  assert.equal(isEmail("user@example.com"), true);
  assert.equal(isPhone("0901234567"), true);
  assert.equal(escapeHtml("<script>"), "&lt;script&gt;");
});
