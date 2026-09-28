import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { isNumeric18Scale2NonNegative } from '../../../common/domain/decimal-string';
import { CreateTenancyTermsInput, TenancyTerms } from '../contracts';
import { TenancyService } from './tenancy.service';

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

@Injectable()
export class TenancyTermsService {
  private readonly terms = new Map<string, TenancyTerms>();

  constructor(private readonly tenancies: TenancyService) {}

  async createVersion(input: CreateTenancyTermsInput): Promise<TenancyTerms> {
    await this.tenancies.findById(input.tenancyId);
    if (!Number.isInteger(input.version) || input.version <= 0) {
      throw new BadRequestException('Terms version must be a positive integer');
    }
    if ((await this.listByTenancyId(input.tenancyId)).some((terms) => terms.version === input.version)) {
      throw new BadRequestException('Terms version must be unique within Tenancy');
    }
    this.assertMoney(input.rentAmount, 'rentAmount');
    this.assertMoney(input.agreedDepositRequirement, 'agreedDepositRequirement');
    this.assertCalendarDate(input.termStart, 'termStart');
    this.assertCalendarDate(input.termEnd, 'termEnd');
    this.assertCalendarDate(input.effectiveFromCycleBoundary, 'effectiveFromCycleBoundary');
    if (input.termEnd < input.termStart) {
      throw new BadRequestException('termEnd must not precede termStart');
    }

    const record: TenancyTerms = {
      id: randomUUID(),
      tenancyId: input.tenancyId,
      version: input.version,
      rentAmount: input.rentAmount,
      agreedDepositRequirement: input.agreedDepositRequirement,
      termStart: input.termStart,
      termEnd: input.termEnd,
      billingDayOrDueDateRule: structuredClone(input.billingDayOrDueDateRule),
      electricityArrangement: structuredClone(input.electricityArrangement),
      waterArrangement: structuredClone(input.waterArrangement),
      minimalRentalConditions: structuredClone(input.minimalRentalConditions),
      effectiveFromCycleBoundary: input.effectiveFromCycleBoundary,
    };
    this.terms.set(record.id, structuredClone(record));
    return structuredClone(record);
  }

  async findById(id: string): Promise<TenancyTerms> {
    const record = this.terms.get(id);
    if (!record) {
      throw new NotFoundException(`Tenancy terms not found: ${id}`);
    }
    return structuredClone(record);
  }

  async listByTenancyId(tenancyId: string): Promise<TenancyTerms[]> {
    return Array.from(this.terms.values())
      .filter((record) => record.tenancyId === tenancyId)
      .sort((left, right) => left.version - right.version)
      .map((record) => structuredClone(record));
  }

  private assertMoney(value: string, field: string): void {
    if (!isNumeric18Scale2NonNegative(value)) {
      throw new BadRequestException(`${field} must fit non-negative numeric(18,2)`);
    }
  }

  private assertCalendarDate(value: string, field: string): void {
    const match = CALENDAR_DATE.exec(value);
    if (!match) {
      throw new BadRequestException(`${field} must use YYYY-MM-DD calendar format`);
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12) {
      throw new BadRequestException(`${field} has invalid month`);
    }
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day < 1 || day > daysInMonth[month - 1]) {
      throw new BadRequestException(`${field} has invalid day`);
    }
  }
}
