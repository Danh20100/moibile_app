const { test } = require('node:test');
const assert = require('node:assert/strict');
const { args, eligibility } = require('../../scripts/identity/maintain-verified-account.cjs');

test('requires explicit email and known action', () => {
  assert.throws(() => args(['provision']), /one email/);
  assert.throws(() => args(['drop-table', '--email=u@example.com']), /Mode/);
  assert.throws(() => args(['audit', '--email=u@example.com', '--apply']), /read-only/);
  assert.deepEqual(args(['provision', '--email=U@EXAMPLE.COM']), {mode:'provision',email:'u@example.com',apply:false});
});

test('never enables passwords for unverified identities or local demo', () => {
  assert.match(eligibility(null), /no verified/);
  const verified = { verified_at:new Date(), verification_source:'google', google_links:1, local_links:0, password_links:0 };
  assert.equal(eligibility(verified), null);
  assert.match(eligibility({...verified, verified_at:null}), /verification/);
  assert.match(eligibility({...verified, google_links:0}), /principal/);
  assert.match(eligibility({...verified, local_links:1}), /demo/);
  assert.match(eligibility({...verified, password_links:1}), /already|Existing/);
  assert.equal(eligibility({...verified, verification_source:'email_otp', google_links:0}), null);
});
