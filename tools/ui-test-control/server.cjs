#!/usr/bin/env node
'use strict';

/**
 * TrọƠi's local, debug-only UI control desk.
 * Network binding is loopback only. Commands are sent to the debug APK via adb;
 * the shipped release APK provides no command implementation.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const HOST = '127.0.0.1';
const PORT = Number(process.env.TROOI_TEST_PORT || 4177);
const PACKAGE = 'com.trooi.app';
const ACTION = 'com.trooi.app.action.DEBUG_TEST_CONTROL';
const ROOT = __dirname;
const SDK = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT ||
  path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const ADB = path.join(SDK, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const ROUTES = new Set([
  'welcome', 'login', 'signup', 'forgot', 'discovery', 'map', 'listing',
  'favorites', 'messages', 'workspace', 'activity', 'account', 'settings',
  'help', 'context', 'tenant-home', 'tenant-rental', 'tenant-finance',
  'tenant-incidents', 'owner-dashboard', 'owner-properties',
  'owner-finance', 'owner-incidents', 'notifications',
]);
const FIELD_KEYS = Object.freeze({
  identifier: 'identifier', password: 'password', fullName: 'fullName',
  phone: 'phone', email: 'email', listingId: 'listingId',
});

function adb(args, { binary = false, timeout = 18000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(ADB, args, {
      windowsHide: true,
      timeout,
      maxBuffer: 18 * 1024 * 1024,
      encoding: binary ? 'buffer' : 'utf8',
    }, (err, stdout, stderr) => {
      if (err) {
        const message = binary ? String(stderr || err.message) : (stderr || err.message);
        reject(new Error(String(message).slice(0, 500)));
      } else resolve(stdout);
    });
  });
}

async function emulators() {
  const response = await adb(['devices', '-l']);
  return String(response).split(/\r?\n/)
    .filter(line => /^emulator-\d+\s+device(?:\s|$)/.test(line))
    .map(line => line.trim().split(/\s+/)[0]);
}

async function selectedEmulator(candidate) {
  const items = await emulators();
  if (!items.length) throw Object.assign(new Error('Chưa có Emulator được bật. Khởi động thiết bị trong Android Studio trước.'), { status: 409 });
  if (candidate && !items.includes(candidate)) throw Object.assign(new Error('Thiết bị đã chọn không còn kết nối.'), { status: 409 });
  return candidate || items[0];
}

function json(res, status, obj) {
  const data = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(data);
}

function enforceLocalRequest(req) {
  const host = req.headers.host || '';
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) return false;
  const origin = req.headers.origin;
  if (origin && origin !== 'http://' + host) return false;
  return true;
}

async function bodyJson(req) {
  const parts = [];
  let size = 0;
  for await (const part of req) {
    size += part.length;
    if (size > 12000) throw Object.assign(new Error('Payload vượt giới hạn 12 KB.'), { status: 413 });
    parts.push(part);
  }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { throw Object.assign(new Error('JSON không hợp lệ.'), { status: 400 }); }
}

function cleanValue(value, max = 180) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max) {
    throw Object.assign(new Error('Giá trị không hợp lệ hoặc quá dài.'), { status: 400 });
  }
  if (/[\0-\x08\x0b-\x1f\x7f]/.test(value)) {
    throw Object.assign(new Error('Ký tự điều khiển không được chấp nhận.'), { status: 400 });
  }
  return value;
}

async function dispatch(payload) {
  const mode = cleanValue(payload.mode, 16).toLowerCase();
  const route = cleanValue(payload.route, 40).toLowerCase();
  if (mode && mode !== 'mock' && mode !== 'backend') {
    throw Object.assign(new Error('Chế độ phải là mock hoặc backend.'), { status: 400 });
  }
  if (route && !ROUTES.has(route)) throw Object.assign(new Error('Flow không tồn tại.'), { status: 400 });
  if (!mode && !route) throw Object.assign(new Error('Phải chọn một flow hoặc chế độ.'), { status: 400 });
  const serial = await selectedEmulator(cleanValue(payload.device, 32));
  const installed = await adb(['-s', serial, 'shell', 'pm', 'path', PACKAGE]);
  if (!String(installed).includes('package:')) {
    throw Object.assign(new Error('Chưa cài TrọƠi Debug APK trên Emulator. Nhấn Run trong Android Studio trước.'), { status: 409 });
  }

  const args = [
    '-s', serial, 'shell', 'am', 'start',
    '-n', PACKAGE + '/.MainActivity', '-a', ACTION,
  ];
  if (route) args.push('--es', 'trooi_test_route', route);
  if (mode) args.push('--es', 'trooi_test_mode', mode);
  if (payload.fields && (typeof payload.fields !== 'object' || Array.isArray(payload.fields))) {
    throw Object.assign(new Error('Dữ liệu form không hợp lệ.'), { status: 400 });
  }
  for (const [key, extraName] of Object.entries(FIELD_KEYS)) {
    const value = cleanValue(payload.fields?.[key]);
    if (value) {
      // ADB serializes arguments through a device shell. URL-safe base64 avoids
      // word splitting and preserves Vietnamese names, spaces, Unicode and symbols.
      args.push('--es', 'trooi_test_' + extraName + '_b64', Buffer.from(value, 'utf8').toString('base64url'));
    }
  }
  await adb(args, { timeout: 22000 });
  // This is a delivery acknowledgement, not proof that a protected screen opened.
  return { delivered: true, device: serial, route: route || null, mode: mode || null };
}

async function screenshot(device) {
  const serial = await selectedEmulator(device);
  const result = await adb(['-s', serial, 'exec-out', 'screencap', '-p'], { binary: true, timeout: 20000 });
  const buffer = Buffer.isBuffer(result) ? result : Buffer.from(result);
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw Object.assign(new Error('Không lấy được ảnh PNG từ Emulator.'), { status: 502 });
  }
  return buffer;
}

const staticFiles = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
};
const server = http.createServer(async (req, res) => {
  try {
    if (!enforceLocalRequest(req)) return json(res, 403, { error: 'Local requests only.' });
    const url = new URL(req.url, 'http://' + HOST + ':' + PORT);
    if (req.method === 'GET' && staticFiles[url.pathname]) {
      const [file, type] = staticFiles[url.pathname];
      const bytes = fs.readFileSync(path.join(ROOT, file));
      res.writeHead(200, {
        'Content-Type': type, 'Content-Length': bytes.length,
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; connect-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'",
      });
      return res.end(bytes);
    }
    if (req.method === 'GET' && url.pathname === '/api/devices') {
      return json(res, 200, { devices: await emulators() });
    }
    if (req.method === 'GET' && url.pathname === '/api/screenshot') {
      const picture = await screenshot(cleanValue(url.searchParams.get('device'), 32));
      res.writeHead(200, {
        'Content-Type': 'image/png', 'Content-Length': picture.length,
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      });
      return res.end(picture);
    }
    if (req.method === 'POST' && url.pathname === '/api/control') {
      if (req.headers['x-trooi-test-control'] !== 'local-ui') {
        return json(res, 403, { error: 'Missing local UI header.' });
      }
      const result = await dispatch(await bodyJson(req));
      return json(res, 200, result);
    }
    return json(res, 404, { error: 'Not found.' });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || 'Lỗi chưa xác định.' });
  }
});

if (!fs.existsSync(ADB)) {
  console.error('[TrọƠi Control] Cannot find Android SDK adb.exe at ' + ADB);
  console.error('Set ANDROID_HOME to your SDK directory and retry.');
  process.exit(1);
}
server.listen(PORT, HOST, () => {
  console.log('TrọƠi UI Test Control — http://' + HOST + ':' + PORT);
  console.log('Loopback-only · Android Studio Debug APK · Emulator via ADB');
});
