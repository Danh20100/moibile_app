// Host-side preflight; run: node --env-file=.env scripts/config/check-local.cjs [profile...]
// No credentials, connection strings or API tokens are ever printed.
'use strict';
const { validateFinanceRuntime } = require('./verify-runtime.cjs');

function validateLocalConfig(env, profiles = []) {
  const known = new Set(['local-infra', 'messaging-test', 'sepay-isolated', 'finance-production']);
  const enabled = new Set(profiles);
  for (const profile of enabled) if (!known.has(profile)) {
    throw new Error('Unknown Compose profile: ' + profile);
  }
  for (const field of ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'POSTGRES_TEST_DB']) {
    if (!env[field]?.trim()) throw new Error('Required local database setting is missing: ' + field);
  }
  // MinIO and CompreFace are now default Compose dependencies, not optional profiles.
  for (const field of ['MINIO_ROOT_PASSWORD', 'TROOI_COMPREFACE_DB_PASSWORD']) {
    if (!env[field]?.trim()) throw new Error('Required default Compose secret is missing: ' + field);
  }
  if (env.COMPREFACE_ENABLED === 'true') {
    for (const field of ['COMPREFACE_ORIGIN', 'COMPREFACE_API_KEY']) {
      if (!env[field]?.trim()) throw new Error('Enabled CompreFace setting is missing: ' + field);
    }
  }
  if (enabled.has('local-infra')) {
    if (env.OBJECT_STORAGE_ENABLED === 'true') {
      for (const field of [
        'OBJECT_STORAGE_ENDPOINT', 'OBJECT_STORAGE_REGION', 'OBJECT_STORAGE_BUCKET',
        'OBJECT_STORAGE_ACCESS_KEY', 'OBJECT_STORAGE_SECRET_KEY',
      ]) if (!env[field]?.trim()) throw new Error('Missing object storage setting: ' + field);
    }
  }
  if (enabled.has('messaging-test')) {
    for (const field of ['MESSAGING_DB_PASSWORD', 'MESSAGING_MINIO_PASSWORD']) {
      if (!env[field]?.trim()) throw new Error('Missing messaging test setting: ' + field);
    }
  }
  if (enabled.has('sepay-isolated') && !env.TROOI_STANDALONE_DB_PASSWORD?.trim()) {
    throw new Error('Missing isolated SePay test database password');
  }
  if (enabled.has('finance-production')) {
    const dbUrl = env.SEPAY_FINANCE_DATABASE_URL || '';
    const checked = { ...env, NODE_ENV: 'production', TROOI_DATABASE_MODE: 'external-finance',
      DATABASE_URL: dbUrl };
    validateFinanceRuntime(checked, () => {
      if (!checked.SEPAY_MERCHANT_ID?.trim() ||
          !checked.SEPAY_SECRET_KEY?.trim() ||
          !checked.SEPAY_IPN_SECRET_KEY?.trim() ||
          !checked.SEPAY_HANDOFF_SIGNING_KEY?.trim() ||
          !checked.SEPAY_PUBLIC_BASE_URL?.trim()) return false;
      const base = new URL(checked.SEPAY_PUBLIC_BASE_URL);
      return base.protocol === 'https:' && !base.port &&
        base.pathname === '/' && !base.search && !base.hash &&
        checked.SEPAY_HANDOFF_SIGNING_KEY !== checked.SEPAY_SECRET_KEY &&
        checked.SEPAY_HANDOFF_SIGNING_KEY !== checked.SEPAY_IPN_SECRET_KEY;
    });
  }
}

if (require.main === module) {
  try {
    validateLocalConfig(process.env, process.argv.slice(2));
    process.stdout.write('Configuration preflight PASS (values redacted).\n');
  } catch (error) {
    console.error('Configuration preflight FAIL: ' + error.message);
    process.exitCode = 1;
  }
}

module.exports = { validateLocalConfig };
