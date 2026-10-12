export interface SepayConfig {
  environment: 'sandbox';
  merchantId: string;
  secretKey: string;
  ipnSecretKey: string;
  publicBaseUrl: string;
  handoffSigningKey: string;
}

// Structural checks only. A valid config never enables the contract-blocked channel.
// IPN secret relationship remains unverified; require explicit input, never fallback.
export function loadSepayConfig(env: NodeJS.ProcessEnv): SepayConfig | null {
  if (
    env.SEPAY_ENABLED !== 'true' ||
    env.SEPAY_ENVIRONMENT !== 'sandbox' ||
    env.NODE_ENV === 'production'
  )
    return null;
  const merchantId = env.SEPAY_MERCHANT_ID?.trim() ?? '';
  const secretKey = env.SEPAY_SECRET_KEY ?? '';
  const ipnSecretKey = env.SEPAY_IPN_SECRET_KEY ?? '';
  const handoffSigningKey = env.SEPAY_HANDOFF_SIGNING_KEY ?? '';
  if (
    !merchantId ||
    !secretKey.trim() ||
    !ipnSecretKey.trim() ||
    !handoffSigningKey.trim() ||
    handoffSigningKey === secretKey ||
    handoffSigningKey === ipnSecretKey
  )
    return null;
  try {
    const database = new URL(env.DATABASE_URL ?? '');
    const databaseName = decodeURIComponent(database.pathname.slice(1));
    const origin = new URL(env.SEPAY_PUBLIC_BASE_URL ?? '');
    if (
      !['postgres:', 'postgresql:'].includes(database.protocol) ||
      !(
        databaseName === 'trooi_sandbox' ||
        (env.NODE_ENV === 'test' && databaseName === 'trooi_test')
      ) ||
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
      environment: 'sandbox',
      merchantId,
      secretKey,
      ipnSecretKey,
      publicBaseUrl: origin.origin,
      handoffSigningKey,
    };
  } catch {
    return null;
  }
}
