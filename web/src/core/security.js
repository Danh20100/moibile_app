const entities = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
});

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => entities[char]);
}

export function normalizeText(value, maxLength = 160) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

export function isPhone(value) {
  return /^(0|\+84)\d{9,10}$/.test(String(value ?? "").replace(/[\s.-]/g, ""));
}
