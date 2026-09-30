import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import { TenancyNoticeService } from '../../src/modules/tenancy/services/tenancy-notice.service';
import { TenancyParticipantService } from '../../src/modules/tenancy/services/tenancy-participant.service';
import { TenancyTermsService } from '../../src/modules/tenancy/services/tenancy-terms.service';
import { TermsAcknowledgementService } from '../../src/modules/tenancy/services/terms-acknowledgement.service';
import { TenancyService } from '../../src/modules/tenancy/services/tenancy.service';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';
import { readRepoFile } from '../conformance/database-v1/support/source';

async function supportFixture() {
  const transactions = createCoreTestTransactionManager();
  const tenancies = new TenancyService(transactions);
  const tenancy = await tenancies.createDraft('room-a');
  const participants = new TenancyParticipantService(tenancies, transactions);
  const terms = new TenancyTermsService(tenancies, transactions);
  const acknowledgements = new TermsAcknowledgementService(terms, participants, transactions);
  const notices = new TenancyNoticeService(tenancies, transactions);
  return { tenancies, tenancy, participants, terms, acknowledgements, notices };
}

function termsInput(tenancyId: string, version = 1) {
  return {
    tenancyId,
    version,
    rentAmount: '3500000.00',
    agreedDepositRequirement: '3500000.00',
    termStart: '2026-10-01',
    termEnd: '2027-09-30',
    billingDayOrDueDateRule: { day: 5 },
    electricityArrangement: { mode: 'manual' },
    waterArrangement: { mode: 'manual' },
    minimalRentalConditions: { note: 'none' },
    effectiveFromCycleBoundary: '2026-10-01',
  };
}

test('participant may exist without User and roles are PRIMARY or OCCUPANT only', async () => {
  const { tenancy, participants } = await supportFixture();
  const primary = await participants.add({
    tenancyId: tenancy.id,
    role: 'PRIMARY',
    joinedAt: '2026-10-01T00:00:00.000Z',
  });
  assert.equal(primary.userId, undefined);
  assert.equal(primary.role, 'PRIMARY');

  await assert.rejects(
    participants.add({
      tenancyId: tenancy.id,
      role: 'LANDLORD' as never,
      joinedAt: '2026-10-01T00:00:00.000Z',
    }),
    BadRequestException,
  );
});

test('second active PRIMARY rejects while multiple OCCUPANT participants are allowed', async () => {
  const { tenancy, participants } = await supportFixture();
  await participants.add({ tenancyId: tenancy.id, role: 'PRIMARY', joinedAt: '2026-10-01T00:00:00.000Z' });
  await assert.rejects(
    participants.add({ tenancyId: tenancy.id, role: 'PRIMARY', joinedAt: '2026-10-02T00:00:00.000Z' }),
    BadRequestException,
  );
  await participants.add({ tenancyId: tenancy.id, role: 'OCCUPANT', joinedAt: '2026-10-01T00:00:00.000Z' });
  await participants.add({ tenancyId: tenancy.id, role: 'OCCUPANT', joinedAt: '2026-10-02T00:00:00.000Z' });
  assert.equal((await participants.listActiveByTenancyId(tenancy.id)).length, 3);
});

test('OCCUPANT leave writes leftAt while preserving participant identity and history', async () => {
  const { tenancy, participants } = await supportFixture();
  const occupant = await participants.add({
    tenancyId: tenancy.id,
    role: 'OCCUPANT',
    joinedAt: '2026-10-01T00:00:00.000Z',
  });
  const left = await participants.leaveOccupant(occupant.id, '2026-11-01T00:00:00.000Z');
  assert.equal(left.id, occupant.id);
  assert.equal(left.joinedAt, occupant.joinedAt);
  assert.equal(left.leftAt, '2026-11-01T00:00:00.000Z');
  assert.equal((await participants.listActiveByTenancyId(tenancy.id)).length, 0);

  const source = readRepoFile('src/modules/tenancy/services/tenancy-participant.service.ts');
  assert.doesNotMatch(source, /replacePrimary|leavePrimary/i);
});

test('linking a User preserves participant identity and membership history', async () => {
  const { tenancy, participants } = await supportFixture();
  const occupant = await participants.add({
    tenancyId: tenancy.id,
    role: 'OCCUPANT',
    joinedAt: '2026-10-01T00:00:00.000Z',
  });
  const linked = await participants.linkUser(occupant.id, 'user-a');
  assert.equal(linked.id, occupant.id);
  assert.equal(linked.joinedAt, occupant.joinedAt);
  assert.equal(linked.userId, 'user-a');
});

