import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import { normalizeLoginEmail } from '../../../common/identity/normalize-login-email';
import {
  EMAIL_SENDER,
  type EmailSender,
} from '../../../persistence/ports/email-sender.port';
import { IdentityFoundationConflict } from '../../../persistence/ports/identity-foundation.repository';
import type {
  OtpChallengePurpose,
  OtpChallengeRecord,
  OtpChangeStage,
} from '../../../persistence/ports/identity-otp.repository';
import type { IdentityEventCode } from '../../../persistence/ports/identity-sessions.repository';
import {
  TRANSACTION_MANAGER,
  type PersistenceRepositories,
  type TransactionManager,
} from '../../../persistence/ports/transaction-manager';
import {
  EMAIL_AUTH_CONFIG,
  OTP_LIFETIME_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_SETTLED_RETENTION_MS,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type EmailAuthConfig,
} from '../email-auth.config';
import type { IdentitySessionResponse } from './identity-session.service';
import { issueSessionForUser } from './email-session-issuer';
import { hashPassword } from './password-hasher';
import { signInMethodsOf } from './sign-in-methods';

export interface EmailOtpChallengeResponse {
  otpChallengeId: string;
  expiresAt: string;
  resendAvailableAt: string;
}

export interface PasswordResetAccepted {
  reset: true;
}

export interface EmailChangeAccepted {
  emailChanged: boolean;
  email: string;
  nextStep?: 'NEW_EMAIL';
  resendAvailableAt?: string;
  oldEmailNoticeSent?: boolean;
}

// Rejections are returned by the transaction callback so audit/counter writes commit.
class OtpRejection {
  constructor(readonly error: HttpException) {}
}

@Injectable()
export class EmailOtpService {
  constructor(
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
    @Inject(EMAIL_SENDER) private readonly mail: EmailSender,
    @Inject(EMAIL_AUTH_CONFIG) private readonly config: EmailAuthConfig,
  ) {}

