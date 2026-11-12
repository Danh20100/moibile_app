import { createHash, randomUUID } from 'node:crypto';

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { sql, type Kysely } from 'kysely';

import { DATABASE_CLIENT } from '../../../infrastructure/database/database.tokens';
import type { Database } from '../../../infrastructure/database/schema.types';
import { mapPostgresError } from '../../../infrastructure/database/postgres-error.mapper';
import { PersistenceUniqueViolation } from '../../../persistence/errors';
import type { GatewayCheckoutRecord } from '../../../persistence/ports/finance.repository';
import type { SepayRequestSnapshot } from '../../../persistence/ports/gateway-checkout.types';
import { GATEWAY_CLOCK, VerifiedGatewayEvidence } from '../providers/gateway-provider';
import { SepayGatewayAdapter } from '../providers/sepay-gateway.adapter';
import { readSepayIpnInvoice } from '../sepay/sepay-ipn';
import type { SepayHandoffView } from './sepay-handoff.service';

export const PLAN_AMOUNT = '49000.00';
export const PLAN_NOT_A_TENANCY = '00000000-0000-4000-8000-000000000049';

export function planValidUntil(verifiedAtIso: string): string {
  const expiry = new Date(verifiedAtIso);
  expiry.setUTCMonth(expiry.getUTCMonth() + 1);
  return expiry.toISOString();
}

export interface PlanCheckoutView {
  id: string;
  purchaseId: string;
  amount: typeof PLAN_AMOUNT;
  status: string;
  payUrl: string | null;
  validUntil: string | null;
}

interface PlanRow {
  checkout_id: string;
  owner_user_id: string;
  purchase_id: string;
  idempotency_key: string;
  amount: string;
  status: GatewayCheckoutRecord['status'];
  provider_order_id: string;
  provider_request_id: string;
  provider_partner_code: string;
  reference_code: string;
  request_snapshot: SepayRequestSnapshot;
  fingerprint: string;
  pay_url: string | null;
  handoff_attempt: number;
  handoff_claimed_at: Date | string | null;
  provider_trans_id: string | null;
  provider_remote_order_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  valid_until: Date | string | null;
}

