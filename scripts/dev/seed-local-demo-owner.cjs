/**
 * Explicit opt-in LOCAL ONLY. Never stores plaintext passwords or claims KYC verification.
 * Run with TROOI_LOCAL_DEV_SEED_PASSWORD set in the invoking process.
 */
const crypto = require('node:crypto');
const {Client} = require('pg');
const email = 'trtien520@gmail.com';
const secret = process.env.TROOI_LOCAL_DEV_SEED_PASSWORD;
if (process.env.TROOI_DATABASE_MODE !== 'compose-postgres' ||
    process.env.TROOI_LOCAL_DEMO_AUTH !== 'true' ||
    !secret || secret.length < 8) {
  throw new Error('Local Compose opt-in and a nonempty password required');
}
const target = new URL(process.env.DATABASE_URL);
if (target.hostname !== '127.0.0.1' || target.pathname !== '/tro-oi') {
  throw new Error('Refusing to seed any database except loopback tro-oi');
}
(async () => {
 const client = new Client({connectionString: process.env.DATABASE_URL});
 await client.connect();
 try {
  await client.query('BEGIN');
  const collision=await client.query('SELECT user_id FROM user_emails WHERE normalized_email=$1',[email]);
  if(collision.rowCount) throw new Error('Email already belongs to an actual account; refusing synthetic seed');
  await client.query([
    'CREATE TABLE IF NOT EXISTS local_dev_accounts (',
    'user_id uuid PRIMARY KEY REFERENCES users(user_id),',
    'email_label text NOT NULL UNIQUE,',
    'password_salt text NOT NULL, password_hash text NOT NULL,',
    "mode text NOT NULL DEFAULT 'LOCAL_DEMO_ONLY' CHECK (mode = 'LOCAL_DEMO_ONLY'),",
    "verification_note text NOT NULL DEFAULT 'SIMULATED: NOT GOOGLE/EMAIL/KYC VERIFIED',",
    'created_at timestamptz NOT NULL DEFAULT now())'
  ].join(' '));
  const existing=await client.query('SELECT user_id FROM local_dev_accounts WHERE email_label=$1',[email]);
  const userId=existing.rows[0]?.user_id ?? crypto.randomUUID();
  const salt=crypto.randomBytes(16);
  const hash=crypto.scryptSync(secret,salt,32,{N:16384,r:8,p:1});
  if(!existing.rowCount){
    await client.query('INSERT INTO users(user_id) VALUES($1)',[userId]);
    await client.query(
      'INSERT INTO user_profiles(user_id,display_name,created_at,updated_at) VALUES($1,$2,now(),now())',
      [userId,'Tran Tien']
    );
    await client.query(
      'INSERT INTO organizations(organization_id,primary_owner_user_id,name) VALUES($1,$2,$3)',
      [crypto.randomUUID(),userId,'Không gian chủ trọ']
    );
  }
  await client.query([
    'INSERT INTO local_dev_accounts(user_id,email_label,password_salt,password_hash)',
    'VALUES ($1,$2,$3,$4)',
    'ON CONFLICT (email_label) DO UPDATE',
    'SET password_salt=EXCLUDED.password_salt,password_hash=EXCLUDED.password_hash'
  ].join(' '),[userId,email,salt.toString('hex'),hash.toString('hex')]);
  const stats=await client.query([
    'SELECT',
    '(SELECT count(*)::int FROM local_dev_accounts WHERE email_label=$1) AS accounts,',
    '(SELECT count(*)::int FROM organizations WHERE primary_owner_user_id=$2) AS organizations,',
    '(SELECT count(*)::int FROM user_emails WHERE normalized_email=$1) AS fake_verified_emails,',
    '(SELECT count(*)::int FROM identity_auto_checks WHERE user_id=$2) AS fake_kyc'
  ].join(' '),[email,userId]);
  await client.query('COMMIT');
  console.log('LOCAL_DEMO_OWNER_SEEDED=YES');
  console.log('USER_ID='+userId);
  console.log('OWNER_ORGANIZATIONS='+stats.rows[0].organizations);
  console.log('GOOGLE_OR_OTP_VERIFIED_EMAILS='+stats.rows[0].fake_verified_emails);
  console.log('REAL_KYC_RECEIPTS='+stats.rows[0].fake_kyc);
 } catch(e){ await client.query('ROLLBACK');throw e; }
 finally{await client.end();}
})().catch(e=>{console.error('SEED_FAILED='+e.message);process.exitCode=1});
