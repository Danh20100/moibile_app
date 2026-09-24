import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

import type { SubscriptionPlan } from '../contracts';

export class AssignSubscriptionDto {
  @ApiProperty({ description: 'ID tổ chức', example: 'org_12345' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({
    description: 'Tên gói đăng ký dịch vụ',
    enum: ['free', 'starter', 'pro'],
    example: 'starter',
  })
  @IsIn(['free', 'starter', 'pro'])
  plan!: SubscriptionPlan;

  @ApiProperty({ description: 'Thời hạn gói (số ngày)', example: 30 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  durationDays!: number;
}

export class CheckEntitlementQueryDto {
  @ApiProperty({ description: 'ID tổ chức', example: 'org_12345' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({ description: 'Capability cần kiểm tra quyền hạn', example: 'bulk_onboarding' })
  @IsString()
  @IsNotEmpty()
  capability!: string;
}
