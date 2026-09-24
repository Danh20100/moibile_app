import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RecordAuditFactDto {
  @ApiProperty({ description: 'ID người hoặc hệ thống thực hiện hành động', example: 'user_12345' })
  @IsString()
  @IsNotEmpty()
  actorId!: string;

  @ApiProperty({
    description: 'Tên hành động nghiệp vụ (e.g. room.created, tenancy.ended)',
    example: 'tenancy.ended',
  })
  @IsString()
  @IsNotEmpty()
  action!: string;

  @ApiProperty({ description: 'Loại tài nguyên chịu tác động', example: 'tenancy' })
  @IsString()
  @IsNotEmpty()
  resourceType!: string;

  @ApiProperty({ description: 'ID của tài nguyên', example: 'ten_12345' })
  @IsString()
  @IsNotEmpty()
  resourceId!: string;

  @ApiPropertyOptional({
    description: 'Metadata bổ sung về sự kiện',
    example: { reason: 'contract_expired' },
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class SubmitInternalReportDto {
  @ApiProperty({ description: 'ID người gửi báo cáo', example: 'user_tenant_123' })
  @IsString()
  @IsNotEmpty()
  reporterId!: string;

  @ApiProperty({
    description: 'Loại đối tượng bị báo cáo (user, property, receipt, ...)',
    example: 'property',
  })
  @IsString()
  @IsNotEmpty()
  targetType!: string;

  @ApiProperty({ description: 'ID của đối tượng bị báo cáo', example: 'prop_12345' })
  @IsString()
  @IsNotEmpty()
  targetId!: string;

  @ApiProperty({
    description: 'Lý do báo cáo',
    example: 'Thông tin phòng không trùng khớp với thực tế',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({ description: 'Chi tiết bổ sung cho ban quản trị nền tảng' })
  @IsOptional()
  @IsString()
  details?: string;
}

export class QueryAuditDto {
  @ApiPropertyOptional({ description: 'Lọc theo loại tài nguyên', example: 'room' })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID tài nguyên', example: 'room_12345' })
  @IsOptional()
  @IsString()
  resourceId?: string;
}
