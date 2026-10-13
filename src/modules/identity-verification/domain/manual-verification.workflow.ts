/**
 * Non-persistent verification workflow. CompreFace provides evidence,
 * NEVER authority to mark an identity VERIFIED.
 *
 * Integrators must use atomic revision-checked PostgreSQL updates and an
 * authenticated, policy-backed reviewer authorization implementation.
 */
export type VerificationState = 'DRAFT' | 'PENDING_REVIEW' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED';
export interface ComparisonEvidence {
  readonly similarity: number;
  readonly comparedAt: string;
  readonly provider: 'compreface';
}
export interface VerificationDraft {
  readonly attemptId: string;
  readonly subjectUserId: string;
  readonly state: VerificationState;
  readonly revision: number;
  readonly evidence?: ComparisonEvidence;
  readonly reviewerId?: string;
  readonly decidedAt?: string;
}
export class VerificationTransitionError extends Error {
  constructor() {
    super('Verification state transition denied');
    this.name = 'VerificationTransitionError';
  }
}
export interface ReviewAuthorizationPort {
  /**
   * MUST be backed by authenticated server-side staff policy, never a
   * boolean received from an Android client.
   */
  canReview(reviewerId: string, subjectUserId: string): Promise<boolean>;
}
export function submitVerification(
  draft: VerificationDraft,
  expectedRevision: number,
  evidence: ComparisonEvidence,
): VerificationDraft {
  if (
    draft.state !== 'DRAFT' ||
    expectedRevision !== draft.revision ||
    !Number.isFinite(evidence.similarity) ||
    evidence.similarity < 0 ||
    evidence.similarity > 1 ||
    !Number.isFinite(Date.parse(evidence.comparedAt)) ||
    evidence.provider !== 'compreface'
  ) {
    throw new VerificationTransitionError();
  }
  return {
    ...draft,
    state: 'PENDING_REVIEW',
    revision: draft.revision + 1,
    evidence: { ...evidence },
  };
}
export async function startManualReview(
  draft: VerificationDraft,
  expectedRevision: number,
  reviewerId: string,
  authorization: ReviewAuthorizationPort,
): Promise<VerificationDraft> {
  await requireReviewPermission(draft, expectedRevision, reviewerId, authorization);
  if (draft.state !== 'PENDING_REVIEW' || !draft.evidence) throw new VerificationTransitionError();
  return { ...draft, state: 'IN_REVIEW', revision: draft.revision + 1, reviewerId };
}
export async function decideManualReview(
  draft: VerificationDraft,
  expectedRevision: number,
  reviewerId: string,
  decision: 'VERIFIED' | 'REJECTED',
  authorization: ReviewAuthorizationPort,
  now: string,
): Promise<VerificationDraft> {
  await requireReviewPermission(draft, expectedRevision, reviewerId, authorization);
  if (
    draft.state !== 'IN_REVIEW' ||
    draft.reviewerId !== reviewerId ||
    !draft.evidence ||
    !Number.isFinite(Date.parse(now)) ||
    !['VERIFIED', 'REJECTED'].includes(decision)
  ) {
    throw new VerificationTransitionError();
  }
  return { ...draft, state: decision, revision: draft.revision + 1, decidedAt: now };
}
async function requireReviewPermission(
  draft: VerificationDraft,
  expectedRevision: number,
  reviewerId: string,
  authorization: ReviewAuthorizationPort,
): Promise<void> {
  if (!reviewerId || reviewerId === draft.subjectUserId || expectedRevision !== draft.revision) {
    throw new VerificationTransitionError();
  }
  let permitted: boolean;
  try {
    permitted = await authorization.canReview(reviewerId, draft.subjectUserId);
  } catch {
    throw new VerificationTransitionError();
  }
  // Only an explicit boolean approval from the server-side authorization port is valid.
  if (permitted !== true) throw new VerificationTransitionError();
}
