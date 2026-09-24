import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { API_PREFIX, HttpExceptionFilter, TransformInterceptor } from './common';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix(API_PREFIX);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const config = new DocumentBuilder()
    .setTitle('TrọƠi API')
    .setDescription('Tài liệu OpenAPI chính thức của hệ thống backend TrọƠi (Sổ vận hành thuê trọ)')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('Health', 'Kiểm tra trạng thái hoạt động của hệ thống')
    .addTag('Identity & Access', 'Danh tính người dùng và quyền truy cập')
    .addTag('Organization', 'Phạm vi vận hành cấp cao nhất của chủ trọ/đơn vị quản lý')
    .addTag('Property', 'Quản lý tài sản và bất động sản ở cấp địa điểm')
    .addTag('Room', 'Đơn vị cho thuê cốt lõi và operational anchor')
    .addTag('Tenancy', 'Quan hệ thuê phòng theo thời gian giữa room và tenant')
    .addTag('Billing', 'Khoản phải thu, chi phí và trạng thái công nợ theo kỳ')
    .addTag('Receipt', 'Bản ghi thanh toán và đối chiếu biên nhận vận hành')
    .addTag('Incident', 'Sự cố vận hành và lifecycle xử lý ticket')
    .addTag('Listing', 'Public projection của phòng phục vụ tìm kiếm/khám phá')
    .addTag('Onboarding', 'Điều phối nhập dữ liệu ban đầu cho chủ trọ')
    .addTag('Subscription', 'Quản lý gói dịch vụ và quyền hạn (entitlement) hệ thống')
    .addTag('Audit & Trust', 'Lưu vết lịch sử nghiệp vụ và báo cáo nội bộ')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
