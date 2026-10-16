// Loopback-only test-principal runner. This file is never imported by the production AppModule.
require('reflect-metadata');
const { randomBytes, randomUUID } = require('node:crypto');
const {
  Body, Controller, Get, Module, Post, Req, UnauthorizedException, ValidationPipe,
} = require('@nestjs/common');
const { APP_GUARD, NestFactory, Reflector } = require('@nestjs/core');
const { accounts, seedMvpPrincipals } = require('./mvp-fixture.cjs');
const { ids: paymentIds, seedDemoGraph } = require('./fixture.cjs');
const { DatabaseModule } = require('../../build/infrastructure/database/database.module');
const { TRANSACTION_MANAGER } = require('../../build/persistence/ports/transaction-manager');
const { ResourceAuthorizationModule } = require('../../build/common/auth/resource-authorization.module');
const { applyHttpBodyParsers, HttpExceptionFilter, Public, TransformInterceptor } = require('../../build/common');
const { MessagingModule } = require('../../build/modules/messaging/messaging.module');
const { AuditTrustModule } = require('../../build/modules/audit-trust');
const { BillingModule } = require('../../build/modules/billing');
const { DashboardModule } = require('../../build/modules/dashboard');
const { HistoryModule } = require('../../build/modules/history');
const { IdentityAccessModule } = require('../../build/modules/identity-access');
const { IncidentModule } = require('../../build/modules/incident');
const { ListingModule } = require('../../build/modules/listing');
const { OrganizationModule } = require('../../build/modules/organization');
const { PropertyModule } = require('../../build/modules/property');
const { ReceiptModule } = require('../../build/modules/receipt');
const { RoomModule } = require('../../build/modules/room');
const { RentalLifecycleModule } = require('../../build/modules/rental-lifecycle');
const { TenancyModule } = require('../../build/modules/tenancy');
const { NotificationModule } = require('../../build/modules/notification');
const { PaymentGatewayModule } = require('../../build/modules/payment-gateway');
const { API_PREFIX } = require('../../build/common/constants');
const { IS_PUBLIC_KEY } = require('../../build/common/decorators/public.decorator');

if (process.env.NODE_ENV === 'production' || process.env.TROOI_DEMO_MVP_ENABLED !== 'true') {
  throw new Error('MVP demo runner requires explicit non-production enablement');
}
const database = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)) {
  throw new Error('MVP demo runner requires a loopback PostgreSQL database');
}
const paymentFixture = process.env.TROOI_SEPAY_PAYMENT_FIXTURE === 'true';
if (paymentFixture && (database.pathname !== '/trooi_sepay_isolated' || process.env.SEPAY_ENABLED !== 'true')) {
  throw new Error('SePay payment fixture requires isolated finance database and an enabled gateway');
}
const demoAccounts = paymentFixture
  ? [{ identifier: 'tenant@trooi.local', userId: paymentIds.tenant, name: 'SePay Test Tenant' }]
  : accounts;
const demoPort = Number(process.env.TROOI_DEMO_MVP_PORT || 3001);
if (![3001, 3101].includes(demoPort)) throw new Error('MVP demo port not allowed');

const accessTokens = new Map();
const refreshTokens = new Map();
const refreshOperations = new Map();
const tokenLifetimeMs = 12 * 60 * 60 * 1000;
const password = process.env.TROOI_DEMO_PASSWORD;
if (!password || password.length < 12) {
  throw new Error('TROOI_DEMO_PASSWORD must be set privately for the loopback demo runner');
}
let transactions;

function demoPrincipal(request) {
  const token = request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  const session = token && accessTokens.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) accessTokens.delete(token);
    throw new UnauthorizedException('Demo session expired; sign in again');
  }
  return { ...session.principal };
}

function issueDemoSession(principal) {
  const accessToken = randomBytes(32).toString('base64url');
  const refreshToken = randomBytes(48).toString('base64url');
  const session = { expiresAt: Date.now() + tokenLifetimeMs, principal };
  accessTokens.set(accessToken, session);
  refreshTokens.set(refreshToken, session);
  return { accessToken, refreshToken, userId: principal.userId, displayName: principal.name, expiresInSeconds: tokenLifetimeMs / 1000 };
}

class DemoMvpController {
  async login(body) {
    const account = demoAccounts.find((entry) => entry.identifier === body?.identifier);
    if (!account || body?.password !== password) throw new UnauthorizedException('Invalid demo credentials');
    const sessionId = randomUUID();
    const principal = {
      userId: account.userId,
      provider: 'google',
      issuer: 'trooi.demo.local',
      subject: account.userId,
      name: account.name,
      sessionId,
      authenticatedAt: new Date().toISOString(),
    };
    return issueDemoSession(principal);
  }

