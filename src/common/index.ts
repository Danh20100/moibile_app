import { ApiProperty } from '@nestjs/swagger';

export class HealthStatusDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: '2026-09-30T14:00:00.000Z' })
  timestamp!: string;
}

export * from './auth';
export * from './constants';
export * from './decorators';
export * from './dto';
export * from './filters';
export * from './guards';
export * from './interceptors';
