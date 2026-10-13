import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decideManualReview,
  startManualReview,
  submitVerification,
  VerificationTransitionError,
  type ReviewAuthorizationPort,
} from '../../src/modules/identity-verification/domain/manual-verification.workflow';
import { verificationFixture } from '../support/verification-fixtures';

const F = verificationFixture.manual;
const R = F.revisions;
const allow: ReviewAuthorizationPort = {
  canReview: async (reviewer, user) => reviewer === F.reviewer && user === F.draft.subjectUserId,
};
const deny: ReviewAuthorizationPort = { canReview: async () => F.deny };

test('score alone cannot approve identity; only explicit authorized human review can', async () => {
  const submitted = submitVerification(F.draft, R.draft, F.evidence);
  assert.equal(submitted.state, F.states.pending);
  assert.equal(submitted.revision, R.pending);
  const reviewing = await startManualReview(submitted, R.pending, F.reviewer, allow);
  assert.equal(reviewing.state, F.states.reviewing);
  assert.equal(reviewing.revision, R.reviewing);
  const verified = await decideManualReview(
    reviewing,
    R.reviewing,
    F.reviewer,
    F.states.verified,
    allow,
    F.decidedAt,
  );
  assert.equal(verified.state, F.states.verified);
  assert.equal(verified.reviewerId, F.reviewer);
  assert.equal(verified.revision, R.decided);
  assert.equal(submitted.state, F.states.pending);
  await assert.rejects(
    decideManualReview(verified, R.decided, F.reviewer, F.states.verified, allow, F.repeatedAt),
    VerificationTransitionError,
  );
});

test('unauthorized/self reviewer, stale revision, review failure and bypass are all denied', async () => {
  const pending = submitVerification(F.draft, R.draft, F.evidence);
  for (const reviewer of F.unauthorized) {
    await assert.rejects(
      startManualReview(pending, R.pending, reviewer, allow),
      VerificationTransitionError,
    );
  }
  await assert.rejects(
    startManualReview(pending, R.pending, F.reviewer, deny),
    VerificationTransitionError,
  );
  await assert.rejects(
    startManualReview(pending, R.pending, F.reviewer, {
      canReview: async () => F.truthy as unknown as boolean,
    }),
    VerificationTransitionError,
  );
  await assert.rejects(
    startManualReview(pending, R.draft, F.reviewer, allow),
    VerificationTransitionError,
  );
  await assert.rejects(
    decideManualReview(pending, R.pending, F.reviewer, F.states.verified, allow, F.decidedAt),
    VerificationTransitionError,
  );
  await assert.rejects(
    startManualReview(pending, R.pending, F.reviewer, {
      canReview: async () => {
        throw new Error(F.authorizationError);
      },
    }),
    VerificationTransitionError,
  );
});

test('rejections are actual review decisions; invalid score/time and repeated submission denied', async () => {
  assert.throws(
    () => submitVerification(F.draft, R.pending, F.evidence),
    VerificationTransitionError,
  );
  assert.throws(
    () => submitVerification(F.draft, R.draft, { ...F.evidence, similarity: Number(F.nan) }),
    VerificationTransitionError,
  );
  assert.throws(
    () => submitVerification(F.draft, R.draft, { ...F.evidence, similarity: F.badScore }),
    VerificationTransitionError,
  );
  assert.throws(
    () => submitVerification(F.draft, R.draft, { ...F.evidence, comparedAt: F.badDate }),
    VerificationTransitionError,
  );
  const pending = submitVerification(F.draft, R.draft, F.evidence);
  assert.throws(
    () => submitVerification(pending, R.pending, F.evidence),
    VerificationTransitionError,
  );
  const reviewing = await startManualReview(pending, R.pending, F.reviewer, allow);
  const rejected = await decideManualReview(
    reviewing,
    R.reviewing,
    F.reviewer,
    F.states.rejected,
    allow,
    F.decidedAt,
  );
  assert.equal(rejected.state, F.states.rejected);
  await assert.rejects(
    decideManualReview(rejected, R.decided, F.reviewer, F.states.verified, allow, F.repeatedAt),
    VerificationTransitionError,
  );
});
