import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  recipientUserId!: string;

  @ApiProperty()
  category!: string;

  @ApiProperty()
  messageOrPayloadReference!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Source feature type parsed from the authoritative notification reference.',
  })
  sourceType!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Source record ID parsed from the authoritative notification reference.',
  })
  sourceId!: string | null;

  @ApiProperty()
  deliveryStatus!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ nullable: true, required: false })
  deliveredAt?: string | null;

  @ApiProperty({ nullable: true, required: false })
  readAt?: string | null;
}
