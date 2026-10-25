#!/usr/bin/env node
'use strict';
/**
 * TrọƠi one-time identity maintenance.
 * Run with Node 24+ from repo root (private .env is never committed):
 *   node --env-file=.env scripts/identity/maintain-verified-account.cjs audit --email=user@example.com
 *   node --env-file=.env scripts/identity/maintain-verified-account.cjs provision --email=user@example.com --apply
 *   node --env-file=.env scripts/identity/maintain-verified-account.cjs retire-local --email=user@example.com --apply
 * Defaults to dry run. Never creates verified emails/Google principals or deletes Users.
 */
const { stdin, stdout } = process;
function args(argv) {
  const mode = argv[0];
  const flags = argv.slice(1);
  if (!['audit', 'provision', 'retire-local'].includes(mode)) throw Error('Mode: audit | provision | retire-local');
  if (flags.some(x => x !== '--apply' && !/^--email=[^\s@]+@[^\s@]+$/.test(x))) throw Error('Use --email=user@example.com [--apply]');
  const emails = flags.filter(x => x.startsWith('--email='));
  if (emails.length !== 1 || flags.filter(x => x === '--apply').length > 1) throw Error('Exactly one email and at most one --apply are required');
  if (mode === 'audit' && flags.includes('--apply')) throw Error('Audit is read-only');
  return { mode, email: emails[0].slice(8).toLowerCase(), apply: flags.includes('--apply') };
}
function connection() {
  const raw = process.env.DATABASE_URL;
  const url = new URL(raw || 'postgresql://127.0.0.1');
  if (!raw) {
    if (!process.env.POSTGRES_USER || !process.env.POSTGRES_PASSWORD || !process.env.POSTGRES_DB)
      throw Error('Load the private .env with Node --env-file=.env');
    url.username = process.env.POSTGRES_USER;
    url.password = process.env.POSTGRES_PASSWORD;
    url.port = process.env.POSTGRES_PORT || '5432';
    url.pathname = '/' + process.env.POSTGRES_DB;
  }
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/tro-oi' || !url.username || !url.password)
    throw Error('Refusing unexpected database; expected local loopback tro-oi');
  return url.href;
}
function eligibility(row) {
  if (!row) return 'Email has no verified User identity';
  if (!row.verified_at || !['google','email_otp'].includes(row.verification_source)) return 'No valid verification proof';
  if (row.verification_source === 'google' && Number(row.google_links) === 0) return 'Google principal binding missing';
  if (Number(row.local_links) > 0) return 'Legacy local-demo identity must be migrated before provisioning';
  if (Number(row.password_links) > 0) return 'Existing credential cannot be replaced with this provisioning tool';
  return null;
}
function secretPrompt(label) {
  if (!stdin.isTTY || !stdout.isTTY || !stdin.setRawMode) throw Error('Use an interactive terminal; passwords cannot be passed on CLI or env');
  stdout.write(label);
  const {emitKeypressEvents} = require('node:readline');
  emitKeypressEvents(stdin);
  stdin.setRawMode(true); stdin.resume();
  let secret = '';
  return new Promise((resolve, reject) => {
    const done = (value, bad) => {
      stdin.removeListener('keypress', press);
      stdin.setRawMode(false); stdin.pause(); stdout.write('\n');
      if (bad) reject(Error('Input cancelled')); else resolve(value);
    };
    function press(char, key) {
      if (key?.ctrl && key.name === 'c') return done(null, true);
      if (key?.name === 'enter' || key?.name === 'return') return done(secret, false);
      if (key?.name === 'backspace') { secret = secret.slice(0, -1); return; }
      if (char && char >= ' ' && !key?.ctrl && !key?.meta && secret.length < 128) secret += char;
    }
    stdin.on('keypress', press);
  });
}
async function legacyReferences(db, userId) {
  const refs = await db.query(`
    SELECT c.conrelid::regclass::text AS relation, a.attname AS column
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
    WHERE c.contype='f' AND c.confrelid='public.users'::regclass AND array_length(c.conkey,1)=1
      AND c.conrelid <> 'public.local_dev_accounts'::regclass
      AND c.conrelid <> 'public.user_profiles'::regclass
  `);
  const active = [];
  for (const ref of refs.rows) {
    const table = ref.relation.split('.').map(s => '"' + s.replaceAll('"','""') + '"').join('.');
    const column = '"' + ref.column.replaceAll('"','""') + '"';
    const result = await db.query(`SELECT count(*)::integer AS n FROM ${table} WHERE ${column}=$1`, [userId]);
    if (result.rows[0].n) active.push({ table: ref.relation, count: result.rows[0].n });
  }
  return active;
}
async function main() {
  const { mode, email, apply } = args(process.argv.slice(2));
  const { Client } = require('pg');
  const db = new Client({connectionString: connection()});
  await db.connect();
  let open = false;
  try {
    await db.query('BEGIN'); open = true;
    const table = await db.query("SELECT to_regclass('public.local_dev_accounts') IS NOT NULL AS yes");
    const hasLocal = table.rows[0].yes;
    if (mode === 'audit' || mode === 'retire-local') {
      if (!hasLocal) {
        console.log('LOCAL_DEMO_TABLE=ABSENT');
        if (mode === 'retire-local') return;
      } else {
        const local = await db.query('SELECT user_id FROM local_dev_accounts WHERE lower(email_label)=$1 FOR UPDATE', [email]);
        if (local.rowCount === 0) {
          console.log('LOCAL_DEMO_ACCOUNT=ABSENT');
          if (mode === 'retire-local') return;
        } else {
          const refs = await legacyReferences(db, local.rows[0].user_id);
          console.log('LOCAL_DEMO_ACCOUNT=PRESENT');
          console.log('BUSINESS_AND_AUDIT_LINKS=' + JSON.stringify(refs));
          if (mode === 'retire-local') {
            if (refs.length) throw Error('BLOCKED: User still owns data, sessions or audit history; migrate it first');
            if (!apply) { console.log('DRY_RUN=YES; no database writes'); return; }
            const deleted = await db.query('DELETE FROM local_dev_accounts WHERE user_id=$1', [local.rows[0].user_id]);
            if (deleted.rowCount !== 1) throw Error('Concurrent update, rolled back');
            await db.query('COMMIT'); open = false;
            console.log('LOCAL_DEMO_MARKER_REMOVED=YES; User and business data retained');
            return;
          }
        }
      }
    }
    const verified = await db.query(`
      SELECT e.user_id,e.verified_at,e.verification_source,
      (SELECT count(*)::integer FROM auth_identities a WHERE a.user_id=e.user_id AND a.provider='google') AS google_links,
      (SELECT count(*)::integer FROM password_credentials p WHERE p.user_id=e.user_id) AS password_links
      FROM user_emails e WHERE e.normalized_email=$1 FOR UPDATE OF e
    `,[email]);
    const row = verified.rows[0];
    if (row) {
      const local = hasLocal ? await db.query('SELECT count(*)::integer AS n FROM local_dev_accounts WHERE user_id=$1',[row.user_id]) : {rows:[{n:0}]};
      row.local_links = local.rows[0].n;
    }
    const reason = eligibility(row);
    console.log('VERIFIED_CREDENTIAL_ELIGIBILITY=' + (reason || 'PASS'));
    if (mode === 'audit') return;
    if (reason) throw Error('BLOCKED: ' + reason);
    if (!apply) { console.log('DRY_RUN=YES; rerun with --apply'); return; }
    const password = await secretPrompt('New password (hidden): ');
    const confirmation = await secretPrompt('Confirm password (hidden): ');
    if (password !== confirmation || password.length < 12 || password.length > 128) throw Error('Password mismatch or outside 12–128 characters');
    const { hash } = require('@node-rs/argon2');
    const encoded = await hash(password,{algorithm:2,memoryCost:19456,timeCost:2,parallelism:1});
    const inserted = await db.query(`
      INSERT INTO password_credentials (user_id,password_hash,credential_revision,created_at,password_changed_at)
      VALUES ($1,$2,1,now(),now()) ON CONFLICT (user_id) DO NOTHING RETURNING user_id
    `,[row.user_id,encoded]);
    if (inserted.rowCount !== 1) throw Error('Credential was modified concurrently, rolled back');
    await db.query('COMMIT'); open = false;
    console.log('VERIFIED_PASSWORD_CREATED=YES; no new User, email verification or KYC assertions');
  } finally {
    if (open) await db.query('ROLLBACK').catch(()=>{});
    await db.end();
  }
}
if (require.main === module) main().catch(e => { console.error('IDENTITY_ACTION_BLOCKED=' + (e?.message || 'Unknown failure')); process.exitCode=1; });
module.exports = { args, eligibility };
