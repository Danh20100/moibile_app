// Creates a SePay checkout intent only. NEVER initiates or confirms a bank transfer.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const outFile = path.join(os.tmpdir(), 'trooi-sepay-integration-checkout.json');
const origin = 'http://127.0.0.1:3101/api/v1';
const tenancyId = 'e0080000-0000-4000-8000-000000000007';

function unwrap(result) { return result && result.data ? result.data : result; }
async function jsonRequest(url, body, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error('HTTP ' + response.status + ': ' +
    JSON.stringify(result).slice(0, 450));
  return unwrap(result);
}

async function main() {
  if (process.env.NODE_ENV === 'production' ||
      process.env.TROOI_SEPAY_PAYMENT_FIXTURE !== 'true' ||
      process.env.SEPAY_ENABLED !== 'true') {
    throw new Error('Only enabled isolated payment fixture is permitted');
  }
  if (fs.existsSync(outFile)) {
    const prior = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    if (prior.checkoutId) {
      console.log('EXISTING_CHECKOUT_ID=' + prior.checkoutId);
      console.log('EXISTING_STATUS=' + prior.status);
      console.log('LOCAL_CHECKOUT_FILE=' + outFile);
      return;
    }
  }
  const session = await jsonRequest(origin + '/demo/login', {
    identifier: 'tenant@trooi.local',
    password: process.env.TROOI_DEMO_PASSWORD || 'TroOiDemo2026!',
  });
  if (!session.accessToken || session.userId !== 'e0080000-0000-4000-8000-000000000001') {
    throw new Error('Unexpected tenant session');
  }
  const checkout = await jsonRequest(origin + '/finance/checkouts',
    { provider: 'SEPAY', tenancyId, amount: '1000' },
    {
      Authorization: 'Bearer ' + session.accessToken,
      'Idempotency-Key': randomUUID(),
    });
  if (checkout.provider !== 'SEPAY' ||
      !/^(1000|1000\.00)$/.test(String(checkout.amount)) ||
      !checkout.id || !checkout.payUrl) {
    throw new Error('Checkout response failed its binding check');
  }
  const url = new URL(checkout.payUrl);
  if (url.origin !== process.env.SEPAY_PUBLIC_BASE_URL ||
      url.pathname !== '/api/v1/finance/checkouts/sepay/handoff') {
    throw new Error('Checkout returned an unexpected pay URL');
  }
  fs.writeFileSync(outFile, JSON.stringify({
    checkoutId: checkout.id,
    tenancyId: checkout.tenancyId,
    amount: checkout.amount,
    provider: checkout.provider,
    status: checkout.status,
    reference: checkout.referenceCode,
    payUrl: checkout.payUrl,
    issuedAt: new Date().toISOString(),
  }, null, 2));
  console.log('CHECKOUT_ID=' + checkout.id);
  console.log('AMOUNT=' + checkout.amount);
  console.log('STATUS=' + checkout.status);
  console.log('PAY_URL_HOST=' + url.host);
  console.log('PAY_URL_PATH=' + url.pathname);
  console.log('LOCAL_CHECKOUT_FILE=' + outFile);
}

main().catch(error => { console.error('CREATE_CHECKOUT_FAILED', error.message); process.exitCode = 1; });
