import type { TimestampString } from './repositories';

export interface NotificationRecord {
  notification_id: string; recipient_user_id: string; category: string;
  message_or_payload_reference: string; delivery_status: string;
  created_at: TimestampString; delivered_at: TimestampString | null; read_at: TimestampString | null;
}
export interface CreateNotificationInput extends NotificationRecord {}
export interface NotificationRepository {
  createNotification(input: CreateNotificationInput): Promise<void>;
  findNotification(notificationId: string): Promise<NotificationRecord | undefined>;
  findNotificationsByRecipient(recipientUserId: string): Promise<NotificationRecord[]>;
  updateNotification(record: NotificationRecord): Promise<void>;
}
