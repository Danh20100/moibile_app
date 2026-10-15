import assert from 'node:assert/strict';
import test from 'node:test';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { CreateTenancyTermsDto } from '../../src/modules/tenancy/dto';
import { resolveBillingDueDate } from '../../src/modules/tenancy/domain/terms-billing-day';

const dates: Array<[number, number, number, string]> = [
  [2025, 2, 28, '2025-02-28'], [2024, 2, 28, '2024-02-28'],
  [2024, 2, 29, '2024-02-29'], [2025, 2, 30, '2025-02-28'],
  [2025, 4, 31, '2025-04-30'], [2025, 3, 31, '2025-03-31'],
  [2026, 1, 31, '2026-01-31'],
];

for (const [year, month, day, expected] of dates) {
  test(`billing day ${day} resolves as a Vietnam date in ${year}-${month}`, () => {
    assert.equal(resolveBillingDueDate({ day }, year, month), expected);
  });
}

test('unknown historical rule shapes do not get inferred into due dates', () => {
  for (const historical of [{}, { day: 4, legacy: true }, 12, [12], null]) {
    assert.equal(resolveBillingDueDate(historical, 2026, 2), null);
  }
});

test('date-only billing days remain valid at Gregorian century and year boundaries', () => {
  assert.equal(resolveBillingDueDate({ day: 29 }, 1900, 2), '1900-02-28');
  assert.equal(resolveBillingDueDate({ day: 29 }, 2000, 2), '2000-02-29');
  assert.equal(resolveBillingDueDate({ day: 29 }, 4, 2), '0004-02-29');
  assert.equal(resolveBillingDueDate({ day: 31 }, 1, 1), '0001-01-31');
  assert.equal(resolveBillingDueDate({ day: 31 }, 9999, 12), '9999-12-31');
});

test('new Terms accept exactly an integer day from 1 through 31', () => {
  const base = { version: 1, rentAmount: '1.00', agreedDepositRequirement: '0.00', termStart: '2026-01-01',
    termEnd: '2026-12-31', electricityArrangement: {}, waterArrangement: {}, minimalRentalConditions: {},
    effectiveFromCycleBoundary: '2026-01-01' };
  const validateRule = (rule: unknown) => validateSync(plainToInstance(CreateTenancyTermsDto,
    { ...base, billingDayOrDueDateRule: rule }), { whitelist: true, forbidNonWhitelisted: true })
    .some((error) => error.property === 'billingDayOrDueDateRule');
  for (const day of [1, 28, 29, 30, 31]) assert.equal(validateRule({ day }), false);
  for (const rule of [{}, { day: 0 }, { day: 32 }, { day: 1.5 }, { day: '5' }, { day: 5, legacy: true }, [], 5, null]) {
    assert.equal(validateRule(rule), true, JSON.stringify(rule));
  }
});
