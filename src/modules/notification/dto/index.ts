import { ApiProperty } from '@nestjs/swagger';

export class NotificationItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  recipientUserId!: string;

  @ApiProperty()
  category!: string;

  @ApiProperty()
  messageOrPayloadReference!: string;

  @ApiProperty()
  deliveryStatus!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ nullable: true, required: false })
  deliveredAt?: string | null;

  @ApiProperty({ nullable: true, required: false })
  readAt?: string | null;
}
