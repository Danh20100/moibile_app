import assert from 'node:assert/strict';
import test from 'node:test';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { PaymentDto, RecordPaymentDto } from '../../src/modules/billing/dto';
import { CreateListingDto } from '../../src/modules/listing/dto';
import { UpdateOrganizationDto } from '../../src/modules/organization/dto';
import { UpdatePropertyDto } from '../../src/modules/property/dto';
import { UpdateRoomDto } from '../../src/modules/room/dto';
import { CreateGatewayCheckoutDto } from '../../src/modules/payment-gateway/dto';

type DtoClass = new () => object;

test('gateway provider is optional and accepts only MOMO or SEPAY, excluding null', () => {
  const body = { tenancyId: 'tenancy-a', amount: '1000' };
  const validate = (input: object) => validateSync(plainToInstance(CreateGatewayCheckoutDto, input), { whitelist: true, forbidNonWhitelisted: true });
  assert.deepEqual(validate(body), []);
  for (const provider of ['MOMO', 'SEPAY']) assert.deepEqual(validate({ ...body, provider }), []);
  for (const provider of [null, '', 'momo', 'OTHER', 1]) {
    assert.ok(validate({ ...body, provider }).some((error) => error.property === 'provider'));
  }
});

const TARGETS: Array<[string, DtoClass, string]> = [
  ['UpdateOrganizationDto', UpdateOrganizationDto, 'name'],
  ['UpdatePropertyDto', UpdatePropertyDto, 'name'],
  ['UpdatePropertyDto', UpdatePropertyDto, 'operationalAddressText'],
  ['UpdateRoomDto', UpdateRoomDto, 'nameOrLabel'],
];

function errorsFor(dto: DtoClass, payload: Record<string, unknown>, field: string) {
  return validateSync(plainToInstance(dto, payload)).filter((error) => error.property === field);
}

for (const [label, dto, field] of TARGETS) {
  test(`${label}.${field} omitted is valid`, () => {
    assert.deepEqual(errorsFor(dto, {}, field), []);
  });

  test(`${label}.${field} supplied as empty string is invalid`, () => {
    const errors = errorsFor(dto, { [field]: '' }, field);
    assert.equal(errors.length, 1);
    assert.ok(errors[0].constraints?.isNotEmpty, `expected isNotEmpty constraint on ${label}.${field}`);
  });

  test(`${label}.${field} supplied as normal text is valid`, () => {
    assert.deepEqual(errorsFor(dto, { [field]: 'Phong 201' }, field), []);
  });
}

test('CreateListingDto.publicLocationProjection is required', () => {
  const errors = validateSync(
    plainToInstance(CreateListingDto, {
      roomId: 'room-a',
      publicTitle: 'Room A',
      publicDescription: 'Public description',
      publicPriceProjection: '3500000.00',
    }),
  ).filter((error) => error.property === 'publicLocationProjection');

  assert.equal(errors.length, 1);
  assert.ok(errors[0].constraints?.isDefined);
});

test('manual Payment DTO excludes caller verification and gateway source; read DTO retains provider evidence', () => {
  const manual = {
    tenancyId: 'tenancy-a',
    amount: '100.00',
    source: 'MANUAL_TRANSFER',
    confirmedAt: '2026-10-05T00:00:00.000Z',
  };
  const validate = (body: object) =>
    validateSync(plainToInstance(RecordPaymentDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
  assert.deepEqual(validate(manual), []);
  assert.ok(
    validate({ ...manual, source: 'GATEWAY' }).some((error) => error.property === 'source'),
  );
  for (const verification of ['USER_RECORDED', 'PROVIDER_VERIFIED']) {
    assert.ok(
      validate({ ...manual, verification }).some((error) => error.property === 'verification'),
    );
  }
  assert.deepEqual(
    validateSync(
      plainToInstance(PaymentDto, {
        ...manual,
        id: 'payment-gateway',
        source: 'GATEWAY',
        verification: 'PROVIDER_VERIFIED',
      }),
    ),
    [],
  );
});
