export type OtpChallengePurpose = 'EMAIL_REGISTER' | 'PASSWORD_RESET' | 'EMAIL_CHANGE';
export type OtpChangeStage = 'CURRENT_EMAIL' | 'NEW_EMAIL';

export interface OtpChallengeRecord {
  challengeId: string;
  purpose: OtpChallengePurpose;
  destinationAddress: string;
  destinationNormalized: string;
  displayName: string | null;
  pendingPasswordHash: string | null;
  resetUserId: string | null;
  resetEmailRevision: string | null;
  resetCredentialRevision: string | null;
  changeUserId: string | null;
  changeSessionId: string | null;
  changeEmailId: string | null;
  changeEmailRevision: string | null;
  changeStage: OtpChangeStage | null;
  changeTargetAddress: string | null;
  changeTargetNormalized: string | null;
  codeHmac: string;
  createdAt: string;
  expiresAt: string;
  lastSentAt: string;
  attempts: number;
  maxAttempts: number;
}

export interface OtpChallengeCreateInput {
  challengeId: string;
  purpose: OtpChallengePurpose;
  destinationAddress: string;
  destinationNormalized: string;
  displayName: string | null;
  pendingPasswordHash: string | null;
  resetUserId?: string | null;
  resetEmailRevision?: string | null;
  resetCredentialRevision?: string | null;
  changeUserId?: string | null;
  changeSessionId?: string | null;
  changeEmailId?: string | null;
  changeEmailRevision?: string | null;
  changeStage?: OtpChangeStage | null;
  changeTargetAddress?: string | null;
  changeTargetNormalized?: string | null;
  codeHmac: string;
  createdAt: string;
  expiresAt: string;
  maxAttempts: number;
}

/**
 * Transaction-bound storage for pending email OTP challenges.
 * A challenge is "live" while it is neither consumed nor superseded; at most one live
 * challenge may exist per (purpose, mailbox), enforced by uq_identity_otp_challenges_live.
 */
export interface IdentityOtpRepository {
  // Mailbox match, not exact spelling: a pending 'a.b@gmail.com' blocks 'ab@gmail.com'.
  findLiveByMailbox(
    purpose: OtpChallengePurpose,
    normalizedEmail: string,
  ): Promise<OtpChallengeRecord | null>;
  findLatestByMailbox(
    purpose: OtpChallengePurpose,
    normalizedEmail: string,
  ): Promise<OtpChallengeRecord | null>;
  findLatestLiveEmailChangeByUser(userId: string): Promise<OtpChallengeRecord | null>;
  advanceEmailChangeStage(input: {
    challengeId: string;
    userId: string;
    sessionId: string;
    emailId: string;
    emailRevision: string;
    fromStage: 'CURRENT_EMAIL';
    expectedDestinationNormalized: string;
    targetAddress: string;
    targetNormalized: string;
    codeHmac: string;
    now: string;
  }): Promise<boolean>;
  supersedeById(input: { challengeId: string; now: string }): Promise<void>;
  findLiveById(challengeId: string): Promise<OtpChallengeRecord | null>;
  supersedeLiveByMailbox(input: {
    purpose: OtpChallengePurpose;
    normalizedEmail: string;
    now: string;
  }): Promise<void>;
  createChallenge(input: OtpChallengeCreateInput): Promise<OtpChallengeRecord>;
  // Returns the stored attempt count after the increment so callers can report what is left.
  recordFailedAttempt(challengeId: string): Promise<number>;
  // False when another request consumed the same challenge first.
  consume(input: { challengeId: string; now: string }): Promise<boolean>;
  deleteSettledBefore(cutoff: string): Promise<void>;
}
