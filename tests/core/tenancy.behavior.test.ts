import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import { TenancyService } from '../../src/modules/tenancy/services/tenancy.service';
import { readRepoFile } from '../conformance/erd3/support/source';

test('new local Tenancy is draft and owns only the Room relationship', async () => {
  const service = new TenancyService();
  const tenancy = await service.createDraft('room-a');
  assert.equal(tenancy.roomId, 'room-a');
  assert.equal(tenancy.status, 'draft');
  assert.equal('tenantId' in tenancy, false);
  assert.equal('terms' in tenancy, false);
  assert.equal('createdAt' in tenancy, false);
  assert.equal('updatedAt' in tenancy, false);
});

test('Tenancy contract removes embedded tenant and calendar/financial terms', () => {
  const source = readRepoFile('src/modules/tenancy/contracts/index.ts');
  const declaration = source.match(/interface\s+TenancyProfile[\s\S]*?\n}/);
  assert.ok(declaration, 'TenancyProfile declaration must exist');
  assert.doesNotMatch(
    declaration[0],
    /tenantId|\bterms\b|monthlyRent|depositAmount|paymentDueDay|startDate|endDate|createdAt|updatedAt/,
  );
});

test('Tenancy local lifecycle follows the frozen graph', async () => {
  const activePath = new TenancyService();
  const tenancy = await activePath.createDraft('room-a');
  assert.equal((await activePath.activateLocal(tenancy.id, '2026-09-01T00:00:00.000Z')).status, 'active');
  assert.equal((await activePath.startEnding(tenancy.id)).status, 'ending');
  assert.equal((await activePath.resumeActive(tenancy.id)).status, 'active');

  const cancelPath = new TenancyService();
  const draft = await cancelPath.createDraft('room-b');
  assert.equal((await cancelPath.cancel(draft.id)).status, 'cancelled');

  const checkoutPath = new TenancyService();
  const ending = await checkoutPath.createDraft('room-c');
  await checkoutPath.activateLocal(ending.id, '2026-09-01T00:00:00.000Z');
  await checkoutPath.startEnding(ending.id);
  assert.equal(
    (await checkoutPath.completeCheckoutLocal(ending.id, 'MUTUAL', '2026-10-01T00:00:00.000Z')).status,
    'ended',
  );
});

test('ACTIVE cannot jump directly to ENDED', async () => {
  const service = new TenancyService();
  const tenancy = await service.createDraft('room-a');
  await service.activateLocal(tenancy.id, '2026-09-01T00:00:00.000Z');
  await assert.rejects(service.assertTransition(tenancy.id, 'ended'), BadRequestException);
});

test('ENDED and CANCELLED are terminal', async () => {
  const endedService = new TenancyService();
  const ended = await endedService.createDraft('room-ended');
  await endedService.activateLocal(ended.id, '2026-09-01T00:00:00.000Z');
  await endedService.startEnding(ended.id);
  await endedService.completeCheckoutLocal(ended.id, 'TERM_ENDED', '2026-10-01T00:00:00.000Z');
  await assert.rejects(endedService.assertTransition(ended.id, 'active'), BadRequestException);

  const cancelledService = new TenancyService();
  const cancelled = await cancelledService.createDraft('room-cancelled');
  await cancelledService.cancel(cancelled.id);
  await assert.rejects(cancelledService.assertTransition(cancelled.id, 'active'), BadRequestException);
});

test('one non-terminal Tenancy per Room includes ENDING', async () => {
  const service = new TenancyService();
  const first = await service.createDraft('room-a');
  await assert.rejects(service.createDraft('room-a'), BadRequestException);
  await service.activateLocal(first.id, '2026-09-01T00:00:00.000Z');
  await service.startEnding(first.id);
  await assert.rejects(service.createDraft('room-a'), BadRequestException);
});

test('historical terminal Tenancy does not block a later draft', async () => {
  const service = new TenancyService();
  const first = await service.createDraft('room-a');
  await service.cancel(first.id);
  const next = await service.createDraft('room-a');
  assert.equal(next.status, 'draft');
});

test('startedAt is set on first activation and preserved by ENDING to ACTIVE', async () => {
  const service = new TenancyService();
  const tenancy = await service.createDraft('room-a');
  const firstStart = '2026-09-01T00:00:00.000Z';
  await service.activateLocal(tenancy.id, firstStart);
  await service.startEnding(tenancy.id);
  const resumed = await service.resumeActive(tenancy.id);
  assert.equal(resumed.startedAt, firstStart);
});

test('checkout records one frozen neutral end reason only from ENDING', async () => {
  const service = new TenancyService();
  const tenancy = await service.createDraft('room-a');
  assert.equal(tenancy.endReason, undefined);
  await service.activateLocal(tenancy.id, '2026-09-01T00:00:00.000Z');
  await service.startEnding(tenancy.id);

  await assert.rejects(
    service.completeCheckoutLocal(tenancy.id, 'TENANT_AT_FAULT' as never, '2026-10-01T00:00:00.000Z'),
    BadRequestException,
  );
  const ended = await service.completeCheckoutLocal(
    tenancy.id,
    'TENANT_INITIATED',
    '2026-10-01T00:00:00.000Z',
  );
  assert.equal(ended.endReason, 'TENANT_INITIATED');
  assert.equal(ended.endedAt, '2026-10-01T00:00:00.000Z');
});
