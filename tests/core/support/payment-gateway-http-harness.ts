import 'reflect-metadata';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import type { ResourceAuthorizationService } from '../../../src/common';
import type { GoogleIdTokenVerifier } from '../../../src/integrations/google-identity';
import type { PaymentGatewayService } from '../../../src/modules/payment-gateway/services/payment-gateway.service';

const require = createRequire(__filename);
let compiled = false;
export async function startGatewayHttpHarness(dependencies: {
  service: Pick<PaymentGatewayService, 'createCheckout' | 'findCheckout' | 'handleMomoIpn'>;
  authz: Pick<ResourceAuthorizationService, 'assertCanAccessTenancy' | 'assertCanReadTenancy'>;
  verifier: GoogleIdTokenVerifier;
}): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  // tsx strips decorator metadata; use the production compiler, never synthetic DTO metadata.
  if (!compiled) {
    execFileSync(
      process.execPath,
      [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.build.json'],
      {
        cwd: resolve(__dirname, '../../..'),
        stdio: 'inherit',
      },
    );
    compiled = true;
  }
  const {
    PaymentGatewayController,
  }: typeof import('../../../src/modules/payment-gateway/controllers/payment-gateway.controller') = require('../../../build/modules/payment-gateway/controllers/payment-gateway.controller');
  const {
    PaymentGatewayService,
  }: typeof import('../../../src/modules/payment-gateway/services/payment-gateway.service') = require('../../../build/modules/payment-gateway/services/payment-gateway.service');
  const {
    ResourceAuthorizationService,
    AuthGuard,
    HttpExceptionFilter,
    TransformInterceptor,
    API_PREFIX,
  }: typeof import('../../../src/common') = require('../../../build/common');
  const {
    GOOGLE_ID_TOKEN_VERIFIER,
  }: typeof import('../../../src/integrations/google-identity') = require('../../../build/integrations/google-identity');
  @Module({
    controllers: [PaymentGatewayController],
    providers: [
      { provide: PaymentGatewayService, useValue: dependencies.service },
      { provide: ResourceAuthorizationService, useValue: dependencies.authz },
      { provide: GOOGLE_ID_TOKEN_VERIFIER, useValue: dependencies.verifier },
      { provide: APP_GUARD, useClass: AuthGuard },
    ],
  })
  class GatewayHttpModule {}
  const app = await NestFactory.create(GatewayHttpModule, { logger: false });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  await app.listen(0, '127.0.0.1');
  return { baseUrl: `${await app.getUrl()}/${API_PREFIX}`, close: () => app.close() };
}