test('activation helper requires exactly one active PRIMARY', async () => {
  const { tenancy, participants } = await supportFixture();
  await assert.rejects(participants.assertExactlyOneActivePrimary(tenancy.id), BadRequestException);
  await participants.add({ tenancyId: tenancy.id, role: 'PRIMARY', joinedAt: '2026-10-01T00:00:00.000Z' });
  await participants.assertExactlyOneActivePrimary(tenancy.id);
});

test('Terms version must be positive and unique but need not be contiguous', async () => {
  const { tenancy, terms } = await supportFixture();
  await assert.rejects(terms.createVersion(termsInput(tenancy.id, 0)), BadRequestException);
  const v1 = await terms.createVersion(termsInput(tenancy.id, 1));
  await assert.rejects(terms.createVersion(termsInput(tenancy.id, 1)), BadRequestException);
  const v3 = await terms.createVersion(termsInput(tenancy.id, 3));
  assert.equal(v1.version, 1);
  assert.equal(v3.version, 3);
});

test('later Terms versions never mutate prior version facts', async () => {
  const { tenancy, terms } = await supportFixture();
  const v1 = await terms.createVersion(termsInput(tenancy.id, 1));
  const changed = { ...termsInput(tenancy.id, 2), rentAmount: '4000000.00' };
  await terms.createVersion(changed);
  const reread = await terms.findById(v1.id);
  assert.equal(reread.rentAmount, '3500000.00');
  assert.equal(reread.version, 1);
});

test('Terms money uses exact numeric(18,2)-compatible strings', async () => {
  const { tenancy, terms } = await supportFixture();
  const max = {
    ...termsInput(tenancy.id, 1),
    rentAmount: '9999999999999999.99',
    agreedDepositRequirement: '0',
  };
  assert.equal((await terms.createVersion(max)).rentAmount, '9999999999999999.99');

  for (const [index, value] of ['-1', '1.234', '10000000000000000', '01.00'].entries()) {
    await assert.rejects(
      terms.createVersion({ ...termsInput(tenancy.id, index + 2), rentAmount: value }),
      BadRequestException,
    );
  }
});

test('Terms validates calendar dates without timezone conversion', async () => {
  const { tenancy, terms } = await supportFixture();
  await assert.rejects(
    terms.createVersion({ ...termsInput(tenancy.id, 1), termStart: '2026-2-01' }),
    BadRequestException,
  );
  await assert.rejects(
    terms.createVersion({ ...termsInput(tenancy.id, 2), termStart: '2026-02-30' }),
    BadRequestException,
  );
  await assert.rejects(
    terms.createVersion({ ...termsInput(tenancy.id, 3), termStart: '2027-01-01', termEnd: '2026-12-31' }),
    BadRequestException,
  );
  await assert.rejects(
    terms.createVersion({ ...termsInput(tenancy.id, 4), effectiveFromCycleBoundary: 'not-a-date' }),
    BadRequestException,
  );
});

test('Terms opaque arrangement objects round-trip defensively', async () => {
  const { tenancy, terms } = await supportFixture();
  const input = termsInput(tenancy.id, 1);
  const created = await terms.createVersion(input);
  (input.billingDayOrDueDateRule as { day: number }).day = 99;
  assert.deepEqual((await terms.findById(created.id)).billingDayOrDueDateRule, { day: 5 });

  const read = await terms.findById(created.id);
  (read.electricityArrangement as { mode: string }).mode = 'changed';
  assert.deepEqual((await terms.findById(created.id)).electricityArrangement, { mode: 'manual' });
});

test('Terms acknowledgement validates same Tenancy and linked User identity', async () => {
  const { tenancy, participants, terms, acknowledgements } = await supportFixture();
  const participant = await participants.add({
    tenancyId: tenancy.id,
    role: 'PRIMARY',
    userId: 'user-a',
    joinedAt: '2026-10-01T00:00:00.000Z',
  });
  const version = await terms.createVersion(termsInput(tenancy.id, 1));
  const ack = await acknowledgements.acknowledge({
    tenancyTermsId: version.id,
    tenancyParticipantId: participant.id,
    userId: 'user-a',
    acknowledgedAt: '2026-10-01T01:00:00.000Z',
  });
  assert.equal(ack.tenancyTermsId, version.id);
  assert.equal(ack.userId, 'user-a');

  await assert.rejects(
    acknowledgements.acknowledge({
      tenancyTermsId: version.id,
      tenancyParticipantId: participant.id,
      userId: 'user-b',
      acknowledgedAt: '2026-10-01T02:00:00.000Z',
    }),
    BadRequestException,
  );
});