  async request(input: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<EmailOtpChallengeResponse> {
    this.requireEnabled();
    const normalized = this.parseEmail(input.email, 'INVALID_EMAIL');
    this.assertPassword(input.password);
    const displayName = cleanDisplayName(input.displayName);
    const now = new Date();
    const issued = await this.transactions.run(async ({ repositories }) => {
      const owner = await this.prepareMailbox(repositories, now, normalized);
      if (owner) return { kind: 'conflict' as const, owner };
      return this.replaceLiveChallenge(repositories, {
        purpose: 'EMAIL_REGISTER',
        email: input.email.trim(),
        normalized,
        displayName,
        pendingPasswordHash: null,
        password: input.password,
        now,
      });
    });
    if (issued.kind === 'conflict') {
      await this.recordRejected('email_conflict');
      throw new ConflictException({
        message: 'Email already registered',
        code: 'EMAIL_ALREADY_REGISTERED',
        errors: { signInMethods: signInMethodsOf(issued.owner) },
      });
    }
    if (issued.kind === 'cooldown')
      this.throwCooldown(issued.retryAfterSeconds);
    await this.deliverCode(
      input.email.trim(),
      issued.code,
      'EMAIL_REGISTER',
      normalized,
      issued.challengeId,
    );
    return this.challengeResponse(issued);
  }

  async verify(input: {
    otpChallengeId: string;
    code: string;
  }): Promise<IdentitySessionResponse> {
    this.requireEnabled();
    const now = new Date();
    const nowIso = now.toISOString();
    try {
      return await this.runVerification(async (repositories) => {
        const challenge = await this.requireLiveOtp(repositories, {
          challengeId: input.otpChallengeId,
          code: input.code,
          purpose: 'EMAIL_REGISTER',
          now,
          rejectEvent: 'REGISTRATION_REJECTED',
        });
        const owner = await repositories.identityFoundation.findMailboxOwner(
          challenge.destinationNormalized,
        );
        if (owner) {
          await repositories.identitySessions.appendSecurityEvent({
            eventId: randomUUID(),
            userId: owner.userId,
            sessionId: null,
            eventCode: 'IDENTITY_COLLISION',
            outcome: 'REJECTED',
            occurredAt: nowIso,
            requestMetadata: { reason: 'email_conflict' },
          });
          throw new OtpRejection(
            new ConflictException({
              message: 'Email already registered',
              code: 'EMAIL_ALREADY_REGISTERED',
              errors: { signInMethods: signInMethodsOf(owner) },
            }),
          );
        }
        if (!challenge.pendingPasswordHash)
          throw coded(
            HttpStatus.UNAUTHORIZED,
            'Verification code is invalid or expired',
            'OTP_INVALID',
          );
        const consumed = await repositories.identityOtp.consume({
          challengeId: challenge.challengeId,
          now: nowIso,
        });
        if (!consumed)
          throw coded(
            HttpStatus.UNAUTHORIZED,
            'Verification code is invalid or expired',
            'OTP_INVALID',
          );
        const userId = randomUUID();
        await repositories.identityFoundation.createEmailUserFoundation({
          userId,
          email: {
            address: challenge.destinationAddress,
            normalizedEmail: challenge.destinationNormalized,
            verifiedAt: nowIso,
            verificationSource: 'email_otp',
          },
          displayName: challenge.displayName,
          encodedHash: challenge.pendingPasswordHash,
          now: nowIso,
        });
        const session = await issueSessionForUser(repositories, {
          userId,
          now,
          authenticatedAt: nowIso,
        });
        await repositories.identitySessions.appendSecurityEvent({
          eventId: randomUUID(),
          userId,
          sessionId: session.sessionId,
          eventCode: 'REGISTRATION_SUCCEEDED',
          outcome: 'SUCCESS',
          occurredAt: nowIso,
          requestMetadata: { purpose: 'EMAIL_REGISTER' },
        });
        return session;
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (
        error instanceof IdentityFoundationConflict &&
        error.code === 'email_conflict'
      ) {
        await this.recordRejected('email_conflict');
        throw new ConflictException({
          message: 'Email already registered',
          code: 'EMAIL_ALREADY_REGISTERED',
          errors: { signInMethods: ['google'] },
        });
      }
      throw error;
    }
  }

  async requestPasswordReset(input: {
    email: string;
  }): Promise<EmailOtpChallengeResponse> {
    this.requireEnabled();
    const normalized = this.parseEmail(input.email, 'INVALID_EMAIL');
    const now = new Date();
    const issued = await this.transactions.run(async ({ repositories }) => {
      const owner = await this.prepareMailbox(repositories, now, normalized);
      const resetSnapshot = owner?.hasPassword
        ? await repositories.identityFoundation.findPrimaryLogin(
            owner.normalizedEmail,
          )
        : null;
      const created = await this.replaceLiveChallenge(repositories, {
        resetSnapshot,
        purpose: 'PASSWORD_RESET',
        email: input.email.trim(),
        normalized,
        displayName: null,
        pendingPasswordHash: null,
        now,
      });
      return { ...created, eligible: Boolean(owner?.hasPassword) };
    });
    if (issued.kind === 'cooldown')
      this.throwCooldown(issued.retryAfterSeconds);
    if (issued.eligible) {
      try {
        await this.deliverCode(
          input.email.trim(),
          issued.code,
          'PASSWORD_RESET',
          normalized,
          issued.challengeId,
        );
      } catch (error) {
        // A reset request is accepted uniformly; delivery failure must not reveal an account.
        if (
          !(error instanceof HttpException) ||
          error.getStatus() !== HttpStatus.SERVICE_UNAVAILABLE
        )
          throw error;
      }
    }
    return this.challengeResponse(issued);
  }

  async verifyPasswordReset(input: {
    otpChallengeId: string;
    code: string;
    password: string;
  }): Promise<PasswordResetAccepted> {
    this.requireEnabled();
    this.assertPassword(input.password);
    const now = new Date();
    const nowIso = now.toISOString();
    try {
      await this.runVerification(async (repositories) => {
        const challenge = await this.requireLiveOtp(repositories, {
          challengeId: input.otpChallengeId,
          code: input.code,
          purpose: 'PASSWORD_RESET',
          now,
          rejectEvent: 'AUTHENTICATION_REJECTED',
        });
        const owner = await repositories.identityFoundation.findMailboxOwner(
          challenge.destinationNormalized,
        );
        if (!owner?.hasPassword) {
          await repositories.identityOtp.consume({
            challengeId: challenge.challengeId,
            now: nowIso,
          });
          await repositories.identitySessions.appendSecurityEvent({
            eventId: randomUUID(),
            userId: owner?.userId ?? null,
            sessionId: null,
            eventCode: 'AUTHENTICATION_REJECTED',
            outcome: 'REJECTED',
            occurredAt: nowIso,
            requestMetadata: { reason: 'otp_ineligible' },
          });
          throw new OtpRejection(
            coded(
              HttpStatus.UNAUTHORIZED,
              'Verification code is invalid or expired',
              'OTP_INVALID',
            ),
          );
        }
        const snapshot = await repositories.identityFoundation.findPrimaryLogin(
          owner.normalizedEmail,
        );
        if (
          !snapshot?.credential ||
          snapshot.email.userId !== challenge.resetUserId ||
          snapshot.email.emailRevision !== challenge.resetEmailRevision ||
          snapshot.credential.credentialRevision !==
            challenge.resetCredentialRevision
        ) {
          await repositories.identityOtp.supersedeById({
            challengeId: challenge.challengeId,
            now: new Date().toISOString(),
          });
          await repositories.identitySessions.appendSecurityEvent({
            eventId: randomUUID(),
            userId: null,
            sessionId: null,
            eventCode: 'AUTHENTICATION_REJECTED',
            outcome: 'REJECTED',
            occurredAt: new Date().toISOString(),
            requestMetadata: { reason: 'otp_stale_identity' },
          });
          throw new OtpRejection(
            coded(
              HttpStatus.UNAUTHORIZED,
              'Verification code is invalid or expired',
              'OTP_INVALID',
            ),
          );
        }
        const consumed = await repositories.identityOtp.consume({
          challengeId: challenge.challengeId,
          now: nowIso,
        });
        if (!consumed)
          throw coded(
            HttpStatus.UNAUTHORIZED,
            'Verification code is invalid or expired',
            'OTP_INVALID',
          );
        await repositories.identityFoundation.validateProofSnapshot({
          userId: snapshot.email.userId,
          userEmailId: snapshot.email.userEmailId,
          emailRevision: challenge.resetEmailRevision!,
          credentialRevision: challenge.resetCredentialRevision,
        });
        const encodedHash = await hashPassword(input.password);
        await repositories.identityFoundation.replacePasswordCredential({
          userId: snapshot.email.userId,
          expectedRevision: snapshot.credential.credentialRevision,
          encodedHash,
          kind: 'reset',
          now: nowIso,
        });
        await repositories.identitySessions.revokeAll({
          userId: snapshot.email.userId,
          now: nowIso,
        });
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof IdentityFoundationConflict)
        throw coded(
          HttpStatus.UNAUTHORIZED,
          'Verification code is invalid or expired',
          'OTP_INVALID',
        );
      throw error;
    }
    return { reset: true };
  }

  async requestEmailChange(
    input: { email: string }, userId: string, sessionId: string,
  ): Promise<EmailOtpChallengeResponse> {
    this.requireEnabled();
    if (!userId || !sessionId) throw new UnauthorizedException('Application session is required');
    const targetNormalized = this.parseEmail(input.email, 'INVALID_EMAIL');
    const issued = await this.transactions.run(async ({ repositories }) => {
      const initial = await repositories.identityFoundation.findPrimaryLoginByUserId(userId);
      if (!initial?.credential) throw new ForbiddenException('Set an account password before changing login email');
      await repositories.identityOtp.deleteSettledBefore(
        new Date(Date.now() - OTP_SETTLED_RETENTION_MS).toISOString(),
      );
      await this.lockMailboxes(repositories, [initial.email.normalizedEmail, targetNormalized]);
      const current = await repositories.identityFoundation.findPrimaryLoginByUserId(userId);
      if (!current?.credential || current.email.userEmailId !== initial.email.userEmailId ||
          current.email.emailRevision !== initial.email.emailRevision)
        throw coded(HttpStatus.CONFLICT, 'Account email changed; request a new verification code', 'OTP_STALE');
      const owner = await repositories.identityFoundation.findMailboxOwner(targetNormalized);
      if (owner && owner.userId !== userId) return { kind: 'conflict' as const };
      if (current.email.normalizedEmail === targetNormalized)
        throw coded(HttpStatus.BAD_REQUEST, 'New email must differ from the current email', 'EMAIL_UNCHANGED');

      const live = await repositories.identityOtp.findLatestLiveEmailChangeByUser(userId);
      const now = new Date();
      if (live) {
        const waitMs = Date.parse(live.lastSentAt) + OTP_RESEND_COOLDOWN_MS - now.getTime();
        if (waitMs > 0) return { kind: 'cooldown' as const, retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)) };
        await repositories.identityOtp.supersedeById({ challengeId: live.challengeId, now: now.toISOString() });
      }

      const created = await this.replaceLiveChallenge(repositories, {
        purpose: 'EMAIL_CHANGE',
        email: current.email.address,
        normalized: current.email.normalizedEmail,
        displayName: null,
        pendingPasswordHash: null,
        now,
        changeSnapshot: current,
        changeUserId: userId,
        changeSessionId: sessionId,
        changeStage: 'CURRENT_EMAIL',
        changeTargetAddress: input.email.trim(),
        changeTargetNormalized: targetNormalized,
      });
      if (created.kind === 'cooldown') return created;
      return {
        ...created,
        to: current.email.address,
        normalized: current.email.normalizedEmail,
      };
    });
    if (issued.kind === 'conflict') throw new ConflictException({
      message: 'Email already registered', code: 'EMAIL_ALREADY_REGISTERED',
    });
    if (issued.kind === 'cooldown') this.throwCooldown(issued.retryAfterSeconds);
    await this.deliverCode(
      issued.to, issued.code, 'EMAIL_CHANGE', issued.normalized, issued.challengeId, false, 'CURRENT_EMAIL',
    );
    return this.challengeResponse(issued);
  }

  async verifyEmailChange(
    input: { otpChallengeId: string; code: string }, userId: string, sessionId: string,
  ): Promise<EmailChangeAccepted> {
    this.requireEnabled();
    if (!userId || !sessionId) throw new UnauthorizedException('Application session is required');
    try {
      const outcome = await this.runVerification(async (repositories) => {
        const preview = await repositories.identityOtp.findLiveById(input.otpChallengeId);
        const currentPreview = await repositories.identityFoundation.findPrimaryLoginByUserId(userId);
        await this.lockMailboxes(repositories, [
          ...(preview?.destinationNormalized ? [preview.destinationNormalized] : []),
          ...(preview?.changeTargetNormalized ? [preview.changeTargetNormalized] : []),
          ...(currentPreview?.email.normalizedEmail ? [currentPreview.email.normalizedEmail] : []),
        ]);
        const challenge = await this.requireLiveOtp(repositories, {
          challengeId: input.otpChallengeId, code: input.code, purpose: 'EMAIL_CHANGE',
          now: new Date(), rejectEvent: 'AUTHENTICATION_REJECTED',
        });
        const reject = async (reason: string, error: HttpException): Promise<never> => {
          await repositories.identityOtp.supersedeById({
            challengeId: challenge.challengeId, now: new Date().toISOString(),
          });
          await repositories.identitySessions.appendSecurityEvent({
            eventId: randomUUID(), userId, sessionId, eventCode: 'AUTHENTICATION_REJECTED',
            outcome: 'REJECTED', occurredAt: new Date().toISOString(),
            requestMetadata: { operation: 'email.change', reason },
          });
          throw new OtpRejection(error);
        };
        if (challenge.changeUserId !== userId || challenge.changeSessionId !== sessionId ||
            !challenge.changeEmailId || !challenge.changeEmailRevision ||
            !challenge.changeStage || !challenge.changeTargetAddress || !challenge.changeTargetNormalized)
          return reject('otp_scope_mismatch', coded(HttpStatus.UNAUTHORIZED, 'Verification code is invalid or expired', 'OTP_INVALID'));

        const current = await repositories.identityFoundation.findPrimaryLoginByUserId(userId);
        if (!current?.credential || current.email.userEmailId !== challenge.changeEmailId ||
            current.email.emailRevision !== challenge.changeEmailRevision)
          return reject('email_identity_changed', coded(HttpStatus.UNAUTHORIZED, 'Verification code is invalid or expired', 'OTP_INVALID'));

        const targetAddress = challenge.changeTargetAddress;
        const targetNormalized = challenge.changeTargetNormalized;
        if (challenge.changeStage === 'CURRENT_EMAIL') {
          if (challenge.destinationNormalized !== current.email.normalizedEmail)
            return reject('current_email_mismatch', coded(HttpStatus.UNAUTHORIZED, 'Verification code is invalid or expired', 'OTP_INVALID'));
          const owner = await repositories.identityFoundation.findMailboxOwner(targetNormalized);
          if (owner && owner.userId !== userId)
            return reject('email_conflict', new ConflictException({ message: 'Email already registered', code: 'EMAIL_ALREADY_REGISTERED' }));
          const competing = await repositories.identityOtp.findLiveByMailbox('EMAIL_CHANGE', targetNormalized);
          if (competing && competing.challengeId !== challenge.challengeId)
            return reject('email_change_target_collision', new ConflictException({ message: 'Email change is already pending for this address', code: 'EMAIL_ALREADY_REGISTERED' }));

          const nextCode = generateCodeDifferentFrom(input.code);
          const nowIso = new Date().toISOString();
          const advanced = await repositories.identityOtp.advanceEmailChangeStage({
            challengeId: challenge.challengeId,
            userId,
            sessionId,
            emailId: challenge.changeEmailId,
            emailRevision: challenge.changeEmailRevision,
            fromStage: 'CURRENT_EMAIL',
            expectedDestinationNormalized: challenge.destinationNormalized,
            targetAddress,
            targetNormalized,
            codeHmac: hmacCode(
              this.config.otpHmacSecret,
              otpHmacScope('EMAIL_CHANGE', 'NEW_EMAIL'),
              challenge.challengeId,
              targetNormalized,
              nextCode,
            ),
            now: nowIso,
          });
          if (!advanced)
            return reject('otp_stage_race', coded(HttpStatus.UNAUTHORIZED, 'Verification code is invalid or expired', 'OTP_INVALID'));
          return {
            kind: 'send-new-email' as const,
            challengeId: challenge.challengeId,
            code: nextCode,
            to: targetAddress,
            normalized: targetNormalized,
            sentAt: nowIso,
          };
        }

        if (challenge.changeStage !== 'NEW_EMAIL' ||
            challenge.destinationNormalized !== targetNormalized ||
            challenge.destinationAddress !== targetAddress)
          return reject('new_email_stage_mismatch', coded(HttpStatus.UNAUTHORIZED, 'Verification code is invalid or expired', 'OTP_INVALID'));
        const owner = await repositories.identityFoundation.findMailboxOwner(targetNormalized);
        if (owner && owner.userId !== userId)
          return reject('email_conflict', new ConflictException({ message: 'Email already registered', code: 'EMAIL_ALREADY_REGISTERED' }));

        const nowIso = new Date().toISOString();
        const consumed = await repositories.identityOtp.consume({ challengeId: challenge.challengeId, now: nowIso });
        if (!consumed) throw coded(HttpStatus.UNAUTHORIZED, 'Verification code is invalid or expired', 'OTP_INVALID');
        const updated = await repositories.identityFoundation.replacePrimaryEmail({
          userId,
          expectedEmailId: challenge.changeEmailId,
          expectedEmailRevision: challenge.changeEmailRevision,
          target: {
            address: targetAddress,
            normalizedEmail: targetNormalized,
            verifiedAt: nowIso,
            verificationSource: 'email_otp',
          },
        });
        await repositories.identitySessions.revokeOtherSessions({ userId, exceptSessionId: sessionId, now: nowIso });
        await repositories.identitySessions.appendSecurityEvent({
          eventId: randomUUID(), userId, sessionId, eventCode: 'EMAIL_CHANGED', outcome: 'SUCCESS',
          occurredAt: nowIso,
          requestMetadata: { operation: 'email.change', emailRevision: updated.emailRevision },
        });
        return { kind: 'changed' as const, email: updated.address, oldEmail: current.email.address };
      });

      if (outcome.kind === 'send-new-email') {
        await this.deliverCode(
          outcome.to, outcome.code, 'EMAIL_CHANGE', outcome.normalized,
          outcome.challengeId, false, 'NEW_EMAIL',
        );
        return {
          emailChanged: false,
          email: outcome.to,
          nextStep: 'NEW_EMAIL',
          resendAvailableAt: new Date(Date.parse(outcome.sentAt) + OTP_RESEND_COOLDOWN_MS).toISOString(),
        };
      }

      let oldEmailNoticeSent = true;
      try {
        await this.mail.send(emailChangeNoticeMail(outcome.oldEmail, outcome.email));
      } catch {
        oldEmailNoticeSent = false;
        try {
          await this.transactions.run(({ repositories }) =>
            repositories.identitySessions.appendSecurityEvent({
              eventId: randomUUID(), userId, sessionId, eventCode: 'EMAIL_CHANGE_NOTICE_FAILED',
              outcome: 'REJECTED', occurredAt: new Date().toISOString(),
              requestMetadata: { operation: 'email.change', noticeTo: outcome.oldEmail },
            }),
          );
        } catch { /* Keep the committed email change result visible even if audit storage is unavailable. */ }
      }
      return { emailChanged: true, email: outcome.email, oldEmailNoticeSent };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof IdentityFoundationConflict && error.code === 'email_conflict')
        throw new ConflictException({ message: 'Email already registered', code: 'EMAIL_ALREADY_REGISTERED' });
      if (error instanceof IdentityFoundationConflict && error.code === 'stale_state')
        throw coded(HttpStatus.CONFLICT, 'Account email changed; request a new verification code', 'OTP_STALE');
      throw error;
    }
  }

  private requireEnabled(): void {
    if (!this.config.enabled)
      throw new ServiceUnavailableException({
        message: 'Email authentication is disabled',
        code: 'FEATURE_DISABLED',
      });
  }

  private parseEmail(email: string, invalidCode: 'INVALID_EMAIL'): string {
    try {
      return normalizeLoginEmail(email);
    } catch {
      throw coded(HttpStatus.BAD_REQUEST, 'Email is invalid', invalidCode);
    }
  }

  private assertPassword(password: string): void {
    if (
      password.length < PASSWORD_MIN_LENGTH ||
      password.length > PASSWORD_MAX_LENGTH
    )
      throw coded(
        HttpStatus.BAD_REQUEST,
        'Password does not meet length requirements',
        'INVALID_PASSWORD',
      );
  }

  private async prepareMailbox(
    repositories: PersistenceRepositories,
    now: Date,
    normalized: string,
  ) {
    await repositories.identityOtp.deleteSettledBefore(
      new Date(now.getTime() - OTP_SETTLED_RETENTION_MS).toISOString(),
    );
    await repositories.identityFoundation.lockMailbox(normalized);
    return repositories.identityFoundation.findMailboxOwner(normalized);
  }

  private async lockMailboxes(
    repositories: PersistenceRepositories,
    normalizedAddresses: string[],
  ): Promise<void> {
    for (const address of Array.from(new Set(normalizedAddresses)).sort())
      await repositories.identityFoundation.lockMailbox(address);
  }

  private async replaceLiveChallenge(
    repositories: PersistenceRepositories,
    input: {
      purpose: OtpChallengePurpose;
      email: string;
      normalized: string;
      displayName: string | null;
      pendingPasswordHash: string | null;
      now: Date;
      password?: string;
      resetSnapshot?: Awaited<
        ReturnType<
          PersistenceRepositories['identityFoundation']['findPrimaryLogin']
        >
      >;
      changeSnapshot?: Awaited<
        ReturnType<PersistenceRepositories['identityFoundation']['findPrimaryLoginByUserId']>
      > | null;
      changeUserId?: string;
      changeSessionId?: string;
      changeStage?: OtpChangeStage | null;
      changeTargetAddress?: string | null;
      changeTargetNormalized?: string | null;
    },
  ): Promise<
    | { kind: 'cooldown'; retryAfterSeconds: number }
    | { kind: 'created'; challengeId: string; expiresAt: string; code: string }
  > {
    input.now = new Date();
    const nowIso = input.now.toISOString();
    const live = await repositories.identityOtp.findLatestByMailbox(
      input.purpose,
      input.normalized,
    );
    if (live) {
      const waitMs =
        Date.parse(live.lastSentAt) +
        OTP_RESEND_COOLDOWN_MS -
        input.now.getTime();
      if (waitMs > 0)
        return {
          kind: 'cooldown',
          retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
        };
      await repositories.identityOtp.supersedeLiveByMailbox({
        purpose: input.purpose,
        normalizedEmail: input.normalized,
        now: nowIso,
      });
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const challengeId = randomUUID();
    const expiresAt = new Date(
      input.now.getTime() + OTP_LIFETIME_MS,
    ).toISOString();
    await repositories.identityOtp.createChallenge({
      challengeId,
      purpose: input.purpose,
      destinationAddress: input.email,
      destinationNormalized: input.normalized,
      displayName: input.displayName,
      pendingPasswordHash: input.password
        ? await hashPassword(input.password)
        : input.pendingPasswordHash,
      resetUserId: input.resetSnapshot?.email.userId ?? null,
      resetEmailRevision: input.resetSnapshot?.email.emailRevision ?? null,
      resetCredentialRevision:
        input.resetSnapshot?.credential?.credentialRevision ?? null,
      changeUserId: input.changeUserId ?? null,
      changeSessionId: input.changeSessionId ?? null,
      changeEmailId: input.changeSnapshot?.email.userEmailId ?? null,
      changeEmailRevision: input.changeSnapshot?.email.emailRevision ?? null,
      changeStage: input.changeStage ?? null,
      changeTargetAddress: input.changeTargetAddress ?? null,
      changeTargetNormalized: input.changeTargetNormalized ?? null,
      codeHmac: hmacCode(
        this.config.otpHmacSecret,
        otpHmacScope(input.purpose, input.changeStage),
        challengeId,
        input.normalized,
        code,
      ),
      createdAt: nowIso,
      expiresAt,
      maxAttempts: OTP_MAX_ATTEMPTS,
    });
    return { kind: 'created', challengeId, expiresAt, code };
  }

  private async requireLiveOtp(
    repositories: PersistenceRepositories,
    input: {
      challengeId: string;
      code: string;
      purpose: OtpChallengePurpose;
      now: Date;
      rejectEvent: IdentityEventCode;
    },
  ): Promise<OtpChallengeRecord> {
    if (!/^\d{6}$/.test(input.code))
      throw coded(
        HttpStatus.BAD_REQUEST,
        'Enter the 6-digit code',
        'OTP_INVALID',
      );
    let nowIso = new Date().toISOString();
    const reject = async (
      reason: string,
      error: HttpException,
    ): Promise<never> => {
      await repositories.identitySessions.appendSecurityEvent({
        eventId: randomUUID(),
        userId: null,
        sessionId: null,
        eventCode: input.rejectEvent,
        outcome: 'REJECTED',
        occurredAt: nowIso,
        requestMetadata: { reason },
      });
      throw new OtpRejection(error);
    };
    const preview = await repositories.identityOtp.findLiveById(
      input.challengeId,
    );
    if (!preview || preview.purpose !== input.purpose)
      return reject(
        'otp_missing',
        coded(
          HttpStatus.UNAUTHORIZED,
          'Verification code is invalid or expired',
          'OTP_INVALID',
        ),
      );
    await repositories.identityFoundation.lockMailbox(
      preview.destinationNormalized,
    );
    input.now = new Date();
    nowIso = input.now.toISOString();
    const challenge = await repositories.identityOtp.findLiveById(
      input.challengeId,
    );
    if (!challenge || challenge.purpose !== input.purpose)
      return reject(
        'otp_missing',
        coded(
          HttpStatus.UNAUTHORIZED,
          'Verification code is invalid or expired',
          'OTP_INVALID',
        ),
      );
    if (challenge.purpose === 'EMAIL_CHANGE' &&
        (!challenge.changeStage || !challenge.changeTargetAddress || !challenge.changeTargetNormalized))
      return reject(
        'otp_stage_missing',
        coded(HttpStatus.UNAUTHORIZED, 'Verification code is invalid or expired', 'OTP_INVALID'),
      );
    if (Date.parse(challenge.expiresAt) <= input.now.getTime())
      return reject(
        'otp_expired',
        coded(
          HttpStatus.UNAUTHORIZED,
          'Verification code has expired',
          'OTP_EXPIRED',
        ),
      );
    if (challenge.attempts >= challenge.maxAttempts)
      return reject(
        'otp_attempts',
        coded(
          HttpStatus.UNAUTHORIZED,
          'Too many incorrect codes',
          'OTP_ATTEMPTS_EXCEEDED',
        ),
      );
    const expected = hmacCode(
      this.config.otpHmacSecret,
      otpHmacScope(challenge.purpose, challenge.changeStage),
      challenge.challengeId,
      challenge.destinationNormalized,
      input.code,
    );
    if (!sameDigest(expected, challenge.codeHmac)) {
      const attempts = await repositories.identityOtp.recordFailedAttempt(
        challenge.challengeId,
      );
      return reject(
        'otp_mismatch',
        attempts >= challenge.maxAttempts
          ? coded(
              HttpStatus.UNAUTHORIZED,
              'Too many incorrect codes',
              'OTP_ATTEMPTS_EXCEEDED',
            )
          : coded(
              HttpStatus.UNAUTHORIZED,
              'Verification code is incorrect',
              'OTP_INVALID',
            ),
      );
    }
    return challenge;
  }

  private async deliverCode(
    to: string,
    code: string,
    purpose: OtpChallengePurpose,
    normalized: string,
    challengeId: string,
    change = false,
    changeStage?: OtpChangeStage,
  ): Promise<void> {
    try {
      await this.mail.send(otpMail(to, code, purpose, change, changeStage));
    } catch {
      await this.transactions.run(async ({ repositories }) => {
        await repositories.identityFoundation.lockMailbox(normalized);
        await repositories.identityOtp.supersedeById({
          challengeId,
          now: new Date().toISOString(),
        });
      });
      throw coded(
        HttpStatus.SERVICE_UNAVAILABLE,
        'Verification email could not be delivered',
        'EMAIL_DELIVERY_FAILED',
      );
    }
  }

  private async runVerification<T>(
    work: (repositories: PersistenceRepositories) => Promise<T>,
  ): Promise<T> {
    const result = await this.transactions.run(async ({ repositories }) => {
      try {
        return { value: await work(repositories) };
      } catch (error) {
        if (error instanceof OtpRejection) return { error: error.error };
        throw error;
      }
    });
    if ('error' in result) throw result.error;
    return result.value;
  }

  private throwCooldown(retryAfterSeconds: number): never {
    throw new HttpException(
      {
        message: 'Please wait before requesting another code',
        code: 'OTP_RATE_LIMITED',
        errors: { retryAfterSeconds },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private challengeResponse(issued: {
    challengeId: string;
    expiresAt: string;
  }): EmailOtpChallengeResponse {
    return {
      otpChallengeId: issued.challengeId,
      expiresAt: issued.expiresAt,
      resendAvailableAt: new Date(
        Date.parse(issued.expiresAt) - OTP_LIFETIME_MS + OTP_RESEND_COOLDOWN_MS,
      ).toISOString(),
    };
  }

  private async recordRejected(reason: string): Promise<void> {
    await this.transactions.run(({ repositories }) =>
      repositories.identitySessions.appendSecurityEvent({
        eventId: randomUUID(),
        userId: null,
        sessionId: null,
        eventCode: 'REGISTRATION_REJECTED',
        outcome: 'REJECTED',
        occurredAt: new Date().toISOString(),
        requestMetadata: { reason: reason.slice(0, 48) },
      }),
    );
  }
}

function coded(status: number, message: string, code: string): HttpException {
  const body = { message, code };
  if (status === HttpStatus.BAD_REQUEST) return new BadRequestException(body);
  if (status === HttpStatus.UNAUTHORIZED)
    return new UnauthorizedException(body);
  if (status === HttpStatus.SERVICE_UNAVAILABLE)
    return new ServiceUnavailableException(body);
  return new HttpException(body, status);
}

function hmacCode(
  secret: string,
  scope: string,
  challengeId: string,
  destination: string,
  code: string,
): string {
  return createHmac('sha256', secret)
    .update(`${challengeId}|${scope}|${destination}|${code}`)
    .digest('hex');
}

function otpHmacScope(purpose: OtpChallengePurpose, stage?: OtpChangeStage | null): string {
  if (purpose !== 'EMAIL_CHANGE') return purpose;
  if (!stage) throw new Error('Email change OTP stage is required');
  return `EMAIL_CHANGE:${stage}`;
}

function generateCodeDifferentFrom(previous: string): string {
  let code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  while (code === previous) code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  return code;
}

function emailChangeNoticeMail(oldEmail: string, newEmail: string) {
  const subject = 'Email đăng nhập đã được thay đổi';
  const text = `Email đăng nhập TrọƠi của bạn đã được đổi từ ${oldEmail} sang ${newEmail}. Nếu bạn không thực hiện thay đổi này, hãy liên hệ bộ phận hỗ trợ ngay.`;
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  return {
    to: oldEmail,
    subject,
    text,
    html: `<p>Email đăng nhập TrọƠi của bạn đã được đổi từ <strong>${escape(oldEmail)}</strong> sang <strong>${escape(newEmail)}</strong>.</p><p>Nếu bạn không thực hiện thay đổi này, hãy liên hệ bộ phận hỗ trợ ngay.</p>`,
  };
}

function sameDigest(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function cleanDisplayName(value?: string): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 80 || /\p{Cc}/u.test(trimmed))
    throw coded(
      HttpStatus.BAD_REQUEST,
      'Display name is invalid',
      'INVALID_PROFILE',
    );
  return trimmed;
}

function otpMail(
  to: string,
  code: string,
  purpose: OtpChallengePurpose,
  change = false,
  changeStage?: OtpChangeStage,
) {
  const reset = purpose === 'PASSWORD_RESET' && !change;
  const emailChange = purpose === 'EMAIL_CHANGE';
  const currentEmailStage = emailChange && changeStage === 'CURRENT_EMAIL';
  const subject = change
    ? 'Mã đổi mật khẩu TrọƠi'
    : currentEmailStage
      ? 'Mã xác minh yêu cầu đổi email TrọƠi'
      : emailChange
        ? 'Mã xác minh email đăng nhập TrọƠi'
        : reset
          ? 'Mã đặt lại mật khẩu TrọƠi'
          : 'Mã xác nhận TrọƠi';
  const label = change
    ? 'Mã đổi mật khẩu TrọƠi của bạn là'
    : currentEmailStage
      ? 'Mã xác nhận trên email hiện tại của bạn là'
      : emailChange
        ? 'Mã xác minh email đăng nhập mới của bạn là'
        : reset
          ? 'Mã đặt lại mật khẩu TrọƠi của bạn là'
          : 'Mã xác nhận TrọƠi của bạn là';
  const text =
    `${label} ${code}.\n` +
    `Mã hết hạn sau 5 phút. Không chia sẻ mã này với người khác.`;
  return {
    to,
    subject,
    text,
    html: `<p>${label} <strong>${code}</strong>.</p><p>Mã hết hạn sau 5 phút. Không chia sẻ mã này với người khác.</p>`,
  };
}
