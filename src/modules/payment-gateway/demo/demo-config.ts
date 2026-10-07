export interface DemoConfig {
  readonly publicBaseUrl: string;
  readonly signingKey: string;
}

export function loadDemoConfig(env: NodeJS.ProcessEnv): DemoConfig | null {
  const base = env.DEMO_PAYMENT_PUBLIC_BASE_URL;
  const signingKey = env.DEMO_PAYMENT_SIGNING_KEY;
  if (
    env.NODE_ENV === 'production' ||
    env.DEMO_PAYMENT_ENABLED !== 'true' ||
    !base ||
    /[\s\\@]/.test(base) ||
    !/^https?:\/\/[^/?#]+\/?$/i.test(base) ||
    !signingKey?.trim() ||
    Buffer.byteLength(signingKey, 'utf8') < 32
  )
    return null;
  try {
    const url = new URL(base);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      (url.protocol !== 'https:' &&
        !(
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '10.0.2.2', '[::1]'].includes(url.hostname)
        ))
    )
      return null;
    return Object.freeze({ publicBaseUrl: url.origin, signingKey });
  } catch {
    return null;
  }
}
