import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readProperties(path) {
  if (!existsSync(path)) return {};
  const result = {};
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    result[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^["']|["']$/g, '');
  }
  return result;
}

function safeHttpsOrigin(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const local = host === 'localhost' || host === '127.0.0.1' || host === '10.0.2.2' ||
      host === '::1' || host.endsWith('.localhost') || host.endsWith('.invalid') ||
      host === 'example.com' || host.startsWith('192.168.') || host.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    return url.protocol === 'https:' && !local && !url.username && !url.password && !url.hash && !url.search;
  } catch {
    return false;
  }
}

function run() {
  const env = { ...readProperties(resolve('.env')), ...process.env };
  const signing = readProperties(resolve('keystore.properties'));
  const checks = [
    ['PostgreSQL tro-oi', env.POSTGRES_DB === 'tro-oi' && env.POSTGRES_TEST_DB === 'tro-oi' &&
      Boolean(env.POSTGRES_USER?.trim()) && Boolean(env.POSTGRES_PASSWORD?.trim())],
    ['Google Web OAuth Client ID', /^[^\s@]+\.apps\.googleusercontent\.com$/.test(env.GOOGLE_CLIENT_ID || '')],
    ['Android/backend use the same Google audience',
      !env.TROOI_GOOGLE_WEB_CLIENT_ID || env.TROOI_GOOGLE_WEB_CLIENT_ID === env.GOOGLE_CLIENT_ID],
    ['Real Google Identity session enabled after cutover', env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED === 'true'],
    ['Release backend URL is HTTPS and not local', safeHttpsOrigin(env.TROOI_API_BASE_URL)],
    ['Release signing configuration', Boolean(
      signing.storeFile && signing.keyAlias && signing.storePassword &&
      signing.keyPassword && signing.storePassword !== 'CHANGE_ME' &&
      signing.keyPassword !== 'CHANGE_ME' && existsSync(resolve(signing.storeFile))
    )],
    ['No demo backend or payment enabled', !['TROOI_DEMO_BACKEND_ENABLED', 'DEMO_PAYMENT_ENABLED',
      'TROOI_DEMO_MVP_ENABLED', 'TROOI_SEPAY_PAYMENT_FIXTURE'].some(key => env[key] === 'true')],
    ['Payment origin, if set, must use real HTTPS', !env.TROOI_RELEASE_PAYMENT_PUBLIC_ORIGIN ||
      safeHttpsOrigin(env.TROOI_RELEASE_PAYMENT_PUBLIC_ORIGIN)],
  ];
  for (const [name, passed] of checks) {
    process.stdout.write(`${passed ? 'PASS' : 'BLOCKED'}  ${name}\n`);
  }
  const blocked = checks.filter(([, passed]) => !passed).length;
  const paymentEnabled = env.SEPAY_ENABLED === 'true';
  process.stdout.write(`PAYMENT  SePay ${paymentEnabled ? 'requested; review IPN/finance security independently' : 'disabled (not Release-ready for real checkout)'}\n`);
  process.stdout.write('NOTE     Configuration checks do not prove Google OAuth, backend reachability, APK signing identity or live payment settlement.\n');
  if (blocked) {
    process.stderr.write(`Release preflight BLOCKED: ${blocked} requirement(s) remain.\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('Release config preflight PASS; live acceptance still required.\n');
  }
}

run();
