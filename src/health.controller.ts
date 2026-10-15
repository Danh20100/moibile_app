import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { HealthStatusDto, Public } from './common/index';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Kiểm tra tình trạng hoạt động của service' })
  @ApiResponse({
    status: 200,
    description: 'Service đang hoạt động bình thường',
    type: HealthStatusDto,
  })
  check(): HealthStatusDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
