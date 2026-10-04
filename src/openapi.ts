import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

import { API_PREFIX } from './common/index';

/**
 * Single source of truth for the OpenAPI document configuration.
 *
 * Only CURRENT-core capabilities are advertised. FUTURE scaffolding such as
 * Subscription/Pricing/Quota and CSV/Excel bulk Onboarding is intentionally
 * not tagged here so the published contract never promotes FUTURE as current.
 */
export function buildOpenApiConfig(): Omit<OpenAPIObject, 'paths'> {
  return new DocumentBuilder()
    .setTitle('TrọƠi API')
    .setDescription('Tài liệu OpenAPI chính thức của hệ thống backend TrọƠi (Sổ vận hành thuê trọ)')
    .setVersion('0.1.0')
    .addServer(`/${API_PREFIX}`, 'Base path chung của API hiện hành')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .addTag('Health', 'Kiểm tra trạng thái hoạt động của hệ thống')
    .addTag('Identity & Access', 'Danh tính người dùng và capability truy cập theo relationship, không dùng global role')
    .addTag('Organization', 'Phạm vi vận hành cấp cao nhất của chủ trọ/đơn vị quản lý')
    .addTag('Property', 'Quản lý tài sản và bất động sản ở cấp địa điểm')
    .addTag('Room', 'Đơn vị cho thuê cốt lõi và operational anchor')
    .addTag('Tenancy', 'Quan hệ thuê phòng theo thời gian giữa room và tenant')
    .addTag('Billing', 'Khoản phải thu, chi phí và trạng thái công nợ theo kỳ')
    .addTag('Receipt', 'Bằng chứng phát hành từ Payment đã xác nhận; không phải bản ghi Payment')
    .addTag('Incident', 'Sự cố vận hành và lifecycle xử lý ticket')
    .addTag('Listing', 'Public projection của phòng phục vụ tìm kiếm/khám phá')
    .addTag('Audit & Trust', 'Lưu vết lịch sử nghiệp vụ và báo cáo nội bộ')
    .addTag('Payment Gateway', 'MoMo checkout channel. Confirmed Payment is created only after provider IPN.')
    .build();
}

const PUBLIC_PATHS = [
  { path: '/health', method: 'get' },
  { path: '/listings/public', method: 'get' },
  { path: '/listings/public/search', method: 'get' },
  { path: '/identity-access/auth/google', method: 'post' },
  { path: '/finance/checkouts/momo/ipn', method: 'post' },
];

/**
 * Build the OpenAPI document from a Nest application instance. Shared by the
 * runtime Swagger UI setup and the offline contract export script so both stay
 * in sync.
 */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const document = SwaggerModule.createDocument(app, buildOpenApiConfig());

  // Ensure public endpoints do not require bearer security while protected ones do
  for (const [pathKey, pathItem] of Object.entries(document.paths)) {
    for (const [methodKey, operation] of Object.entries(pathItem)) {
      if (typeof operation !== 'object' || operation === null) continue;
      const isPublic = PUBLIC_PATHS.some(
        (p) => p.path === pathKey && p.method === methodKey.toLowerCase(),
      );
      if (isPublic) {
        (operation as { security?: unknown[] }).security = [];
      } else if (!(operation as { security?: unknown[] }).security) {
        (operation as { security?: unknown[] }).security = [{ bearer: [] }];
      }
    }
  }

  return document;
}
