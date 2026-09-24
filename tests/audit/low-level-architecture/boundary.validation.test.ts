import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateBillingCycleDto } from '../../../src/modules/billing/dto';
import { CreateRoomDto } from '../../../src/modules/room/dto';
import { TenancyService } from '../../../src/modules/tenancy/services/tenancy.service';

describe('request and business boundary validation audit', () => {
  it('rejects a negative room price at the DTO boundary', async () => {
    const dto = plainToInstance(CreateRoomDto, {
      propertyId: 'prop_1',
      roomNumber: '101',
      basePrice: -1,
    });

    const errors = await validate(dto);
    assert.ok(errors.some((error) => error.property === 'basePrice'));
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

  it('enforces the documented YYYY-MM billing cycleMonth format', async () => {
    const dto = plainToInstance(CreateBillingCycleDto, {
      tenancyId: 'ten_1',
      roomId: 'room_1',
      cycleMonth: 'not-a-month',
      dueDate: '2026-10-05',
      charges: [{ type: 'rent', description: 'Monthly rent', amount: 3_500_000 }],
    });

    const errors = await validate(dto);
    assert.ok(
      errors.some((error) => error.property === 'cycleMonth'),
      'DTO documentation says YYYY-MM, so invalid month strings should be rejected.',
    );
  });

  it('rejects a tenancy whose end date is earlier than its start date', async () => {
    const service = new TenancyService();

    await assert.rejects(
      service.create({
        roomId: 'room_1',
        tenantId: 'tenant_1',
        monthlyRent: 3_500_000,
        depositAmount: 3_500_000,
        paymentDueDay: 5,
        startDate: '2026-10-01',
        endDate: '2026-09-30',
      }),
      BadRequestException,
      'A tenancy time range must not end before it starts.',
    );
  });
});
