export type GoogleIdentityErrorCode =
  'CONFIGURATION_ERROR' | 'INVALID_TOKEN' | 'INVALID_PAYLOAD' | 'PROVIDER_ERROR';

export class GoogleIdentityVerificationError extends Error {
  constructor(
    public readonly code: GoogleIdentityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleIdentityVerificationError';
  }
}
