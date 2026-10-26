import type { MailboxOwner } from '../../../persistence/ports/identity-foundation.repository';

export function signInMethodsOf(owner: MailboxOwner): string[] {
  const methods: string[] = [];
  if (owner.hasGoogleIdentity || owner.verificationSource === 'google') methods.push('google');
  if (owner.hasPassword || owner.verificationSource === 'email_otp') methods.push('password');
  return methods.length ? methods : [owner.verificationSource === 'google' ? 'google' : 'password'];
}
