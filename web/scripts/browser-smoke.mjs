import { spawn } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(check, message, retries = 75) {
  for (let i = 0; i < retries; i++) {
    try { const result = await check(); if (result) return result; } catch {}
    await delay(160);
  }
  throw new Error("Timeout: " + message);
}
const profile = mkdtempSync(join(tmpdir(), "trooi-browser-"));
const web = spawn(process.execPath, ["scripts/dev.mjs"], {
  cwd: process.cwd(), env: { ...process.env, PORT: "45478" }, stdio: "ignore", windowsHide: true
});
const chrome = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
  "--headless=new", "--no-first-run", "--disable-gpu", "--disable-extensions",
  "--remote-allow-origins=*", "--remote-debugging-port=0",
  "--user-data-dir=" + profile, "about:blank"
], { stdio: "ignore", windowsHide: true });
let socket;
let seq = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function js(expression) {
  const result = await send("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
async function until(expression, label) {
  await waitFor(async () => !!(await js(expression)), label);
}
async function run() {
  await waitFor(async () => (await fetch("http://127.0.0.1:45478/")).ok, "web server");
  const port = await waitFor(() => {
    const file = join(profile, "DevToolsActivePort");
    return existsSync(file) ? Number(readFileSync(file, "utf8").split("\n")[0]) : 0;
  }, "Chrome debugging port");
  const target = await waitFor(async () => {
    const tabs = await (await fetch("http://127.0.0.1:" + port + "/json/list")).json();
    return tabs.find((tab) => tab.type === "page" && tab.webSocketDebuggerUrl);
  }, "Chrome tab");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (!pending.has(msg.id)) return;
    const item = pending.get(msg.id); pending.delete(msg.id);
    if (msg.error) item.reject(new Error(msg.error.message));
    else item.resolve(msg.result);
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 480, deviceScaleFactor: 1, mobile: true
  });
  await send("Page.navigate", { url: "http://127.0.0.1:45478/" });
  await until("!!document.querySelector('.welcome-card')", "welcome screen");
  console.log("PASS: welcome");
  await js("document.querySelector('[data-link]').click(); true");
  await until("location.pathname === '/login' && !!document.querySelector('#login-form')", "login form");
  await js([
    "const f=document.querySelector('#login-form');",
    "f.elements.role.value='tenant';",
    "f.elements.identifier.value='demo@example.com';",
    "f.elements.password.value='123456';",
    "f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));",
    "true"
  ].join(""));
  await until("location.pathname === '/tenant' && document.querySelectorAll('.room-card').length >= 1", "tenant login");
  console.log("PASS: tenant login + room list");
  const before = await js("window.scrollTo(0,240); window.scrollY");
  if (before < 10) throw new Error("Tenant page must be scrollable at mobile size");
  await js("document.querySelector('.heart').click(); true");
  await until("!!document.querySelector('.heart.saved')", "save room");
  const after = await js("window.scrollY");
  if (Math.abs(before - after) > 10) throw new Error("Scroll jumped after saving a room");
  console.log("PASS: scroll stays after save");
  const detailPath = await js("document.querySelector('.room-hit-area').getAttribute('href')");
  await js("document.querySelector('.room-hit-area').click(); true");
  await until("location.pathname === " + JSON.stringify(detailPath) + " && !!document.querySelector('#booking-form')", "room detail");
  console.log("PASS: room detail navigation");
  await js([
    "const booking=document.querySelector('#booking-form');",
    "booking.elements.date.value='2026-10-02';",
    "booking.elements.time.value='09:00';",
    "booking.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));",
    "true"
  ].join(""));
  await until("location.pathname === '/tenant/schedule' && !!document.querySelector('.schedule-card')", "booking schedule");
  console.log("PASS: booking and schedule");
  await js("Array.from(document.querySelectorAll('a')).find(a=>a.getAttribute('href')==='/tenant/profile').click(); true");
  await until("location.pathname === '/tenant/profile' && !!document.querySelector('[data-switch-role]')", "tenant profile");
  await js("document.querySelector('[data-switch-role]').click(); true");
  await until("location.pathname === '/landlord' && !!document.querySelector('.hero-card')", "landlord dashboard");
  console.log("PASS: switch to landlord");
  await js("Array.from(document.querySelectorAll('a')).find(a=>a.getAttribute('href')==='/landlord/rooms').click(); true");
  await until("location.pathname === '/landlord/rooms' && !!document.querySelector('.landlord-room')", "landlord rooms");
  console.log("PASS: landlord room list");
  await js("Array.from(document.querySelectorAll('a')).find(a=>a.getAttribute('href')==='/landlord/profile').click(); true");
  await until("location.pathname === '/landlord/profile'", "landlord profile");
  await js("document.querySelector('[data-switch-role]').click(); true");
  await until("location.pathname === '/tenant' && !!document.querySelector('.room-card')", "switch back to tenant");
  console.log("PASS: switch back to tenant");
}
try {
  await run();
  console.log("BROWSER END-TO-END PASS");
} catch (error) {
  console.error("BROWSER END-TO-END FAIL:", error.message);
  process.exitCode = 1;
} finally {
  if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  chrome.kill();
  web.kill();
  await delay(350);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
