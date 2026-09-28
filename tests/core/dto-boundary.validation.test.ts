import assert from 'node:assert/strict';
import test from 'node:test';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { UpdateOrganizationDto } from '../../src/modules/organization/dto';
import { UpdatePropertyDto } from '../../src/modules/property/dto';
import { UpdateRoomDto } from '../../src/modules/room/dto';

type DtoClass = new () => object;

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
