export interface SepayProductionConfig {
  environment: 'production';
  merchantId: string;
  secretKey: string;
  ipnSecretKey: string;
  publicBaseUrl: string;
  handoffSigningKey: string;
  financeDatabase: string;
}

const blockedDatabases = new Set([
  'postgres',
  'template0',
  'template1',
  'trooi_dev',
  'trooi_sandbox',
  'trooi_test',
]);

// Production credentials enable checkout and the local IPN policy.
// A raw 200 {"success":true} is sent only after REST settlement commits a Payment.
// 401, 400, 503, and 409 are local outcomes, not a published SePay retry contract.
export function loadSepayProductionConfig(env: NodeJS.ProcessEnv): SepayProductionConfig | null {
  if (env.SEPAY_ENABLED !== 'true' || env.SEPAY_ENVIRONMENT !== 'production') return null;
  const merchantId = env.SEPAY_MERCHANT_ID?.trim() ?? '';
  const secretKey = env.SEPAY_SECRET_KEY ?? '';
  const ipnSecretKey = env.SEPAY_IPN_SECRET_KEY ?? '';
  const handoffSigningKey = env.SEPAY_HANDOFF_SIGNING_KEY ?? '';
  const financeDatabase = env.SEPAY_FINANCE_DATABASE?.trim() ?? '';
  if (
    !merchantId ||
    /[\s:/]/.test(merchantId) ||
    merchantId.length > 255 ||
    !secretKey.trim() ||
    !ipnSecretKey.trim() ||
    !handoffSigningKey.trim() ||
    handoffSigningKey === secretKey ||
    handoffSigningKey === ipnSecretKey ||
    !financeDatabase ||
    blockedDatabases.has(financeDatabase)
  )
    return null;
  try {
    const database = new URL(env.DATABASE_URL ?? '');
    const databaseName = decodeURIComponent(database.pathname.slice(1));
    const origin = new URL(env.SEPAY_PUBLIC_BASE_URL ?? '');
    if (
      !['postgres:', 'postgresql:'].includes(database.protocol) ||
      databaseName !== financeDatabase ||
      blockedDatabases.has(databaseName) ||
      origin.protocol !== 'https:' ||
      origin.username ||
      origin.password ||
      origin.port ||
      origin.pathname !== '/' ||
      origin.search ||
      origin.hash
    )
      return null;
    return {
      environment: 'production',
      merchantId,
      secretKey,
      ipnSecretKey,
      publicBaseUrl: origin.origin,
      handoffSigningKey,
      financeDatabase,
    };
  } catch {
    return null;
  }
}
