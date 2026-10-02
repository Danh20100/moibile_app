import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { NotificationRecord } from '../../../persistence/ports/notification.repository';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';
import type { NotificationItem } from '../contracts';

@Injectable()
export class NotificationService {
  constructor(
    @Inject(TRANSACTION_MANAGER)
    private readonly tx: TransactionManager,
  ) {}

  async findByRecipient(userId: string): Promise<NotificationItem[]> {
    const rows = await this.tx.run(({ repositories }) =>
      repositories.notification.findNotificationsByRecipient(userId),
    );
    return rows.map((r) => this.fromRecord(r));
  }

  async findById(id: string, userId: string): Promise<NotificationItem> {
    const row = await this.tx.run(({ repositories }) =>
      repositories.notification.findNotification(id),
    );
    if (!row) {
      throw new NotFoundException(`Notification not found: ${id}`);
    }
    if (row.recipientUserId !== userId) {
      throw new ForbiddenException('You do not have permission to access this notification');
    }
    return this.fromRecord(row);
  }

  async markAsRead(id: string, userId: string): Promise<NotificationItem> {
    const item = await this.findById(id, userId);
    const now = new Date().toISOString();
    const updated: NotificationRecord = {
      notificationId: item.id,
      recipientUserId: item.recipientUserId,
      category: item.category,
      messageOrPayloadReference: item.messageOrPayloadReference,
      deliveryStatus: 'DELIVERED',
      createdAt: item.createdAt,
      deliveredAt: item.deliveredAt ?? now,
      readAt: now,
    };
    await this.tx.run(({ repositories }) =>
      repositories.notification.updateNotification(updated),
    );
    return this.fromRecord(updated);
  }

  private fromRecord(r: NotificationRecord): NotificationItem {
    const separator = r.messageOrPayloadReference.indexOf(':');
    const sourceType = separator > 0 ? r.messageOrPayloadReference.slice(0, separator) : null;
    const sourceId = separator > 0 ? r.messageOrPayloadReference.slice(separator + 1) || null : null;
    return {
      id: r.notificationId,
      recipientUserId: r.recipientUserId,
      category: r.category,
      messageOrPayloadReference: r.messageOrPayloadReference,
      sourceType,
      sourceId,
      deliveryStatus: r.deliveryStatus,
      createdAt: r.createdAt,
      deliveredAt: r.deliveredAt,
      readAt: r.readAt,
    };
  }
}
