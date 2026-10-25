// Runtime configuration gate. Never log connection URLs, credentials, or tokens.
'use strict';

function databaseUrlForCompose(env) {
  const user = env.POSTGRES_USER || '';
  const password = env.POSTGRES_PASSWORD || '';
  const name = env.POSTGRES_DB || '';
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(user) ||
      !/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name) ||
      !password.trim()) {
    throw new Error('Missing or invalid local PostgreSQL configuration');
  }
  // Explicit encoding is required: URL.password setter preserves malformed '%' input.
  return 'postgresql://' + encodeURIComponent(user) + ':' + encodeURIComponent(password) +
    '@postgres:5432/' + encodeURIComponent(name);
}

function isolatedDemoDatabaseUrl(env) {
  const raw = env.DATABASE_URL || databaseUrlForCompose(env);
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error('Refusing demo verification outside the isolated compose database'); }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (parsed.hostname !== 'postgres' || name !== 'trooi_dev') {
    throw new Error('Refusing demo verification outside the isolated compose database');
  }
  return raw;
}

function validateFinanceRuntime(env, verifier) {
  if (env.NODE_ENV !== 'production' ||
      env.TROOI_DATABASE_MODE !== 'external-finance' ||
      env.SEPAY_ENABLED !== 'true' ||
      env.SEPAY_ENVIRONMENT !== 'production' ||
      !env.DATABASE_URL ||
      !env.SEPAY_FINANCE_DATABASE) {
    throw new Error('Production finance runtime is not explicitly and safely configured');
  }
  const url = new URL(env.DATABASE_URL);
  const db = decodeURIComponent(url.pathname.slice(1));
  const forbidden = new Set(['postgres', 'template0', 'template1', 'trooi_dev', 'trooi_test', 'trooi_sandbox']);
  if (forbidden.has(db) ||
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      url.username === '' ||
      url.password === '' ||
      db !== env.SEPAY_FINANCE_DATABASE) {
    throw new Error('Finance database is not the explicitly configured database');
  }
  if (!verifier(env)) {
    throw new Error('Production SePay credentials, dedicated database, or HTTPS origin failed validation');
  }
}

if (require.main === module) {
  try {
    if (process.argv[2] === 'compose-database-url') {
      process.stdout.write(databaseUrlForCompose(process.env));
    } else if (process.argv[2] === 'finance') {
      const { loadSepayProductionConfig } = require('../../build/modules/payment-gateway/sepay/sepay-production-config');
      validateFinanceRuntime(process.env, loadSepayProductionConfig);
      process.stdout.write('Finance runtime configuration verified.\n');
    } else {
      throw new Error('Unexpected runtime configuration mode');
    }
  } catch (error) {
    console.error('Runtime configuration rejected: ' + error.message);
    process.exitCode = 1;
  }
}

module.exports = { databaseUrlForCompose, isolatedDemoDatabaseUrl, validateFinanceRuntime };
