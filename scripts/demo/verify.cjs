const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { ids } = require('./fixture.cjs');
const base = 'http://localhost:3001/api/v1';
async function request(path, token, body, key) {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  const document = await response.json();
  return { status: response.status, data: document.data ?? document };
}
async function login(identifier) {
  const result = await request('/demo/login', null, { identifier, password: 'TroOi2026!' });
  assert.equal(result.status, 201);
  return result.data.token;
}
async function main() {
  assert.equal((await request('/demo/login', null, { identifier: 'tenant@trooi.local', password: 'wrong' })).status, 401);
  assert.equal((await request('/demo/session', 'forged')).status, 401);
  const tenant = await login('tenant@trooi.local');
  const owner = await login('owner@trooi.local');
  const member = await login('onboarding@trooi.local');
  const session = (await request('/demo/session', tenant)).data;
  assert.deepEqual(session.linkedTenancyIds, [ids.tenancy]);
  assert.deepEqual(session.operatedOrganizationIds, []);
  assert.deepEqual((await request('/demo/session', owner)).data.operatedOrganizationIds, [ids.organization]);
  assert.equal((await request(`/finance/payments?tenancyId=${ids.tenancy}`, member)).status, 403);
  const before = (await request(`/finance/payments?tenancyId=${ids.tenancy}`, tenant)).data;
  assert.equal((await request('/finance/checkouts', tenant, { tenancyId: ids.tenancy, amount: '1000' }, randomUUID())).status, 400);
  assert.equal((await request('/finance/CHECKOUTS', tenant, { tenancyId: ids.tenancy, amount: '1000', provider: 'MOMO' }, randomUUID())).status, 400);
  assert.equal((await request('/finance/checkouts/MOMO/ipn', null, {})).status, 404);
  const key = randomUUID();

  const intent = { tenancyId: ids.tenancy, amount: '1000', provider: 'DEMO' };
  const created = await request('/finance/checkouts', tenant, intent, key);
  if (created.status !== 201) console.error('Checkout diagnostic:', String(created.data.message).match(/(?:column|relation|constraint) ["a-zA-Z0-9_.]+/g) || 'No schema diagnostic');
  assert.equal(created.status, 201);
  const checkout = created.data;
  assert.equal(checkout.provider, 'DEMO');
  assert.equal(checkout.status, 'CREATED');
  assert.ok(!checkout.resultingPaymentId);
  assert.equal(new URL(checkout.payUrl).origin, 'http://localhost:3001');
  assert.equal((await request('/finance/checkouts', tenant, { ...intent, amount: '2000' }, key)).status, 409);
  assert.equal((await request('/finance/checkouts', tenant, { ...intent, provider: 'MOMO' }, key)).status, 400);
  assert.equal((await request(`/finance/checkouts/${checkout.id}`, member)).status, 403);
  const page = await fetch(checkout.payUrl);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Không chuyển tiền thật/);
  assert.equal((await request(`/finance/payments?tenancyId=${ids.tenancy}`, tenant)).data.length, before.length);
  assert.equal((await request(`/finance/checkouts/${checkout.id}`, tenant)).data.status, 'CREATED');
  const confirmUrl = checkout.payUrl + '/success';
  assert.equal((await fetch(confirmUrl, { method: 'POST', headers: { Origin: 'https://forged.example' } })).status, 403);
  const confirmed = await fetch(confirmUrl, { method: 'POST', headers: { Origin: 'http://localhost:3001' } });
  assert.equal(confirmed.status, 200);
  assert.match(await confirmed.text(), /Thanh toán đã được xác nhận/);
  const success = (await request(`/finance/checkouts/${checkout.id}`, tenant)).data;
  assert.equal(success.status, 'SUCCEEDED');
  assert.ok(success.resultingPaymentId);
  assert.equal((await fetch(confirmUrl, { method: 'POST', headers: { Origin: 'http://localhost:3001' } })).status, 200);
  const after = (await request(`/finance/payments?tenancyId=${ids.tenancy}`, tenant)).data;
  assert.equal(after.length, before.length + 1);
  const payment = after.find((entry) => entry.id === success.resultingPaymentId);
  assert.equal(payment.source, 'GATEWAY');
  assert.equal(payment.verification, 'PROVIDER_VERIFIED');
  assert.equal(Number(payment.amount), 1000);
  // Inspect real PostgreSQL through the configured container; never extract its credentials.
  const probe = `const {isolatedDemoDatabaseUrl}=require('/app/scripts/config/verify-runtime.cjs'); try { process.env.DATABASE_URL=isolatedDemoDatabaseUrl(process.env); } catch { process.exit(2); } const {createDatabaseClient}=require('/tmp/trooi-demo/build/infrastructure/database/database.client');const {loadDatabaseConfig}=require('/tmp/trooi-demo/build/infrastructure/database/database.config');const {PostgresTransactionManager}=require('/tmp/trooi-demo/build/infrastructure/database/postgres-transaction-manager');const {createRepositorySet}=require('/tmp/trooi-demo/build/infrastructure/database/repositories/repository-set');const db=createDatabaseClient(loadDatabaseConfig(process.env));const tx=new PostgresTransactionManager(db,createRepositorySet);tx.run(async({repositories:r})=>({allocations:(await r.finance.findPaymentAllocations('${success.resultingPaymentId}')).length,receipts:(await r.finance.findReceiptsForPayment('${success.resultingPaymentId}')).length,depositApplications:(await r.finance.findDepositPaymentApplications('${ids.deposit}')).filter(x=>x.paymentId==='${success.resultingPaymentId}').length})).then(x=>console.log(JSON.stringify(x))).catch(()=>{process.exitCode=1}).finally(()=>db.destroy());`;
  const audit = JSON.parse(execFileSync('docker', ['exec', '-e', 'NODE_PATH=/app/node_modules:/app/node_modules/.pnpm/node_modules', 'trooi-project-backend-1', 'node', '-e', probe], { encoding: 'utf8', windowsHide: true }));
  assert.deepEqual(audit, { allocations: 0, receipts: 0, depositApplications: 0 });
  console.log('Confirmed gateway records in the preserved fixture:', after.filter(entry => entry.source === 'GATEWAY').length);
  console.log('PASS: real PostgreSQL DemoPay checkout, read-only handoff, authorization, amount/provider conflict, signed confirmation, duplicate idempotency, one provider-verified Payment and no automatic allocation/deposit/Receipt');
}
main().catch((error) => { console.error('DemoPay verification failed:', error.code || error.name, error.stack?.split('\n').find(line => line.includes('verify.cjs:')), typeof error.actual === 'number' ? error.actual : '', typeof error.expected === 'number' ? error.expected : ''); process.exitCode = 1; });
