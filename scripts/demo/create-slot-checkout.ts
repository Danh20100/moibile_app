import { writeFileSync } from 'node:fs';

import { sql } from 'kysely';

import { createDatabaseClient } from '../../src/infrastructure/database/database.client';
import { loadDatabaseConfig } from '../../src/infrastructure/database/database.config';
import { SepayGatewayAdapter } from '../../src/modules/payment-gateway/providers/sepay-gateway.adapter';
import { HttpSepayOrderClient } from '../../src/modules/payment-gateway/sepay/sepay-order-client';
import { loadSepayProductionConfig } from '../../src/modules/payment-gateway/sepay/sepay-production-config';
import { SlotCheckoutService } from '../../src/modules/payment-gateway/services/slot-checkout.service';

const purchaseId = 'a2590000-0000-4000-8000-000000000001';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

async function main(): Promise<void> {
  const config = loadSepayProductionConfig(process.env);
  if (!config) throw new Error('Refusing slot checkout: SePay production config is off');
  const db = createDatabaseClient(loadDatabaseConfig(process.env));
  try {
    const owner = await sql<{ user_id: string }>`
      SELECT created_by_user_id AS user_id FROM gateway.gateway_checkouts
      WHERE provider = 'SEPAY' AND status = 'SUCCEEDED'
      ORDER BY created_at
      LIMIT 1
    `.execute(db);
    const userId = owner.rows[0]?.user_id;
    if (!userId) throw new Error('Refusing slot checkout: finance database has no settled SePay owner');
    const adapter = new SepayGatewayAdapter(config, new HttpSepayOrderClient(config));
    const slots = new SlotCheckoutService(db, adapter);
    const checkout = await slots.create(userId, purchaseId, purchaseId);
    const record = await slots.asGatewayRecord(checkout.id);
    if (!record) throw new Error('Slot checkout missing after insert');
    const form = adapter.checkoutForm(record);
    const inputs = Object.entries(form.fields)
      .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
      .join('');
    writeFileSync(
      '.local-backups/slot-checkout.html',
      `<!doctype html><html lang="vi"><meta charset="utf-8"><title>Slot 259000</title><body><p>259.000 VND. Gửi biểu mẫu chỉ mở SePay, chưa phải đã thanh toán.</p><form method="post" action="${escapeHtml(form.action)}">${inputs}<button type="submit">Chuyển khoản 259.000đ</button></form></body></html>`,
    );
    console.log(`checkout=${checkout.id} status=${checkout.status} form=.local-backups/slot-checkout.html`);
    try {
      const settled = await slots.reconcile(userId, checkout.id);
      console.log(`reconcile=${settled.status} validUntil=${settled.validUntil ?? ''}`);
    } catch (error) {
      console.log(`reconcile=${error instanceof Error ? error.message : 'pending'}`);
    }
  } finally {
    await db.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Slot checkout failed');
  process.exitCode = 1;
});
