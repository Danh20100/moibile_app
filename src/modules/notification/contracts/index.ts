import type { TimestampString } from '../../../persistence/ports/repositories';

export interface NotificationItem {
  id: string;
  recipientUserId: string;
  category: string;
  messageOrPayloadReference: string;
  deliveryStatus: string;
  createdAt: TimestampString;
  deliveredAt: TimestampString | null;
  readAt: TimestampString | null;
}
