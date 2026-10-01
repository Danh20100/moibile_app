import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const port = 45127;
const server = spawn(process.execPath, ["scripts/dev.mjs"], {
  cwd: process.cwd(), env: { ...process.env, PORT: String(port) },
  stdio: "ignore", windowsHide: true,
});
const routes = ["/", "/login", "/tenant", "/landlord"];
try {
  for (const route of routes) {
    let page;
    for (let i = 0; i < 45; i++) {
      try { const res = await fetch(`http://127.0.0.1:${port}${route}`); if (res.ok) { page = await res.text(); break; } }
      catch { /* server boot */ }
      await sleep(150);
    }
    assert.ok(page, `marketing server unavailable on ${route}`);
    assert.match(page, /data-marketing-site/);
    assert.doesNotMatch(page, /src\/app\.js|id="(?:login-form|signup-form|booking-form)"/);
    console.log(`PASS: HTTP marketing ${route}`);
  }
  if (process.env.CHROME_PATH) {
    const profile = mkdtempSync(join(tmpdir(), "trooi-marketing-test-"));
    try {
      const dom = execFileSync(process.env.CHROME_PATH, [
        "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-extensions",
        "--disable-dev-shm-usage",
        "--no-first-run", `--user-data-dir=${profile}`, "--virtual-time-budget=1200",
        "--dump-dom", `http://127.0.0.1:${port}/`,
      ], { timeout: 30000, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      assert.match(dom, /data-marketing-site/);
      console.log("PASS: Chrome rendered marketing page");
    } finally { rmSync(profile, { recursive: true, force: true }); }
  } else {
    console.log("Chrome render NOT RUN (set CHROME_PATH to enable)");
  }
} finally { server.kill(); }
