import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardRoomStateCountsDto {
  @ApiProperty({ example: 8 })
  VACANT!: number;

  @ApiProperty({ example: 12 })
  OCCUPIED!: number;

  @ApiProperty({ example: 2 })
  MAINTENANCE!: number;

  @ApiProperty({ example: 1 })
  INACTIVE!: number;
}

export class DashboardReadModelDto {
  @ApiProperty({ description: 'Operated Organization ID' })
  organizationId!: string;

  @ApiProperty({ type: DashboardRoomStateCountsDto })
  roomsByState!: DashboardRoomStateCountsDto;

  @ApiProperty({ description: 'Count of Tenancy rows whose current lifecycle status is ACTIVE' })
  activeTenancyCount!: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Null until an authoritative dashboard finance aggregation scope is frozen; clients must not reconstruct it.',
  })
  outstandingReceivable!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Null until an authoritative dashboard finance aggregation scope is frozen; clients must not reconstruct it.',
  })
  confirmedPaymentTotal!: string | null;

  @ApiProperty({
    description:
      'Count of Incidents in REPORTED, ACKNOWLEDGED, IN_PROGRESS, or RESOLVED state.',
  })
  openIncidentCount!: number;
}
