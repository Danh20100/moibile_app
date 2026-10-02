import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BillingCycleDto, DepositEventDto, DepositProjectionDto, PaymentDto } from '../../billing/dto';
import { IncidentEventDto, IncidentTicketDto } from '../../incident/dto';
import { ListingProfileDto, ListingStatusEventDto } from '../../listing/dto';
import { ReceiptRecordDto } from '../../receipt/dto';
import { RoomProfileDto } from '../../room/dto';
import { TenancyNoticeDto, TenancyProfileDto, TenancyTermsDto } from '../../tenancy/dto';

export class RentalPaymentHistoryEntryDto {
  @ApiProperty({ type: PaymentDto })
  payment!: PaymentDto;

  @ApiProperty({ type: [ReceiptRecordDto] })
  receipts!: ReceiptRecordDto[];
}

export class RentalIncidentHistoryEntryDto {
  @ApiProperty({ type: IncidentTicketDto })
  incident!: IncidentTicketDto;

  @ApiProperty({ type: [IncidentEventDto] })
  events!: IncidentEventDto[];
}

export class RentalDepositHistoryDto {
  @ApiProperty({ type: DepositProjectionDto })
  projection!: DepositProjectionDto;

  @ApiProperty({ type: [DepositEventDto] })
  events!: DepositEventDto[];
}

export class ListingOperationalHistoryEntryDto {
  @ApiProperty({ type: ListingProfileDto })
  listing!: ListingProfileDto;

  @ApiProperty({ type: [ListingStatusEventDto] })
  events!: ListingStatusEventDto[];
}

export class TenancyFinanceHistoryEntryDto {
  @ApiProperty({ type: TenancyProfileDto })
  tenancy!: TenancyProfileDto;

  @ApiProperty({ type: [BillingCycleDto] })
  billingCycles!: BillingCycleDto[];

  @ApiProperty({ type: [RentalPaymentHistoryEntryDto] })
  payments!: RentalPaymentHistoryEntryDto[];

  @ApiPropertyOptional({ type: RentalDepositHistoryDto, nullable: true })
  deposit!: RentalDepositHistoryDto | null;
}

export class RoomOperationalHistoryProjectionDto {
  @ApiProperty({ type: RoomProfileDto })
  room!: RoomProfileDto;

  @ApiProperty({ type: [ListingOperationalHistoryEntryDto] })
  listings!: ListingOperationalHistoryEntryDto[];

  @ApiProperty({ type: [TenancyFinanceHistoryEntryDto] })
  tenancies!: TenancyFinanceHistoryEntryDto[];

  @ApiProperty({ type: [RentalIncidentHistoryEntryDto] })
  incidents!: RentalIncidentHistoryEntryDto[];
}

export class RentalHistoryProjectionDto {
  @ApiProperty({ type: TenancyProfileDto })
  tenancy!: TenancyProfileDto;

  @ApiProperty({ type: [TenancyTermsDto] })
  terms!: TenancyTermsDto[];

  @ApiProperty({ type: [RentalPaymentHistoryEntryDto] })
  payments!: RentalPaymentHistoryEntryDto[];

  @ApiProperty({ type: [TenancyNoticeDto] })
  notices!: TenancyNoticeDto[];

  @ApiProperty({
    type: [RentalIncidentHistoryEntryDto],
    description:
      'Room incidents whose createdAt falls inside the Tenancy occupancy window; this is a read projection, not a new Incident-to-Tenancy source relation.',
  })
  incidents!: RentalIncidentHistoryEntryDto[];

  @ApiPropertyOptional({ type: RentalDepositHistoryDto, nullable: true })
  deposit!: RentalDepositHistoryDto | null;
}
