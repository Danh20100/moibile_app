// Read-only verification of local integration test fixtures and checkout.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const origin = 'http://127.0.0.1:3101/api/v1';

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body: body.data ?? body };
}

async function main() {
  const file = path.join(os.tmpdir(), 'trooi-sepay-integration-checkout.json');
  const checkout = JSON.parse(fs.readFileSync(file, 'utf8'));
  const unauth = await request(origin + '/finance/checkouts/' + checkout.checkoutId);
  assert.equal(unauth.status, 401, 'Unauthenticated checkout lookup must fail');
  console.log('UNAUTHENTICATED_CHECKOUT_401=PASS');

  const login = await request(origin + '/demo/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      identifier: 'tenant@trooi.local',
      password: process.env.TROOI_DEMO_PASSWORD || 'TroOiDemo2026!',
    }),
  });
  assert.equal(login.status, 201, 'Demo tenant login failed');
  assert.equal(login.body.userId, 'e0080000-0000-4000-8000-000000000001');
  const bearer = { authorization: 'Bearer ' + login.body.accessToken };
  const identity = await request(origin + '/identity-access/me', { headers: bearer });
  assert.equal(identity.status, 200, 'Identity session lookup failed');
  assert.ok(identity.body.linkedTenancyIds?.includes(checkout.tenancyId),
    'Tenant is not linked to checkout tenancy');
  console.log('TENANT_SESSION_AND_TENANCY=PASS');

  const read = await request(origin + '/finance/checkouts/' + checkout.checkoutId,
    { headers: bearer });
  assert.equal(read.status, 200, 'Checkout read failed');
  assert.equal(read.body.id, checkout.checkoutId);
  assert.equal(read.body.tenancyId, checkout.tenancyId);
  assert.equal(read.body.provider, 'SEPAY');
  assert.equal(read.body.amount, '1000.00');
  assert.notEqual(read.body.status, 'SUCCEEDED', 'No bank payment was authorized');
  assert.ok(read.body.payUrl?.startsWith('https://everly-zincic-corbin.ngrok-free.dev/'));
  console.log('READ_CHECKOUT=PASS');
  console.log('CHECKOUT_STATUS=' + read.body.status);

  const exposed = await request('http://127.0.0.1:3102/api/v1/demo/status');
  assert.equal(exposed.status, 404, 'Public proxy must not expose demo routes');
  console.log('PUBLIC_PROXY_BLOCKS_DEMO=PASS');
}
main().catch(error => {
  console.error('VERIFY_TEST_CHECKOUT_FAILED', error.message);
  process.exitCode = 1;
});
