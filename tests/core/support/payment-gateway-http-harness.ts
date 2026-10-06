import 'reflect-metadata';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import type { ResourceAuthorizationService } from '../../../src/common';
import type { GoogleIdTokenVerifier } from '../../../src/integrations/google-identity';
import type { BillingService } from '../../../src/modules/billing/services/billing.service';
import type { PaymentGatewayService } from '../../../src/modules/payment-gateway/services/payment-gateway.service';

const require = createRequire(__filename);
let compiled = false;
type GatewayDependencies = {
  service: Pick<PaymentGatewayService, 'createCheckout' | 'findCheckout' | 'handleMomoIpn'>;
  authz: Pick<ResourceAuthorizationService, 'assertCanAccessTenancy' | 'assertCanReadTenancy'>;
  verifier: GoogleIdTokenVerifier;
};
type BillingDependencies = {
  service: BillingService;
  authz: ResourceAuthorizationService;
  verifier: GoogleIdTokenVerifier;
};
type TrustDependencies = {
  service: import('../../../src/modules/audit-trust/services/audit-trust.service').AuditTrustService;
  verifier: GoogleIdTokenVerifier;
};
export function startGatewayHttpHarness(dependencies: GatewayDependencies) {
  return startHttpHarness({ gateway: dependencies });
}
export function startBillingHttpHarness(dependencies: BillingDependencies) {
  return startHttpHarness({ billing: dependencies });
}
export function startTrustHttpHarness(dependencies: TrustDependencies) {
  return startHttpHarness({ trust: dependencies });
}
async function startHttpHarness(
  selection:
    | { gateway: GatewayDependencies }
    | { billing: BillingDependencies }
    | { trust: TrustDependencies },
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const dependencies =
    'gateway' in selection ? selection.gateway : 'billing' in selection ? selection.billing : selection.trust;
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
    applyHttpBodyParsers,
  }: typeof import('../../../src/common') = require('../../../build/common');
  const {
    GOOGLE_ID_TOKEN_VERIFIER,
  }: typeof import('../../../src/integrations/google-identity') = require('../../../build/integrations/google-identity');
  const {
    BillingController,
  }: typeof import('../../../src/modules/billing/controllers/billing.controller') = require('../../../build/modules/billing/controllers/billing.controller');
  const {
    BillingService,
  }: typeof import('../../../src/modules/billing/services/billing.service') = require('../../../build/modules/billing/services/billing.service');
  const {
    AuditTrustController,
  }: typeof import('../../../src/modules/audit-trust/controllers/audit-trust.controller') = require('../../../build/modules/audit-trust/controllers/audit-trust.controller');
  const {
    AuditTrustService,
  }: typeof import('../../../src/modules/audit-trust/services/audit-trust.service') = require('../../../build/modules/audit-trust/services/audit-trust.service');
  const trust = 'trust' in selection;
  const gateway = 'gateway' in selection;
  @Module({
    controllers: trust ? [AuditTrustController] : gateway ? [PaymentGatewayController] : [BillingController],
    providers: [
      {
        provide: trust ? AuditTrustService : gateway ? PaymentGatewayService : BillingService,
        useValue: dependencies.service,
      },
      ...('authz' in dependencies
        ? [{ provide: ResourceAuthorizationService, useValue: dependencies.authz }]
        : []),
      { provide: GOOGLE_ID_TOKEN_VERIFIER, useValue: dependencies.verifier },
      { provide: APP_GUARD, useClass: AuthGuard },
    ],
  })
  class GatewayHttpModule {}
  const app = await NestFactory.create(GatewayHttpModule, { bodyParser: false, logger: false });
  applyHttpBodyParsers(app);
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  await app.listen(0, '127.0.0.1');
  return { baseUrl: `${await app.getUrl()}/${API_PREFIX}`, close: () => app.close() };
}
