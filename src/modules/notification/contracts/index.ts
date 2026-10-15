import type { TimestampString } from '../../../persistence/ports/repositories';

export interface NotificationItem {
  id: string;
  recipientUserId: string;
  category: string;
  messageOrPayloadReference: string;
  sourceType: string | null;
  sourceId: string | null;
  deliveryStatus: string;
  createdAt: TimestampString;
  deliveredAt: TimestampString | null;
  readAt: TimestampString | null;
}
