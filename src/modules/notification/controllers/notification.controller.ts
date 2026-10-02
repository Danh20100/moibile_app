import { Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import type { NotificationItem } from '../contracts';
import { NotificationItemDto } from '../dto';
import { NotificationService } from '../services/notification.service';

@ApiTags('Notification')
@ApiBearerAuth('bearer')
@Controller('notifications')
export class NotificationController {
  constructor(
    @Inject(NotificationService)
    private readonly notificationService: NotificationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current authenticated user' })
  @ApiResponse({ status: 200, description: 'List of notifications', type: [NotificationItemDto] })
  async listMyNotifications(
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<NotificationItem[]> {
    return this.notificationService.findByRecipient(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Notification details', type: NotificationItemDto })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<NotificationItem> {
    return this.notificationService.findById(id, user.userId);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Updated notification', type: NotificationItemDto })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<NotificationItem> {
    return this.notificationService.markAsRead(id, user.userId);
  }
}
