const assert = require('node:assert/strict');

const id = (n) => `e0080000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = Object.freeze({ tenant: id(1), owner: id(2), member: id(3), organization: id(4), property: id(5), room: id(6), tenancy: id(7), participant: id(8), terms: id(9), cycle: id(10), rent: id(11), electricity: id(12), water: id(13), septemberPayment: id(14), depositPayment: id(15), deposit: id(16), depositApplication: id(17), depositEvent: id(18) });
const accounts = Object.freeze([
  { identifier: 'tenant@trooi.local', userId: ids.tenant, name: 'Nguyễn Ngọc Lan' },
  { identifier: 'owner@trooi.local', userId: ids.owner, name: 'Trần Thu Hà' },
  { identifier: 'onboarding@trooi.local', userId: ids.member, name: 'Phạm Thảo Linh' },
]);

/** Additive synthetic fixture seed. Never resets a Payment, checkout or existing rental lifecycle. */
async function seedDemoGraph(tx) {
  await tx.run(async ({ repositories: r }) => {
    for (const account of accounts) await r.identity.ensureUser(account.userId);
    const org = await r.organization.findOrganization(ids.organization);
    if (org) assert.equal(org.primaryOwnerUserId, ids.owner, 'Demo organization collision');
    else await r.organization.createOrganization({ organizationId: ids.organization, primaryOwnerUserId: ids.owner, name: 'Tài sản của Thu Hà' });
    const property = await r.property.findProperty(ids.property);
    if (property) assert.equal(property.organizationId, ids.organization, 'Demo property collision');
    else await r.property.createProperty({ propertyId: ids.property, organizationId: ids.organization, name: 'Nhà Phú Nhuận', lifecycleStatus: 'ACTIVE', operationalAddressText: 'Nhà Phú Nhuận · Căn hộ A02', operationalLocation: { latitude: 10.798, longitude: 106.681 }, publicLocationProjection: { latitude: 10.8, longitude: 106.68 } });
    const room = await r.property.findRoom(ids.room);
    if (room) assert.equal(room.propertyId, ids.property, 'Demo room collision');
    else await r.property.createRoom({ roomId: ids.room, propertyId: ids.property, nameOrLabel: 'Căn hộ A02', operationalState: 'OCCUPIED', recordLifecycle: 'ACTIVE' });
    const tenancy = await r.tenancy.findTenancy(ids.tenancy);
    if (tenancy) assert.equal(tenancy.roomId, ids.room, 'Demo tenancy collision');
    else await r.tenancy.createTenancy({ tenancyId: ids.tenancy, roomId: ids.room, status: 'ACTIVE', startedAt: '2026-06-01T00:00:00Z', endedAt: null, endReason: null });
    const participant = await r.tenancy.findParticipant(ids.participant);
    if (participant) { assert.equal(participant.tenancyId, ids.tenancy); assert.equal(participant.userId, ids.tenant); }
    else await r.tenancy.insertParticipant({ tenancyParticipantId: ids.participant, tenancyId: ids.tenancy, userId: ids.tenant, role: 'PRIMARY', joinedAt: '2026-06-01T00:00:00Z', leftAt: null });
    const terms = await r.tenancy.findTermsById(ids.terms);
    if (terms) assert.equal(terms.tenancyId, ids.tenancy);
    else await r.tenancy.insertTerms({ tenancyTermsId: ids.terms, tenancyId: ids.tenancy, version: 1, rentAmount: '5200000', agreedDepositRequirement: '5200000', termStart: '2026-06-01', termEnd: '2027-05-31', billingDayOrDueDateRule: { day: 5 }, electricityArrangement: { unitPrice: '3500', unit: 'kWh' }, waterArrangement: { unitPrice: '20000', unit: 'm3' }, minimalRentalConditions: {}, effectiveFromCycleBoundary: '2026-06-01' });
    const cycle = await r.finance.findBillingCycle(ids.cycle);
    if (cycle) assert.equal(cycle.tenancyId, ids.tenancy);
    else await r.finance.insertBillingCycle({ billingCycleId: ids.cycle, tenancyId: ids.tenancy, tenancyTermsId: ids.terms, periodStart: '2026-10-01', periodEnd: '2026-10-31' });
    for (const [chargeId, chargeType, amount] of [[ids.rent, 'RENT', '5200000'], [ids.electricity, 'ELECTRICITY', '301000'], [ids.water, 'WATER', '100000']]) {
      const charge = await r.finance.findCharge(chargeId);
      if (charge) { assert.equal(charge.billingCycleId, ids.cycle); assert.equal(charge.chargeType, chargeType); }
      else await r.finance.insertCharge({ chargeId, billingCycleId: ids.cycle, chargeType, amount, utilityConnectionId: null, startMeterReadingId: null, endMeterReadingId: null });
    }
    for (const [paymentId, amount, confirmedAt] of [[ids.septemberPayment, '5560000', '2026-09-05T02:00:00Z'], [ids.depositPayment, '5200000', '2026-06-01T02:00:00Z']]) {
      const payment = await r.finance.findPayment(paymentId);
      if (payment) assert.equal(payment.tenancyId, ids.tenancy);
      else await r.finance.insertPayment({ paymentId, tenancyId: ids.tenancy, amount, source: 'MANUAL_TRANSFER', verification: 'USER_RECORDED', confirmedAt, voidedOrReversedAt: null, correctionNote: null, replacementPaymentId: null });
    }
    const deposit = await r.finance.findDeposit(ids.deposit);
    if (deposit) assert.equal(deposit.tenancyId, ids.tenancy);
    else await r.finance.insertDeposit({ depositId: ids.deposit, tenancyId: ids.tenancy });
    const applications = await r.finance.findDepositPaymentApplications(ids.deposit);
    if (!applications.some((entry) => entry.depositPaymentApplicationId === ids.depositApplication)) {
      await r.finance.insertDepositPaymentApplication({ depositPaymentApplicationId: ids.depositApplication, paymentId: ids.depositPayment, depositId: ids.deposit, appliedAmount: '5200000', appliedAt: '2026-06-01T02:00:00Z' });
      await r.finance.insertDepositEvent({ depositEventId: ids.depositEvent, depositId: ids.deposit, eventType: 'RECEIVED', amount: '5200000', occurredAt: '2026-06-01T02:00:00Z', paymentApplicationId: ids.depositApplication, settlementId: null });
    }
  });
}
module.exports = { ids, accounts, seedDemoGraph };
if (require.main === module) {
  assert.equal(new Set(Object.values(ids)).size, Object.values(ids).length);
  assert.ok(Object.values(ids).every((value) => /^e0080000-0000-4000-8000-\d{12}$/.test(value)));
  assert.equal(5200000 + 301000 + 100000, 5601000);
  console.log('Demo fixture IDs and billing sum verified');
}
