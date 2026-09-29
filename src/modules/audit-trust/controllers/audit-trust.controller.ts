import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuditRecord, TrustReport } from '../contracts';
import { QueryAuditDto, RecordAuditFactDto, SubmitInternalReportDto } from '../dto';
import { AuditTrustService } from '../services/audit-trust.service';

@ApiTags('Audit & Trust')
@Controller('audit-trust')
export class AuditTrustController {
  constructor(private readonly auditTrustService: AuditTrustService) {}

  @Post('facts')
  @ApiOperation({ summary: 'Ghi nhận một sự kiện/business fact quan trọng để lưu vết audit' })
  @ApiResponse({ status: 201, description: 'Sự kiện đã được ghi nhận vào lịch sử' })
  async recordFact(@Body() dto: RecordAuditFactDto): Promise<AuditRecord> {
    return this.auditTrustService.recordFact(dto);
  }

  @Get('facts')
  @ApiOperation({ summary: 'Tra cứu lịch sử audit theo resourceType hoặc resourceId' })
  @ApiResponse({ status: 200, description: 'Danh sách bản ghi audit' })
  async queryAudit(@Query() query: QueryAuditDto): Promise<AuditRecord[]> {
    return this.auditTrustService.queryAudit(query);
  }

  @Post('reports')
  @ApiOperation({ summary: 'Gửi báo cáo nội bộ lên nền tảng để review' })
  @ApiResponse({ status: 201, description: 'Báo cáo nội bộ đã được tiếp nhận' })
  async submitReport(@Body() dto: SubmitInternalReportDto): Promise<TrustReport> {
    return this.auditTrustService.submitReport(dto);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Xem danh sách các báo cáo nội bộ đang chờ hoặc đã xử lý' })
  @ApiResponse({ status: 200, description: 'Danh sách báo cáo' })
  async listReports(): Promise<TrustReport[]> {
    return this.auditTrustService.listReports();
  }
}
