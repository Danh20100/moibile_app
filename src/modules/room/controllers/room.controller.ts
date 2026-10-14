import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ResourceAuthorizationService } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import type { RoomProfile } from '../contracts';
import { CreateRoomDto, RoomProfileDto, UpdateRoomDto } from '../dto';
import { RoomService } from '../services/room.service';
import { RentalTransactionCoordinator } from '../../../persistence/guards/rental-transaction-coordinator';

@ApiTags('Room')
@Controller('rooms')
export class RoomController {
  constructor(
    @Inject(RoomService)
    private readonly roomService: RoomService,
    @Inject(ResourceAuthorizationService)
    private readonly authz: ResourceAuthorizationService,
    @Inject(RentalTransactionCoordinator)
    private readonly lifecycle: RentalTransactionCoordinator,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Tao Room moi (vacant + active)' })
  @ApiResponse({ status: 201, description: 'Room da duoc tao thanh cong', type: RoomProfileDto })
  async create(
    @Body() dto: CreateRoomDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<RoomProfile> {
    if (user) {
      await this.authz.assertOperatesProperty(user.userId, dto.propertyId);
    }
    return this.roomService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lay danh sach Room (co the loc theo propertyId)' })
  @ApiQuery({ name: 'propertyId', required: false, description: 'Loc theo Property ID' })
  @ApiResponse({ status: 200, description: 'Danh sach Room', type: [RoomProfileDto] })
  async findByPropertyId(
    @Query('propertyId') propertyId?: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<RoomProfile[]> {
    if (propertyId) {
      if (user) {
        await this.authz.assertOperatesProperty(user.userId, propertyId);
      }
      return this.roomService.findByPropertyId(propertyId);
    }
    if (user) {
      const propIds = new Set(await this.authz.getOperatedPropertyIds(user.userId));
      const all = await this.roomService.findByPropertyId();
      return all.filter((r) => propIds.has(r.propertyId));
    }
    return this.roomService.findByPropertyId();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lay thong tin chi tiet Room' })
  @ApiParam({ name: 'id', type: String, description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Thong tin Room', type: RoomProfileDto })
  @ApiResponse({ status: 404, description: 'Khong tim thay Room' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<RoomProfile> {
    if (user) {
      await this.authz.assertCanAccessRoom(user.userId, id);
    }
    return this.roomService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cap nhat nameOrLabel cua Room' })
  @ApiParam({ name: 'id', type: String, description: 'Room ID' })
  @ApiResponse({
    status: 200,
    description: 'Thong tin Room da duoc cap nhat',
    type: RoomProfileDto,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<RoomProfile> {
    if (user) {
      await this.authz.assertOperatesRoom(user.userId, id);
    }
    return this.roomService.update(id, dto);
  }

  @Post(':id/archive')
  async archive(@Param('id') id: string, @CurrentUser() user: VerifiedPrincipal): Promise<RoomProfile> {
    await this.authz.assertOperatesRoom(user.userId, id);
    await this.lifecycle.archiveRoom(id);
    return this.roomService.findById(id);
  }
}
