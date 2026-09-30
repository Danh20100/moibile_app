import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateBillingCycleDto } from '../../../src/modules/billing/dto';
import { CreateRoomDto } from '../../../src/modules/room/dto';

describe('request and business boundary validation audit', () => {
  it('rejects an empty room label at the DTO boundary', async () => {
    const dto = plainToInstance(CreateRoomDto, {
      propertyId: 'prop_1',
      nameOrLabel: '',
    });

    const errors = await validate(dto);
    assert.ok(errors.some((error) => error.property === 'nameOrLabel'));
  });

  it('rejects an empty billing charge collection at the DTO boundary', async () => {
    const dto = plainToInstance(CreateBillingCycleDto, {
      tenancyId: 'ten_1',
      roomId: 'room_1',
      cycleMonth: '2026-10',
      dueDate: '2026-10-05',
      charges: [],
    });

    const errors = await validate(dto);
    assert.ok(errors.some((error) => error.property === 'charges'));
  });

  it('enforces ISO dates for the frozen billing period boundaries', async () => {
    const dto = plainToInstance(CreateBillingCycleDto, {
      tenancyId: 'ten_1',
      tenancyTermsId: 'terms_1',
      periodStart: 'not-a-date',
      periodEnd: '2026-10-31',
      charges: [{ type: 'RENT', amount: '3500000.00' }],
    });

    const errors = await validate(dto);
    assert.ok(
      errors.some((error) => error.property === 'periodStart'),
      'Frozen billing period boundaries must reject invalid ISO dates.',
    );
  });

});
