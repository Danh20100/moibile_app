import { domainToASCII } from 'node:url';
import { IdentityFoundationConflict } from '../../persistence/ports/identity-foundation.repository';

export function normalizeLoginEmail(address: string): string {
  const pieces = address.split('@');
  if (pieces.length !== 2) throw new IdentityFoundationConflict('invalid_email');
  const [local, domain] = pieces as [string, string];
  if (
    !/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(local) ||
    !domain ||
    domain.includes('\\') ||
    /[\s/%?#:@[\]]/.test(domain)
  )
    throw new IdentityFoundationConflict('invalid_email');
  // URL host parsing rewrites numeric hosts; they are not mailbox DNS domains.
  if (/^[0-9]+$/.test(domain.split('.').at(-1) ?? ''))
    throw new IdentityFoundationConflict('invalid_email');
  const ascii = domainToASCII(domain).toLowerCase();
  if (!ascii || !ascii.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)))
    throw new IdentityFoundationConflict('invalid_email');
  return `${local.toLowerCase()}@${ascii}`;
}
