import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ResourceAuthorizationService } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import type { DashboardReadModel } from '../contracts';
import { DashboardReadModelDto } from '../dto';
import { DashboardService } from '../services/dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth('bearer')
@Controller('organizations/:organizationId/dashboard')
export class DashboardController {
  constructor(
    @Inject(DashboardService)
    private readonly dashboard: DashboardService,
    @Inject(ResourceAuthorizationService)
    private readonly authz: ResourceAuthorizationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Read the server-owned V1 operational Dashboard projection' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiResponse({ status: 200, type: DashboardReadModelDto })
  @ApiResponse({ status: 403, description: 'Current user does not operate the Organization' })
  async findByOrganization(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<DashboardReadModel> {
    await this.authz.assertOperatesOrganization(user.userId, organizationId);
    return this.dashboard.forOrganization(organizationId);
  }
}
