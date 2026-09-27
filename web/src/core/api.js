import { config } from "./config.js";

export class BackendNotConfiguredError extends Error {
  constructor() { super("Backend OpenAPI chưa được cấu hình."); }
}

export async function loginWithBackend() {
  if (config.demoMode) return { ok: true };
  throw new BackendNotConfiguredError();
}

export async function signUpWithBackend() {
  if (config.demoMode) return { ok: true };
  throw new BackendNotConfiguredError();
}
