import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import type { AuditRecord, TrustReport } from '../contracts';
import {
  AuditRecordDto,
  QueryAuditDto,
  RecordAuditFactDto,
  SubmitTrustReportDto,
  TrustReportDto,
} from '../dto';
import { AuditTrustService } from '../services/audit-trust.service';

@ApiTags('Audit & Trust')
@Controller('audit-trust')
export class AuditTrustController {
  constructor(
    @Inject(AuditTrustService)
    private readonly auditTrustService: AuditTrustService,
  ) {}

  @Post('facts')
  @ApiOperation({ summary: 'Ghi nhận một sự kiện/business fact quan trọng để lưu vết audit' })
  @ApiResponse({
    status: 201,
    description: 'Sự kiện đã được ghi nhận vào lịch sử',
    type: AuditRecordDto,
  })
  async recordFact(@Body() dto: RecordAuditFactDto): Promise<AuditRecord> {
    return this.auditTrustService.recordFact(dto);
  }

  @Get('facts')
  @ApiOperation({ summary: 'Tra cứu lịch sử audit theo resourceType hoặc resourceId' })
  @ApiQuery({ name: 'resourceType', required: false, type: String })
  @ApiQuery({ name: 'resourceId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Danh sách bản ghi audit', type: [AuditRecordDto] })
  async queryAudit(@Query() query: QueryAuditDto): Promise<AuditRecord[]> {
    return this.auditTrustService.queryAudit(query);
  }

  @Post('reports')
  @ApiOperation({ summary: 'Gửi báo cáo tin đăng công khai' })
  @ApiResponse({
    status: 201,
    description: 'Báo cáo đã được tiếp nhận',
    type: TrustReportDto,
  })
  async submitReport(
    @Body() dto: SubmitTrustReportDto,
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<TrustReport> {
    return this.auditTrustService.submitReport(dto, user.userId);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Danh sách báo cáo nội bộ không mở cho người dùng app' })
  @ApiResponse({ status: 403, description: 'Không cấp danh sách báo cáo cho app user' })
  async listReports(@CurrentUser() _user: VerifiedPrincipal): Promise<TrustReport[]> {
    return this.auditTrustService.listReports();
  }
}
