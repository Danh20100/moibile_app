import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ResourceAuthorizationService } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import type { OrganizationProfile } from '../contracts';
import { CreateOrganizationDto, OrganizationProfileDto, UpdateOrganizationDto } from '../dto';
import { OrganizationService } from '../services/organization.service';

@ApiTags('Organization')
@Controller('organizations')
export class OrganizationController {
  constructor(
    @Inject(OrganizationService)
    private readonly organizationService: OrganizationService,
    @Inject(ResourceAuthorizationService)
    private readonly authz: ResourceAuthorizationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Tạo rental operating workspace mới' })
  @ApiResponse({
    status: 201,
    description: 'Workspace đã được tạo thành công',
    type: OrganizationProfileDto,
  })
  async create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<OrganizationProfile> {
    if (!user) {
      throw new UnauthorizedException('Verified principal is required');
    }
    return this.organizationService.create({
      name: dto.name,
      primaryOwnerUserId: user.userId,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách rental operating workspace' })
  @ApiResponse({ status: 200, description: 'Danh sách workspace', type: [OrganizationProfileDto] })
  async findAll(@CurrentUser() user?: VerifiedPrincipal): Promise<OrganizationProfile[]> {
    if (!user) {
      return this.organizationService.findAll();
    }
    const all = await this.organizationService.findAll();
    return all.filter((org) => org.primaryOwnerUserId === user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết workspace theo ID' })
  @ApiParam({ name: 'id', type: String, description: 'Organization ID' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin chi tiết workspace',
    type: OrganizationProfileDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy workspace' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<OrganizationProfile> {
    if (user) {
      await this.authz.assertOperatesOrganization(user.userId, id);
    }
    return this.organizationService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Đổi tên rental operating workspace' })
  @ApiParam({ name: 'id', type: String, description: 'Organization ID' })
  @ApiResponse({
    status: 200,
    description: 'Tên workspace đã được cập nhật',
    type: OrganizationProfileDto,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<OrganizationProfile> {
    if (user) {
      await this.authz.assertOperatesOrganization(user.userId, id);
    }
    return this.organizationService.update(id, dto);
  }
}
