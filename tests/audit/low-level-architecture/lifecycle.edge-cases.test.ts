import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BillingService } from '../../../src/modules/billing/services/billing.service';
import { createCoreTestTransactionManager } from '../../core/support/in-memory-transaction-manager';

describe('finance lifecycle edge-case audit', () => {
  it('rejects an invalid negative Payment at the business boundary', async () => {
    const service = new BillingService({ findById: async () => ({ id: 'tenancy_reference' }) } as never, createCoreTestTransactionManager());
    await assert.rejects(() => service.recordPayment({ tenancyId: 'tenancy_reference', amount: '-10.00', source: 'MANUAL_CASH', verification: 'USER_RECORDED', confirmedAt: new Date().toISOString() }));
  });

  it('rejects overlapping Billing Cycles for one Tenancy', async () => {
    const service = new BillingService({ findById: async () => ({ id: 'tenancy_reference' }) } as never, createCoreTestTransactionManager());
    await service.createCycle({ tenancyId: 'tenancy_reference', tenancyTermsId: 'terms-reference', periodStart: '2026-10-01', periodEnd: '2026-10-31', charges: [{ type: 'RENT', amount: '1.00' }] });
    await assert.rejects(() => service.createCycle({ tenancyId: 'tenancy_reference', tenancyTermsId: 'terms-reference', periodStart: '2026-10-15', periodEnd: '2026-11-15', charges: [{ type: 'RENT', amount: '1.00' }] }));
  });
});
