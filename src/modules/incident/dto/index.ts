import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import type { IncidentStatus } from '../contracts';

export class CreateIncidentDto {
  @ApiProperty({ description: 'ID phòng xảy ra sự cố', example: 'room_12345' })
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @ApiProperty({ description: 'ID người báo sự cố', example: 'user_tenant_123' })
  @IsString()
  @IsNotEmpty()
  reporterId!: string;

  @ApiProperty({ description: 'Tiêu đề sự cố ngắn gọn', example: 'Hỏng vòi nước bồn rửa mặt' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    description: 'Mô tả chi tiết tình trạng sự cố',
    example: 'Vòi nước bị rò rỉ nước liên tục từ tối qua',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    description: 'Phân loại sự cố (plumbing, electricity, internet, facility, other)',
    example: 'plumbing',
  })
  @IsString()
  @IsNotEmpty()
  category!: string;
}

export class UpdateIncidentStatusDto {
  @ApiProperty({
    description: 'Trạng thái sự cố',
    enum: ['acknowledged', 'processing', 'need_more_information', 'resolved', 'closed'],
    example: 'acknowledged',
  })
  @IsIn(['acknowledged', 'processing', 'need_more_information', 'resolved', 'closed'])
  status!: IncidentStatus;

  @ApiPropertyOptional({ description: 'Ghi chú xử lý hoặc yêu cầu thông tin thêm' })
  @IsOptional()
  @IsString()
  note?: string;
}
