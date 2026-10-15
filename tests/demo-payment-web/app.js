const els = {
  backendTarget: document.querySelector("#backendTarget"),
  checkoutForm: document.querySelector("#checkoutForm"),
  authToken: document.querySelector("#authToken"),
  tenancyId: document.querySelector("#tenancyId"),
  amount: document.querySelector("#amount"),
  idempotencyKey: document.querySelector("#idempotencyKey"),
  regenKey: document.querySelector("#regenKey"),
  createCheckout: document.querySelector("#createCheckout"),
  createState: document.querySelector("#createState"),
  checkoutStatus: document.querySelector("#checkoutStatus"),
  amountDisplay: document.querySelector("#amountDisplay"),
  referenceDisplay: document.querySelector("#referenceDisplay"),
  checkoutIdDisplay: document.querySelector("#checkoutIdDisplay"),
  openPayment: document.querySelector("#openPayment"),
  refreshStatus: document.querySelector("#refreshStatus"),
  flowHint: document.querySelector("#flowHint"),
  clearLog: document.querySelector("#clearLog"),
  summary: document.querySelector("#summary"),
  responseOutput: document.querySelector("#responseOutput"),
};

const state = {
  checkout: null,
  busy: false,
};

function newIdempotencyKey() {
  return crypto.randomUUID();
}

function setStatus(node, text, kind = "idle") {
  node.textContent = text;
  node.className = `status status-${kind}`;
}

function setSummary(message, kind = "idle") {
  els.summary.textContent = message;
  els.summary.className = `summary summary-${kind}`;
}

function normalizeAuthToken(value) {
  const token = value.trim();
  return token.toLowerCase().startsWith("bearer ") ? token.slice(7).trim() : token;
}

function formatVnd(value) {
  if (!value) return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `${value} VND`;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function redactUrlToken(value) {
  if (typeof value !== "string") return value;
  return value.replace(
    /(\/finance\/checkouts\/demo\/pay\/)[^/?#\s"]+/g,
    "$1<signed-capability-redacted>",
  );
}

function safeForDisplay(value) {
  if (Array.isArray(value)) return value.map(safeForDisplay);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, safeForDisplay(entry)]),
    );
  }
  return redactUrlToken(value);
}

function renderCheckout() {
  const checkout = state.checkout;

  if (!checkout) {
    setStatus(els.createState, "CHƯA TẠO");
    setStatus(els.checkoutStatus, "—");
    els.amountDisplay.textContent = "—";
    els.referenceDisplay.textContent = "—";
    els.checkoutIdDisplay.textContent = "—";
    els.openPayment.disabled = true;
    els.refreshStatus.disabled = true;
    els.flowHint.textContent =
      "Sau khi tạo checkout, nút DemoPay sẽ mở payUrl do backend trả về.";
    return;
  }

  setStatus(els.createState, "ĐÃ TẠO", "created");
  const status = checkout.status ?? "UNKNOWN";
  const statusKind =
    status === "SUCCEEDED"
      ? "success"
      : status === "FAILED" || status === "UNKNOWN"
        ? "failed"
        : "created";

  setStatus(els.checkoutStatus, status, statusKind);
  els.amountDisplay.textContent = formatVnd(checkout.amount);
  els.referenceDisplay.textContent = checkout.referenceCode || "—";
  els.checkoutIdDisplay.textContent = checkout.id || "—";
  els.openPayment.disabled = !checkout.payUrl;
  els.refreshStatus.disabled = !checkout.id;

  if (status === "SUCCEEDED") {
    els.flowHint.textContent =
      "Thanh toán đã được xác nhận. Đây là Payment đã settle; không suy ra Charge đã tất toán.";
  } else if (checkout.payUrl) {
    els.flowHint.textContent =
      "Mở DemoPay, bấm “Xác nhận thanh toán”, quay lại tab này rồi kiểm tra trạng thái.";
  } else {
    els.flowHint.textContent =
      "Checkout chưa có payUrl. Kiểm tra DEMO config hoặc trạng thái provider.";
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { raw: text } : {};
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  const token = normalizeAuthToken(els.authToken.value);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers,
    cache: "no-store",
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function showPayload(payload, message, kind = "ok") {
  els.responseOutput.textContent = pretty(safeForDisplay(payload));
  setSummary(message, kind);
}

async function withBusy(fn) {
  if (state.busy) return;
  state.busy = true;
  els.createCheckout.disabled = true;
  els.refreshStatus.disabled = true;

  try {
    await fn();
  } finally {
    state.busy = false;
    els.createCheckout.disabled = false;
    renderCheckout();
  }
}

async function createCheckout() {
  const tenancyId = els.tenancyId.value.trim();
  const amount = els.amount.value.trim();
  const idempotencyKey = els.idempotencyKey.value.trim();

  if (!tenancyId || !amount || !idempotencyKey) {
    setSummary("Thiếu dữ liệu bắt buộc.", "error");
    return;
  }

  await withBusy(async () => {
    setSummary("Đang tạo DEMO checkout…", "idle");

    try {
      const checkout = await api("/api/v1/finance/checkouts", {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          provider: "DEMO",
          tenancyId,
          amount,
        }),
      });

      state.checkout = checkout;
      showPayload(
        checkout,
        checkout.status === "CREATED"
          ? "Checkout CREATED. Chưa có Payment cho tới khi DemoPay xác nhận."
          : `Backend trả về trạng thái ${checkout.status ?? "UNKNOWN"}.`,
      );
    } catch (error) {
      const payload = error.payload ?? { message: error.message };
      showPayload(payload, `Tạo checkout thất bại (${error.message}).`, "error");
    }
  });
}

async function refreshCheckout() {
  if (!state.checkout?.id) return;

  await withBusy(async () => {
    setSummary("Đang đọc lại checkout…", "idle");

    try {
      const checkout = await api(
        `/api/v1/finance/checkouts/${encodeURIComponent(state.checkout.id)}`,
      );
      state.checkout = checkout;

      showPayload(
        checkout,
        checkout.status === "SUCCEEDED"
          ? "Thanh toán đã được xác nhận."
          : `Checkout hiện ở trạng thái ${checkout.status ?? "UNKNOWN"}.`,
      );
    } catch (error) {
      const payload = error.payload ?? { message: error.message };
      showPayload(payload, `Đọc checkout thất bại (${error.message}).`, "error");
    }
  });
}

function openPaymentPage() {
  const payUrl = state.checkout?.payUrl;
  if (!payUrl) return;

  const opened = window.open(payUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    setSummary("Browser chặn popup. Cho phép popup rồi thử lại.", "error");
  } else {
    setSummary(
      "Đã mở DemoPay ở tab mới. Sau khi xác nhận, quay lại đây và bấm kiểm tra trạng thái.",
      "ok",
    );
  }
}

async function loadServerConfig() {
  try {
    const response = await fetch("/__config", { cache: "no-store" });
    const config = await response.json();
    els.backendTarget.textContent = config.backendBaseUrl;
  } catch {
    els.backendTarget.textContent = "không đọc được config";
  }
}

els.checkoutForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void createCheckout();
});

els.regenKey.addEventListener("click", () => {
  els.idempotencyKey.value = newIdempotencyKey();
});

els.openPayment.addEventListener("click", openPaymentPage);
els.refreshStatus.addEventListener("click", () => void refreshCheckout());

els.clearLog.addEventListener("click", () => {
  els.responseOutput.textContent = "{}";
  setSummary("Đã xóa log hiển thị.", "idle");
});

els.idempotencyKey.value = newIdempotencyKey();
renderCheckout();
void loadServerConfig();
