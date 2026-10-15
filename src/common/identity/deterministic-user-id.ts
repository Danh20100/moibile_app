import { createHash } from 'node:crypto';

// Fixed TrọƠi identity namespace. Changing it would change every derived USER id.
export const TROOI_IDENTITY_NAMESPACE = 'c22d8235-9d37-5d5f-bc4f-1f3bbd0b59a8';

export function googlePrincipalUserId(issuer: string, subject: string): string {
  const namespace = Buffer.from(TROOI_IDENTITY_NAMESPACE.replaceAll('-', ''), 'hex');
  const canonical = `google|${issuer.trim()}|${subject.trim()}`;
  const bytes = Buffer.from(createHash('sha1').update(namespace).update(canonical).digest().subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