  async refresh(body) {
    const refreshToken = body?.refreshToken;
    const requestId = body?.requestId;
    if (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      throw new UnauthorizedException('Demo refresh request ID is invalid');
    }
    for (const [id, operation] of refreshOperations) {
      if (operation.expiresAt <= Date.now()) refreshOperations.delete(id);
    }
    const previous = refreshOperations.get(requestId);
    if (previous) {
      if (previous.refreshToken !== refreshToken) throw new UnauthorizedException('Demo refresh request ID was reused');
      return previous.response;
    }
    const session = typeof refreshToken === 'string' ? refreshTokens.get(refreshToken) : null;
    if (!session || session.expiresAt <= Date.now()) {
      if (refreshToken) refreshTokens.delete(refreshToken);
      throw new UnauthorizedException('Demo refresh credential expired or already rotated');
    }
    refreshTokens.delete(refreshToken);
    const response = issueDemoSession(session.principal);
    refreshOperations.set(requestId, { refreshToken, response, expiresAt: Date.now() + 30_000 });
    return response;
  }

  async logout(request) {
    const current = request.user;
    for (const [token, session] of accessTokens) {
      if (session.principal.sessionId === current.sessionId) accessTokens.delete(token);
    }
    for (const [token, session] of refreshTokens) {
      if (session.principal.sessionId === current.sessionId) refreshTokens.delete(token);
    }
    return { revoked: true };
  }

  async fixtureStatus() {
    return { mode: 'DEMO', identities: demoAccounts.length, seededPayments: 0, paymentFixture };
  }
}
Controller('demo')(DemoMvpController);
Public()(DemoMvpController.prototype, 'login', Object.getOwnPropertyDescriptor(DemoMvpController.prototype, 'login'));
Post('login')(DemoMvpController.prototype, 'login', Object.getOwnPropertyDescriptor(DemoMvpController.prototype, 'login'));
Body()(DemoMvpController.prototype, 'login', 0);
Public()(DemoMvpController.prototype, 'refresh', Object.getOwnPropertyDescriptor(DemoMvpController.prototype, 'refresh'));
Post('refresh')(DemoMvpController.prototype, 'refresh', Object.getOwnPropertyDescriptor(DemoMvpController.prototype, 'refresh'));
Body()(DemoMvpController.prototype, 'refresh', 0);
Post('logout')(DemoMvpController.prototype, 'logout', Object.getOwnPropertyDescriptor(DemoMvpController.prototype, 'logout'));
Req()(DemoMvpController.prototype, 'logout', 0);
Get('status')(DemoMvpController.prototype, 'fixtureStatus', Object.getOwnPropertyDescriptor(DemoMvpController.prototype, 'fixtureStatus'));
Public()(DemoMvpController.prototype, 'fixtureStatus', Object.getOwnPropertyDescriptor(DemoMvpController.prototype, 'fixtureStatus'));

class MvpDemoModule {}
Module({
  imports: [
    MessagingModule, ResourceAuthorizationModule, OrganizationModule, PropertyModule, RoomModule,
    TenancyModule, BillingModule, DashboardModule, HistoryModule, ReceiptModule, IdentityAccessModule,
    IncidentModule, ListingModule, RentalLifecycleModule, AuditTrustModule, NotificationModule,
    PaymentGatewayModule,
  ],
  controllers: [DemoMvpController],
  providers: [{
    provide: APP_GUARD,
    inject: [Reflector],
    useFactory: (reflector) => ({
      canActivate(context) {
        if (reflector.getAllAndOverride(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
        const request = context.switchToHttp().getRequest();
        request.user = demoPrincipal(request);
        return true;
      },
    }),
  }],
})(MvpDemoModule);

async function main() {
  const app = await NestFactory.create(MvpDemoModule, { bodyParser: false });
  transactions = app.get(TRANSACTION_MANAGER);
  if (paymentFixture) await seedDemoGraph(transactions);
  else await seedMvpPrincipals(transactions);
  applyHttpBodyParsers(app);
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  await app.listen(demoPort, '127.0.0.1');
  console.log(`TroOi MVP DEMO API listening on loopback :${demoPort}; test principals are not Google identities`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
}

main().catch((error) => {
  console.error('MVP demo API failed:', error?.code || error?.name || 'unknown');
  process.exit(1);
});