@Injectable()
export class PlanCheckoutService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: Kysely<Database>,
    @Inject(SepayGatewayAdapter) private readonly sepay: SepayGatewayAdapter,
    @Optional() @Inject(GATEWAY_CLOCK) private readonly clock: () => Date = () => new Date(),
  ) {}

  async create(userId: string, purchaseId: string, idempotencyKey: string): Promise<PlanCheckoutView> {
    this.requireIds(userId, purchaseId, idempotencyKey);
    if (!this.sepay.isAvailable()) throw new ServiceUnavailableException('SEPAY checkout is unavailable');
    const key = idempotencyKey.toLowerCase();
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(['SEPAY', 'PLAN', userId, purchaseId.toLowerCase(), PLAN_AMOUNT, key]))
      .digest('hex');
    const existing = await this.findOwned(userId, purchaseId, key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new ConflictException('Idempotency-Key payload differs');
      if (existing.status !== 'SUCCEEDED') await this.refreshPayUrl(existing);
      return this.view(await this.must(existing.checkout_id));
    }
    const checkoutId = randomUUID();
    const prepared = this.sepay.prepareIntent(
      { provider: 'SEPAY', tenancyId: purchaseId, amount: PLAN_AMOUNT },
      checkoutId,
    );
    const now = this.clock().toISOString();
    const record = this.blank(checkoutId, userId, purchaseId, key, fingerprint, now);
    record.providerPartnerCode = prepared.merchantScope;
    record.providerOrderId = prepared.invoice;
    record.providerRequestId = prepared.requestId;
    record.requestSnapshot = prepared.requestSnapshot;
    record.payUrl = (await this.sepay.prepareHandoff(record)).payUrl ?? null;
    try {
      await sql`
        INSERT INTO owner_plan_checkouts (
          checkout_id, owner_user_id, purchase_id, idempotency_key, amount, status,
          provider_order_id, provider_request_id, provider_partner_code, reference_code,
          request_snapshot, fingerprint, pay_url, created_at, updated_at
        ) VALUES (
          ${record.checkoutId}, ${userId}, ${purchaseId.toLowerCase()}, ${key}, ${PLAN_AMOUNT}, 'CREATED',
          ${record.providerOrderId}, ${record.providerRequestId}, ${record.providerPartnerCode}, ${record.referenceCode},
          ${JSON.stringify(record.requestSnapshot)}::jsonb, ${fingerprint}, ${record.payUrl}, ${now}, ${now}
        )
      `.execute(this.db);
    } catch (error) {
      if (!(mapPostgresError(error) instanceof PersistenceUniqueViolation)) throw error;
      const raced = await this.findOwned(userId, purchaseId, key);
      if (!raced || raced.fingerprint !== fingerprint) throw new ConflictException('Idempotency-Key payload differs');
      return this.view(raced);
    }
    return this.view(await this.must(checkoutId));
  }

  async list(userId: string): Promise<Array<{ purchaseId: string; validUntil: string }>> {
    if (!isUUID(userId)) throw new NotFoundException('Plan entitlement not found');
    const result = await sql<{ purchase_id: string; valid_until: Date | string }>`
      SELECT purchase_id, valid_until FROM owner_plan_entitlements
      WHERE owner_user_id = ${userId} AND status = 'PROVIDER_VERIFIED' AND valid_until > now()
    `.execute(this.db);
    return result.rows.map((row) => ({ purchaseId: row.purchase_id, validUntil: iso(row.valid_until) }));
  }

  async reconcile(userId: string, checkoutId: string): Promise<PlanCheckoutView> {
    if (!isUUID(userId) || !isUUID(checkoutId)) throw new NotFoundException('Plan checkout not found');
    const row = await this.must(checkoutId);
    if (row.owner_user_id !== userId) throw new NotFoundException('Plan checkout not found');
    if (row.status === 'SUCCEEDED') return this.view(row);
    const evidence = await this.sepay.reconcile(this.toRecord(row));
    if (evidence === 'pending' || evidence === 'uncertain')
      throw new ServiceUnavailableException('SePay order is not uniquely paid');
    await this.markVerified(evidence);
    return this.view(await this.must(checkoutId));
  }

  async asGatewayRecord(checkoutId: string): Promise<GatewayCheckoutRecord | undefined> {
    const row = await this.find(checkoutId);
    return row ? this.toRecord(row) : undefined;
  }

  async release(record: GatewayCheckoutRecord): Promise<SepayHandoffView> {
    if (record.status !== 'CREATED' || record.handoffAttempt !== 0) return { kind: 'issued', record };
    const now = this.clock().toISOString();
    const claimed = await sql`
      UPDATE owner_plan_checkouts
      SET handoff_attempt = handoff_attempt + 1, handoff_claimed_at = COALESCE(handoff_claimed_at, ${now}::timestamptz),
          status = 'UNKNOWN', updated_at = ${now}
      WHERE checkout_id = ${record.checkoutId} AND status = 'CREATED' AND handoff_attempt = 0
      RETURNING checkout_id
    `.execute(this.db);
    if (claimed.rows.length !== 1) return { kind: 'issued', record };
    const locked = this.toRecord(await this.must(record.checkoutId));
    const form = this.sepay.checkoutForm(locked);
    return { kind: 'form', record: locked, action: form.action, fields: form.fields };
  }

  async acceptIpn(adapter: SepayGatewayAdapter, payload: unknown): Promise<boolean> {
    const orderId = readSepayIpnInvoice(payload);
    const row = await this.findByOrder(orderId);
    if (!row) return false;
    const evidence = await adapter.verifyNotification(payload, this.toRecord(row));
    await this.markVerified(evidence);
    return true;
  }

  async markVerified(evidence: VerifiedGatewayEvidence): Promise<void> {
    if (!VerifiedGatewayEvidence.isVerified(evidence))
      throw new ConflictException('Internally verified gateway evidence required');
    const data = evidence.data;
    if (
      data.provider !== 'SEPAY' ||
      !data.referenceCode.startsWith('PLAN ') ||
      data.amount !== PLAN_AMOUNT ||
      data.outcome !== 'PAYMENT_SUCCEEDED' ||
      !data.providerSettlementId
    )
      throw new ConflictException('Plan settlement identity conflict');
    const now = this.clock().toISOString();
    const validUntil = planValidUntil(now);
    await this.db.transaction().execute(async (trx) => {
      await sql`SELECT checkout_id FROM owner_plan_checkouts WHERE checkout_id = ${data.checkoutId} FOR UPDATE`.execute(trx);
      const current = await this.find(data.checkoutId, trx);
      if (!current || current.provider_order_id !== data.invoice || money(current.amount) !== PLAN_AMOUNT)
        throw new ConflictException('Plan settlement identity conflict');
      const prior = await sql<{ provider_trans_id: string }>`
        SELECT provider_trans_id FROM owner_plan_entitlements WHERE checkout_id = ${data.checkoutId}
      `.execute(trx);
      if (prior.rows.length === 1) {
        if (prior.rows[0].provider_trans_id !== data.providerSettlementId)
          throw new ConflictException('Plan settlement identity conflict');
        return;
      }
      await sql`
        INSERT INTO owner_plan_entitlements (
          entitlement_id, checkout_id, owner_user_id, purchase_id, amount, status,
          valid_until, provider_trans_id, verified_at
        ) VALUES (
          ${randomUUID()}, ${current.checkout_id}, ${current.owner_user_id}, ${current.purchase_id},
          ${PLAN_AMOUNT}, 'PROVIDER_VERIFIED', ${validUntil}, ${data.providerSettlementId}, ${now}
        )
      `.execute(trx);
      await sql`
        UPDATE owner_plan_checkouts
        SET status = 'SUCCEEDED', provider_trans_id = ${data.providerSettlementId},
            provider_remote_order_id = ${data.remoteOrderId}, updated_at = ${now}
        WHERE checkout_id = ${current.checkout_id}
      `.execute(trx);
    });
  }

  private async refreshPayUrl(row: PlanRow): Promise<void> {
    const record = this.toRecord(row);
    record.status = 'CREATED';
    record.handoffAttempt = 0;
    const payUrl = (await this.sepay.prepareHandoff(record)).payUrl ?? null;
    const now = this.clock().toISOString();
    await sql`
      UPDATE owner_plan_checkouts
      SET pay_url = ${payUrl}, status = 'CREATED', handoff_attempt = 0, updated_at = ${now}
      WHERE checkout_id = ${row.checkout_id} AND status <> 'SUCCEEDED'
    `.execute(this.db);
  }

  private blank(
    checkoutId: string,
    userId: string,
    purchaseId: string,
    key: string,
    fingerprint: string,
    now: string,
  ): GatewayCheckoutRecord {
    return {
      provider: 'SEPAY',
      requestSnapshot: null,
      idempotencyKey: key,
      fingerprint,
      providerPartnerCode: null,
      firstDispatchAt: null,
      dispatchLeaseOwner: null,
      dispatchLeaseUntil: null,
      replayBlocker: null,
      providerOutcome: null,
      providerResultCode: null,
      providerOutcomeStage: null,
      terminalEvidence: null,
      providerTransId: null,
      providerRemoteOrderId: null,
      handoffClaimedAt: null,
      handoffAttempt: 0,
      checkoutId,
      tenancyId: PLAN_NOT_A_TENANCY,
      createdByUserId: userId,
      amount: PLAN_AMOUNT,
      referenceCode: `PLAN ${purchaseId.slice(0, 8).toUpperCase()}`,
      providerOrderId: '',
      providerRequestId: '',
      status: 'CREATED',
      payUrl: null,
      deeplink: null,
      resultingPaymentId: null,
      lastIpnPayload: null,
      lastIpnAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  private toRecord(row: PlanRow): GatewayCheckoutRecord {
    return {
      provider: 'SEPAY',
      requestSnapshot:
        typeof row.request_snapshot === 'string'
          ? (JSON.parse(row.request_snapshot) as SepayRequestSnapshot)
          : row.request_snapshot,
      idempotencyKey: row.idempotency_key,
      fingerprint: row.fingerprint,
      providerPartnerCode: row.provider_partner_code,
      firstDispatchAt: null,
      dispatchLeaseOwner: null,
      dispatchLeaseUntil: null,
      replayBlocker: null,
      providerOutcome: null,
      providerResultCode: null,
      providerOutcomeStage: null,
      terminalEvidence: null,
      providerTransId: row.provider_trans_id,
      providerRemoteOrderId: row.provider_remote_order_id,
      handoffClaimedAt: row.handoff_claimed_at ? iso(row.handoff_claimed_at) : null,
      handoffAttempt: Number(row.handoff_attempt),
      checkoutId: row.checkout_id,
      tenancyId: PLAN_NOT_A_TENANCY,
      createdByUserId: row.owner_user_id,
      amount: money(row.amount),
      referenceCode: row.reference_code,
      providerOrderId: row.provider_order_id,
      providerRequestId: row.provider_request_id,
      status: row.status,
      payUrl: row.pay_url,
      deeplink: null,
      resultingPaymentId: null,
      lastIpnPayload: null,
      lastIpnAt: null,
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    };
  }

  private async view(row: PlanRow): Promise<PlanCheckoutView> {
    return {
      id: row.checkout_id,
      purchaseId: row.purchase_id,
      amount: PLAN_AMOUNT,
      status: row.status,
      payUrl: row.pay_url,
      validUntil: row.valid_until ? iso(row.valid_until) : null,
    };
  }

  private async findOwned(userId: string, purchaseId: string, key: string): Promise<PlanRow | undefined> {
    const rows = await sql<PlanRow>`
      SELECT c.*, e.valid_until
      FROM owner_plan_checkouts c
      LEFT JOIN owner_plan_entitlements e ON e.checkout_id = c.checkout_id
      WHERE c.owner_user_id = ${userId} AND (c.purchase_id = ${purchaseId.toLowerCase()} OR c.idempotency_key = ${key})
    `.execute(this.db);
    return rows.rows[0];
  }

  private async find(checkoutId: string, executor: Kysely<Database> = this.db): Promise<PlanRow | undefined> {
    const rows = await sql<PlanRow>`
      SELECT c.*, e.valid_until
      FROM owner_plan_checkouts c
      LEFT JOIN owner_plan_entitlements e ON e.checkout_id = c.checkout_id
      WHERE c.checkout_id = ${checkoutId}
    `.execute(executor);
    return rows.rows[0];
  }

  private async findByOrder(orderId: string): Promise<PlanRow | undefined> {
    const rows = await sql<PlanRow>`
      SELECT c.*, e.valid_until FROM owner_plan_checkouts c
      LEFT JOIN owner_plan_entitlements e ON e.checkout_id = c.checkout_id
      WHERE c.provider_order_id = ${orderId}
    `.execute(this.db);
    return rows.rows[0];
  }

  private async must(checkoutId: string): Promise<PlanRow> {
    const row = await this.find(checkoutId);
    if (!row) throw new NotFoundException('Plan checkout not found');
    return row;
  }

  private requireIds(userId: string, purchaseId: string, idempotencyKey: string): void {
    if (!isUUID(userId) || !isUUID(purchaseId) || !isUUID(idempotencyKey))
      throw new ConflictException('Plan checkout identity conflict');
  }
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function money(value: string | number): typeof PLAN_AMOUNT {
  const normalized = Number(value).toFixed(2);
  if (normalized !== PLAN_AMOUNT) throw new ConflictException('Plan settlement identity conflict');
  return PLAN_AMOUNT;
}
