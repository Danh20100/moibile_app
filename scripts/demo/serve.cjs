// Development entry point only. Production AppModule/AuthGuard/verifier are never changed.
require('reflect-metadata');
const { randomBytes } = require('node:crypto');
const { Module, Controller, Post, Get, Body, Req, UnauthorizedException, ValidationPipe } = require('@nestjs/common');
const { NestFactory, APP_GUARD, Reflector } = require('@nestjs/core');
const { ids, accounts, seedDemoGraph } = require('./fixture.cjs');
const { DatabaseModule } = require('../../build/infrastructure/database/database.module');
const { TRANSACTION_MANAGER } = require('../../build/persistence/ports/transaction-manager');
const { ResourceAuthorizationModule } = require('../../build/common/auth/resource-authorization.module');
const { BillingModule } = require('../../build/modules/billing/billing.module');
const { PaymentGatewayModule } = require('../../build/modules/payment-gateway/payment-gateway.module');
const { Public, API_PREFIX, applyHttpBodyParsers, HttpExceptionFilter, TransformInterceptor } = require('../../build/common');
const { IS_PUBLIC_KEY } = require('../../build/common/decorators/public.decorator');

if (process.env.NODE_ENV === 'production') throw new Error('Demo runner is forbidden in production');
let database;
try { database = new URL(process.env.DATABASE_URL || ''); } catch { throw new Error('Configured local PostgreSQL URL is unavailable'); }
const inContainer = require('node:fs').existsSync('/.dockerenv');
if (!['localhost', '127.0.0.1', '[::1]', ...(inContainer ? ['postgres'] : [])].includes(database.hostname)) throw new Error('Demo runner requires the configured local PostgreSQL database');
// Process-local configuration; never edits the real service environment or signing credentials.
process.env.DEMO_PAYMENT_ENABLED = 'true';
process.env.DEMO_PAYMENT_PUBLIC_BASE_URL = 'http://localhost:3001';
process.env.DEMO_PAYMENT_SIGNING_KEY = randomBytes(48).toString('base64url');

const tokens = new Map();
const expiryMs = 15 * 60 * 1000;
let tx;
function principal(request) {
  const token = request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  const session = token && tokens.get(token);
  if (!session || session.expires <= Date.now()) throw new UnauthorizedException('Session expired');
  return session.account;
}
class DemoSessionController {
  login(body) {
    const account = accounts.find((entry) => entry.identifier === body?.identifier);
    if (!account || body?.password !== 'TroOi2026!') throw new UnauthorizedException('Invalid credentials');
    for (const [token, session] of tokens) if (session.account.userId === account.userId || session.expires <= Date.now()) tokens.delete(token);
    const token = randomBytes(32).toString('base64url');
    tokens.set(token, { account, expires: Date.now() + expiryMs });
    return { token, userId: account.userId, name: account.name };
  }
  async session(request) {
    const account = principal(request);
    return tx.run(async ({ repositories: r }) => ({ userId: account.userId, name: account.name,
      operatedOrganizationIds: (await r.organization.findByPrimaryOwnerUserId(account.userId)).map((entry) => entry.organizationId),
      linkedTenancyIds: (await r.tenancy.findParticipantsByUser(account.userId)).map((entry) => entry.tenancyId),
    }));
  }
}
Controller('demo')(DemoSessionController);
for (const [name, decorator] of [['login', Post('login')], ['session', Get('session')]]) decorator(DemoSessionController.prototype, name, Object.getOwnPropertyDescriptor(DemoSessionController.prototype, name));
Public()(DemoSessionController.prototype, 'login', Object.getOwnPropertyDescriptor(DemoSessionController.prototype, 'login'));
Body()(DemoSessionController.prototype, 'login', 0);
Req()(DemoSessionController.prototype, 'session', 0);
class DemoRuntimeModule {}
Module({ imports: [DatabaseModule, ResourceAuthorizationModule, BillingModule, PaymentGatewayModule], controllers: [DemoSessionController], providers: [{ provide: APP_GUARD, inject: [Reflector], useFactory: (reflector) => ({ canActivate(context) {
  if (reflector.getAllAndOverride(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
  const request = context.switchToHttp().getRequest();
  request.user = principal(request);
  return true;
} }) }] })(DemoRuntimeModule);
async function main() {
  const app = await NestFactory.create(DemoRuntimeModule, { bodyParser: false, logger: false });
  tx = app.get(TRANSACTION_MANAGER);
  await seedDemoGraph(tx);
  applyHttpBodyParsers(app);
  // This isolated runner can dispatch only DEMO; production MoMo behavior and configuration stay untouched.
  app.use((request, response, next) => {
    const path = request.path.toLowerCase();
    if (path.startsWith('/api/v1/finance/checkouts/momo/')) return response.status(404).json({ message: 'Not found' });
    if (request.method === 'POST' && /^\/api\/v1\/finance\/checkouts\/?$/.test(path) && request.body?.provider !== 'DEMO') {
      return response.status(400).json({ message: 'This local runner accepts DEMO checkouts only' });
    }
    next();
  });

  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  await app.listen(3001, '127.0.0.1');
  console.log('TrọƠi local demo API ready at http://localhost:3001/api/v1; real PostgreSQL settlement; no real money');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
}
main().catch((error) => { console.error('Local demo API failed to start:', error?.code || error?.name || 'unknown'); process.exit(1); });
