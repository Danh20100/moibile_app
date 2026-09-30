const raw = globalThis.__TROOI_CONFIG__ ?? {};

export const config = Object.freeze({
  demoMode: raw.demoMode === true,
  apiBaseUrl: typeof raw.apiBaseUrl === "string" ? raw.apiBaseUrl.trim() : ""
});
