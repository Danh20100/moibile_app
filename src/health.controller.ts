import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from './common';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Kiểm tra tình trạng hoạt động của service' })
  @ApiResponse({
    status: 200,
    description: 'Service đang hoạt động bình thường',
    schema: {
      example: {
        success: true,
        data: {
          status: 'ok',
          timestamp: '2026-09-25T00:00:00.000Z',
        },
        timestamp: '2026-09-25T00:00:00.000Z',
      },
    },
  })
  check(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
