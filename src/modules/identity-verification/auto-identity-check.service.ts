import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { DATABASE_CLIENT } from '../../infrastructure/database/database.tokens';
import type { Database } from '../../infrastructure/database/schema.types';
import {
  CompreFaceVerifier, loadCompreFaceConfig,
} from '../../integrations/compreface/compreface-verifier';

export const AUTO_KYC_CONSENT = 'kyc-auto-v1';
export type AutoCheckState = 'AUTO_CHECK_PASSED' | 'NEEDS_RETRY';
export interface AutoCheckReceipt {
  attemptId: string;
  state: AutoCheckState;
  similarity: number | null;
  reasonCode: string;
  checkedAt: string;
  assurance: 'FACE_SIMILARITY_ONLY';
}
export interface AutoCheckImages {
  frontImageBase64: string;
  backImageBase64: string;
  selfieImageBase64: string;
  consent: boolean;
  consentVersion: string;
}

const MAX_IMAGE_BYTES = 1_500_000;
const MAX_DAILY_ATTEMPTS = 5;
const FACE_MATCH_THRESHOLD = 0.90;
const LOCAL_MVP_FACE_THRESHOLD = 0.38;

/**
 * Optional relaxed face-similarity gate for the private Compose demo only.
 * External/finance environments always retain the original 0.90 threshold.
 * This is NOT verification of ID-document authenticity or liveness.
 */
export function faceMatchThreshold(env: NodeJS.ProcessEnv = {}): number {
  const override = env.TROOI_LOCAL_KYC_FACE_THRESHOLD?.trim();
  if (!override) return FACE_MATCH_THRESHOLD;
  if (
    override !== String(LOCAL_MVP_FACE_THRESHOLD) ||
    env.TROOI_DATABASE_MODE !== 'compose-postgres' ||
    env.TROOI_LOCAL_COMPREFACE_LAB !== 'true' ||
    env.COMPREFACE_ENABLED !== 'true' ||
    env.COMPREFACE_ORIGIN !== 'http://compreface-fe'
  ) {
    throw new ServiceUnavailableException('Local-only KYC threshold override is invalid');
  }
  return LOCAL_MVP_FACE_THRESHOLD;
}

/** A similarity-only outcome; never equivalent to document authenticity or liveness. */
export function autoCheckState(similarity: number, env: NodeJS.ProcessEnv = {}): AutoCheckState {
  if (!Number.isFinite(similarity) || similarity < 0 || similarity > 1) {
    throw new BadRequestException('Invalid face similarity evidence');
  }
  return similarity >= faceMatchThreshold(env) ? 'AUTO_CHECK_PASSED' : 'NEEDS_RETRY';
}

export function decodeKycJpeg(value: unknown): Uint8Array {
  if (typeof value !== 'string' || value.length < 20 ||
    value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new BadRequestException('Invalid or oversized JPEG');
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.byteLength < 100 || bytes.byteLength > MAX_IMAGE_BYTES ||
    bytes[0] !== 0xff || bytes[1] !== 0xd8 ||
    bytes[bytes.byteLength - 2] !== 0xff || bytes[bytes.byteLength - 1] !== 0xd9) {
    throw new BadRequestException('Invalid or oversized JPEG');
  }
  return bytes;
}

@Injectable()
export class AutoIdentityCheckService {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: Kysely<Database>) {}

  async latest(userId: string): Promise<AutoCheckReceipt | null> {
    const rows = await sql<{ attempt_id: string; state: AutoCheckState; similarity: string | null; reason_code: string; checked_at: Date | string }>`
      SELECT attempt_id, state, similarity, reason_code, checked_at
      FROM identity_auto_checks WHERE user_id = ${userId}::uuid
      ORDER BY created_at DESC, attempt_id DESC LIMIT 1
    `.execute(this.database);
    return rows.rows.length ? this.receipt(rows.rows[0]) : null;
  }

  async submit(userId: string, input: AutoCheckImages): Promise<AutoCheckReceipt> {
    if (input.consent !== true || input.consentVersion !== AUTO_KYC_CONSENT) {
      throw new BadRequestException('Explicit KYC processing consent required');
    }
    const front = decodeKycJpeg(input.frontImageBase64);
    // Back image is required for intake completeness, but NOT independently checked for document authenticity.
    decodeKycJpeg(input.backImageBase64);
    const selfie = decodeKycJpeg(input.selfieImageBase64);

    const config = loadCompreFaceConfig(process.env);
    if (!config.enabled) throw new ServiceUnavailableException('Automatic KYC comparison is not configured');

    const attempts = await sql<{ count: string }>`
      SELECT count(*)::text AS count FROM identity_auto_checks
      WHERE user_id = ${userId}::uuid AND created_at >= now() - interval '24 hours'
    `.execute(this.database);
    if (Number(attempts.rows[0]?.count ?? 0) >= MAX_DAILY_ATTEMPTS) {
      throw new HttpException('Daily identity check limit reached', HttpStatus.TOO_MANY_REQUESTS);
    }

    let similarity: number;
    try {
      const match = await new CompreFaceVerifier(config).compare(front, selfie);
      similarity = match.similarity;
    } catch {
      // An unavailable or malformed third-party response NEVER produces a passed check.
      throw new ServiceUnavailableException('Automatic face comparison is unavailable');
    }
    const threshold = faceMatchThreshold(process.env);
    const state = autoCheckState(similarity, process.env);
    const id = randomUUID();
    const reasonCode = state === 'AUTO_CHECK_PASSED'
      ? (threshold === LOCAL_MVP_FACE_THRESHOLD ? 'FACE_SIMILARITY_MATCHED_LOCAL_MVP' : 'FACE_SIMILARITY_MATCHED')
      : 'FACE_SIMILARITY_LOW';
    const row = await this.database.transaction().execute(async (tx) => {
      const locked = await sql`SELECT user_id FROM users WHERE user_id = ${userId}::uuid FOR UPDATE`.execute(tx);
      if (!locked.rows.length) throw new BadRequestException('Authenticated user unavailable');
      const count = await sql<{ count: string }>`
        SELECT count(*)::text AS count FROM identity_auto_checks
        WHERE user_id = ${userId}::uuid AND created_at >= now() - interval '24 hours'
      `.execute(tx);
      if (Number(count.rows[0]?.count ?? 0) >= MAX_DAILY_ATTEMPTS) {
        throw new HttpException('Daily identity check limit reached', HttpStatus.TOO_MANY_REQUESTS);
      }
      const inserted = await sql<{ attempt_id: string; state: AutoCheckState; similarity: string; reason_code: string; checked_at: Date | string }>`
        INSERT INTO identity_auto_checks (attempt_id, user_id, state, similarity, reason_code, consent_version)
        VALUES (${id}::uuid, ${userId}::uuid, ${state}, ${similarity}, ${reasonCode}, ${AUTO_KYC_CONSENT})
        RETURNING attempt_id, state, similarity, reason_code, checked_at
      `.execute(tx);
      return inserted.rows[0];
    });
    return this.receipt(row);
  }

  private receipt(row: { attempt_id: string; state: AutoCheckState; similarity: string | null; reason_code: string; checked_at: Date | string }): AutoCheckReceipt {
    return {
      attemptId: row.attempt_id,
      state: row.state,
      similarity: row.similarity === null ? null : Number(row.similarity),
      reasonCode: row.reason_code,
      checkedAt: new Date(row.checked_at).toISOString(),
      assurance: 'FACE_SIMILARITY_ONLY',
    };
  }
}
