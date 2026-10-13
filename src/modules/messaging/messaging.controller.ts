import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  ValidationPipe,
  Header,
} from '@nestjs/common';
import { CurrentUser } from '../../common';
import type { VerifiedPrincipal } from '../identity-access/contracts';
import { MessagingRepository } from './messaging.repository';
import { MessagingService } from './messaging.service';
import { OpenConversationDto, PostMessageDto } from './messaging.dto';

function identity(user?: VerifiedPrincipal): string {
  if (!user) throw new UnauthorizedException();
  return user.userId;
}
@Controller('messaging/conversations')
export class MessagingController {
  constructor(
    @Inject(MessagingService) private readonly service: MessagingService,
    @Inject(MessagingRepository) private readonly repo: MessagingRepository,
  ) {}
  @Post() async open(
    @Body(
      new ValidationPipe({
        expectedType: OpenConversationDto,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: OpenConversationDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ) {
    return { id: await this.repo.open(identity(user), dto.contextType, dto.contextId) };
  }
  @Get() list(@CurrentUser() user?: VerifiedPrincipal) {
    return this.service.list(identity(user));
  }
  @Get(':id/messages') messages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ) {
    return this.service.messages(identity(user), id);
  }
  @Post(':id/messages') post(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(
      new ValidationPipe({
        expectedType: PostMessageDto,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: PostMessageDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ) {
    return this.service.post(identity(user), id, dto);
  }
  @Post(':id/read') read(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ) {
    return this.service.read(identity(user), id);
  }
  @Get(':id/attachments/:attachmentId')
  @Header('Cache-Control', 'private, no-store')
  attachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ) {
    return this.service.attachment(identity(user), id, attachmentId);
  }
}