test('Terms acknowledgement rejects cross-Tenancy and unlinked participants', async () => {
  const fixture = await supportFixture();
  const otherTenancy = await fixture.tenancies.createDraft('room-b');
  const version = await fixture.terms.createVersion(termsInput(fixture.tenancy.id, 1));
  const otherParticipant = await fixture.participants.add({
    tenancyId: otherTenancy.id,
    role: 'PRIMARY',
    userId: 'user-b',
    joinedAt: '2026-10-01T00:00:00.000Z',
  });
  await assert.rejects(
    fixture.acknowledgements.acknowledge({
      tenancyTermsId: version.id,
      tenancyParticipantId: otherParticipant.id,
      userId: 'user-b',
      acknowledgedAt: '2026-10-01T01:00:00.000Z',
    }),
    BadRequestException,
  );

  const unlinked = await fixture.participants.add({
    tenancyId: fixture.tenancy.id,
    role: 'OCCUPANT',
    joinedAt: '2026-10-01T00:00:00.000Z',
  });
  await assert.rejects(
    fixture.acknowledgements.acknowledge({
      tenancyTermsId: version.id,
      tenancyParticipantId: unlinked.id,
      userId: 'user-a',
      acknowledgedAt: '2026-10-01T01:00:00.000Z',
    }),
    BadRequestException,
  );
});

test('multiple acknowledgement facts are allowed without invented uniqueness', async () => {
  const { tenancy, participants, terms, acknowledgements } = await supportFixture();
  const participant = await participants.add({
    tenancyId: tenancy.id,
    role: 'PRIMARY',
    userId: 'user-a',
    joinedAt: '2026-10-01T00:00:00.000Z',
  });
  const version = await terms.createVersion(termsInput(tenancy.id, 1));
  const input = {
    tenancyTermsId: version.id,
    tenancyParticipantId: participant.id,
    userId: 'user-a',
    acknowledgedAt: '2026-10-01T01:00:00.000Z',
  };
  const first = await acknowledgements.acknowledge(input);
  const second = await acknowledgements.acknowledge({ ...input, acknowledgedAt: '2026-10-01T02:00:00.000Z' });
  assert.notEqual(first.id, second.id);
});

test('Notice type stays opaque and acknowledgement writes user plus timestamp together', async () => {
  const { tenancy, notices } = await supportFixture();
  const notice = await notices.issue({
    tenancyId: tenancy.id,
    noticeType: 'custom-non-renewal-note',
    issuedByUserId: 'user-owner',
    contentOrNote: 'Move-out discussion',
    issuedAt: '2026-10-15T00:00:00.000Z',
  });
  assert.equal(notice.noticeType, 'custom-non-renewal-note');
  assert.equal(notice.acknowledgedAt, undefined);
  assert.equal(notice.acknowledgedByUserId, undefined);

  const acknowledged = await notices.acknowledge(notice.id, 'user-a', '2026-10-16T00:00:00.000Z');
  assert.equal(acknowledged.acknowledgedByUserId, 'user-a');
  assert.equal(acknowledged.acknowledgedAt, '2026-10-16T00:00:00.000Z');
});

test('TenancyNotice contract has no legal-validity claim', () => {
  const source = readRepoFile('src/modules/tenancy/contracts/index.ts');
  const declaration = source.match(/interface\s+TenancyNotice[\s\S]*?\n}/);
  assert.ok(declaration, 'TenancyNotice declaration must exist');
  assert.doesNotMatch(declaration[0], /legal|validity|enforceable|binding/i);
});

test('Tenancy support HTTP/module surface exposes only authorized support commands', () => {
  const controller = readRepoFile('src/modules/tenancy/controllers/tenancy-support.controller.ts');
  const dto = readRepoFile('src/modules/tenancy/dto/index.ts');
  const module = readRepoFile('src/modules/tenancy/tenancy.module.ts');

  for (const segment of ['participants', 'terms', 'acknowledgements', 'notices']) {
    assert.match(controller, new RegExp(segment, 'i'));
  }
  assert.doesNotMatch(controller, /replace[-_ ]?primary|leave[-_ ]?primary/i);
  assert.doesNotMatch(dto, /noticeType[\s\S]{0,160}@IsIn|@IsIn[\s\S]{0,160}noticeType/i);
  for (const service of [
    'TenancyParticipantService',
    'TenancyTermsService',
    'TermsAcknowledgementService',
    'TenancyNoticeService',
  ]) {
    assert.match(module, new RegExp(service));
  }
});
