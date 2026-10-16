const assert = require('node:assert/strict');

const id = (n) => `e0080000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = Object.freeze({
  tenant: id(1), owner: id(2), member: id(3), organization: id(4), property: id(5), room: id(6), tenancy: id(7), participant: id(8), terms: id(9), cycle: id(10), rent: id(11), electricity: id(12), water: id(13), septemberPayment: id(14), depositPayment: id(15), deposit: id(16), depositApplication: id(17), depositEvent: id(18),
  ownerBinh: id(19), tenantBinh: id(20), organizationBinh: id(21), propertyBinh: id(22), roomVacant: id(23), roomBinh: id(24), listingVacant: id(25), listingDraft: id(26), tenancyBinh: id(27), participantBinh: id(28), termsBinh: id(29), cycleBinh: id(30), rentBinh: id(31), partialPayment: id(32), partialAllocation: id(33),
  incidentOpen: id(34), incidentOpenEvent: id(35), incidentClosed: id(36), incidentClosedEvent: id(37), notice: id(38), notification: id(39), inquiry: id(40), conversation: id(41), messageTenant: id(42), messageOwner: id(43),
});
const accounts = Object.freeze([
  { identifier: 'tenant@trooi.local', userId: ids.tenant, name: 'Nguyễn Ngọc Lan' },
  { identifier: 'owner@trooi.local', userId: ids.owner, name: 'Trần Thu Hà' },
  { identifier: 'onboarding@trooi.local', userId: ids.member, name: 'Phạm Thảo Linh' },
  { identifier: 'owner.binh@trooi.local', userId: ids.ownerBinh, name: 'Lê Minh Bình' },
  { identifier: 'tenant.binh@trooi.local', userId: ids.tenantBinh, name: 'Đỗ Gia Hân' },
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
    await seedPortfolio(r);
  });
}

async function seedPortfolio(r) {
  const org = await r.organization.findOrganization(ids.organizationBinh);
  if (org) assert.equal(org.primaryOwnerUserId, ids.ownerBinh, 'Second demo organization collision');
  else await r.organization.createOrganization({ organizationId: ids.organizationBinh, primaryOwnerUserId: ids.ownerBinh, name: 'Tài sản của Minh Bình' });
  const property = await r.property.findProperty(ids.propertyBinh);
  if (property) assert.equal(property.organizationId, ids.organizationBinh, 'Second demo property collision');
  else await r.property.createProperty({ propertyId: ids.propertyBinh, organizationId: ids.organizationBinh, name: 'Nhà Bình Thạnh', lifecycleStatus: 'ACTIVE', operationalAddressText: 'Nhà Bình Thạnh · Phòng B01', operationalLocation: { latitude: 10.81, longitude: 106.71 }, publicLocationProjection: { latitude: 10.812, longitude: 106.708 } });
  const vacant = await r.property.findRoom(ids.roomVacant);
  if (!vacant) await r.property.createRoom({ roomId: ids.roomVacant, propertyId: ids.property, nameOrLabel: 'Phòng P.201', operationalState: 'VACANT', recordLifecycle: 'ACTIVE' });
  const occupied = await r.property.findRoom(ids.roomBinh);
  if (occupied) assert.equal(occupied.propertyId, ids.propertyBinh, 'Second demo room collision');
  else await r.property.createRoom({ roomId: ids.roomBinh, propertyId: ids.propertyBinh, nameOrLabel: 'Phòng B01', operationalState: 'OCCUPIED', recordLifecycle: 'ACTIVE' });
  if (!(await r.listing.findListing(ids.listingVacant))) await r.listing.createListing({ listingId: ids.listingVacant, roomId: ids.roomVacant, status: 'PUBLISHED', publicTitle: 'Phòng P.201 Phú Nhuận', publicDescription: 'Phòng trống, có máy lạnh và wifi.', publicPriceProjection: '4800000.00', publicLocationProjection: { latitude: 10.8, longitude: 106.68 } });
  if (!(await r.listing.findListing(ids.listingDraft))) await r.listing.createListing({ listingId: ids.listingDraft, roomId: ids.roomBinh, status: 'DRAFT', publicTitle: 'Phòng B01 nháp', publicDescription: 'Tin chưa công khai.', publicPriceProjection: '4500000.00', publicLocationProjection: { latitude: 10.812, longitude: 106.708 } });
  if (!(await r.listing.findInquiry(ids.inquiry))) await r.listing.createInquiry({ inquiryId: ids.inquiry, listingId: ids.listingVacant, senderUserId: ids.tenantBinh, contactIntentOrMessage: 'Mình muốn xem phòng P.201 cuối tuần.', status: 'NEW', createdAt: '2026-10-08T04:00:00.000Z' });
  const tenancy = await r.tenancy.findTenancy(ids.tenancyBinh);
  if (tenancy) assert.equal(tenancy.roomId, ids.roomBinh, 'Second demo tenancy collision');
  else await r.tenancy.createTenancy({ tenancyId: ids.tenancyBinh, roomId: ids.roomBinh, status: 'ACTIVE', startedAt: '2026-09-01T00:00:00.000Z', endedAt: null, endReason: null });
  if (!(await r.tenancy.findParticipant(ids.participantBinh))) await r.tenancy.insertParticipant({ tenancyParticipantId: ids.participantBinh, tenancyId: ids.tenancyBinh, userId: ids.tenantBinh, role: 'PRIMARY', joinedAt: '2026-09-01T00:00:00.000Z', leftAt: null });
  if (!(await r.tenancy.findTermsById(ids.termsBinh))) await r.tenancy.insertTerms({ tenancyTermsId: ids.termsBinh, tenancyId: ids.tenancyBinh, version: 1, rentAmount: '4500000.00', agreedDepositRequirement: '4500000.00', termStart: '2026-09-01', termEnd: '2027-08-31', billingDayOrDueDateRule: { day: 5 }, electricityArrangement: { unitPrice: '3500', unit: 'kWh' }, waterArrangement: { unitPrice: '15000', unit: 'm3' }, minimalRentalConditions: { occupants: 1 }, effectiveFromCycleBoundary: '2026-09-01' });
  if (!(await r.finance.findBillingCycle(ids.cycleBinh))) await r.finance.insertBillingCycle({ billingCycleId: ids.cycleBinh, tenancyId: ids.tenancyBinh, tenancyTermsId: ids.termsBinh, periodStart: '2026-10-01', periodEnd: '2026-10-31' });
  if (!(await r.finance.findCharge(ids.rentBinh))) await r.finance.insertCharge({ chargeId: ids.rentBinh, billingCycleId: ids.cycleBinh, chargeType: 'RENT', amount: '4500000.00', utilityConnectionId: null, startMeterReadingId: null, endMeterReadingId: null });
  if (!(await r.finance.findPayment(ids.partialPayment))) await r.finance.insertPayment({ paymentId: ids.partialPayment, tenancyId: ids.tenancyBinh, amount: '2000000.00', source: 'MANUAL_TRANSFER', verification: 'USER_RECORDED', confirmedAt: '2026-10-06T02:00:00.000Z', voidedOrReversedAt: null, correctionNote: 'Synthetic manual transfer, not a gateway payment', replacementPaymentId: null });
  const allocations = await r.finance.findPaymentAllocations(ids.partialPayment);
  if (!allocations.some((entry) => entry.paymentAllocationId === ids.partialAllocation)) await r.finance.insertPaymentAllocation({ paymentAllocationId: ids.partialAllocation, paymentId: ids.partialPayment, chargeId: ids.rentBinh, allocatedAmount: '1500000.00' });
  if (!(await r.incident.findIncident(ids.incidentOpen))) {
    await r.incident.createIncident({ incidentId: ids.incidentOpen, roomId: ids.roomBinh, reportedByUserId: ids.tenantBinh, category: 'ELECTRICAL', status: 'REPORTED', closureReason: null, createdAt: '2026-10-09T01:00:00.000Z', closedAt: null });
    await r.incident.insertIncidentEvent({ incidentEventId: ids.incidentOpenEvent, incidentId: ids.incidentOpen, eventType: 'STATUS_CHANGED', actorUserId: ids.tenantBinh, note: 'Đèn bếp không sáng.', attachmentReference: null, fromStatus: null, toStatus: 'REPORTED', occurredAt: '2026-10-09T01:00:00.000Z' });
  }
  if (!(await r.incident.findIncident(ids.incidentClosed))) {
    await r.incident.createIncident({ incidentId: ids.incidentClosed, roomId: ids.room, reportedByUserId: ids.tenant, category: 'PLUMBING', status: 'CLOSED', closureReason: 'Replaced washer', createdAt: '2026-09-12T01:00:00.000Z', closedAt: '2026-09-13T08:00:00.000Z' });
    await r.incident.insertIncidentEvent({ incidentEventId: ids.incidentClosedEvent, incidentId: ids.incidentClosed, eventType: 'STATUS_CHANGED', actorUserId: ids.owner, note: 'Đã thay gioăng.', attachmentReference: null, fromStatus: 'REPORTED', toStatus: 'CLOSED', occurredAt: '2026-09-13T08:00:00.000Z' });
  }
  if (!(await r.tenancy.findNotice(ids.notice))) await r.tenancy.insertNotice({ tenancyNoticeId: ids.notice, tenancyId: ids.tenancy, noticeType: 'GENERAL', issuedByUserId: ids.owner, contentOrNote: 'Cuối tuần cắt nước từ 8h đến 11h để bảo trì.', issuedAt: '2026-10-03T01:00:00.000Z', acknowledgedByUserId: null, acknowledgedAt: null });
  if (!(await r.notification.findNotification(ids.notification))) await r.notification.createNotification({ notificationId: ids.notification, recipientUserId: ids.tenant, category: 'TENANCY_NOTICE', messageOrPayloadReference: `tenancy_notice:${ids.notice}`, deliveryStatus: 'PENDING', createdAt: '2026-10-03T01:00:00.000Z', deliveredAt: null, readAt: null });
}

async function seedDemoMessages(db) {
  const existing = await db.selectFrom('messaging_conversations').select('conversation_id').where('conversation_id', '=', ids.conversation).executeTakeFirst();
  if (existing) return;
  await db.insertInto('messaging_conversations').values({ conversation_id: ids.conversation, inquiry_id: null, tenancy_id: ids.tenancy, created_at: '2026-10-02T03:00:00.000Z' }).execute();
  await db.insertInto('messaging_participants').values([
    { conversation_id: ids.conversation, user_id: ids.owner, last_read_at: '2026-10-02T03:05:00.000Z' },
    { conversation_id: ids.conversation, user_id: ids.tenant, last_read_at: '2026-10-02T03:01:00.000Z' },
  ]).execute();
  await db.insertInto('messaging_messages').values([
    { message_id: ids.messageTenant, conversation_id: ids.conversation, sender_user_id: ids.tenant, text: 'Chào chị, vòi nước phòng A02 bị rỉ.', created_at: '2026-10-02T03:00:00.000Z' },
    { message_id: ids.messageOwner, conversation_id: ids.conversation, sender_user_id: ids.owner, text: 'Mình đã nhận, sẽ qua kiểm tra chiều nay.', created_at: '2026-10-02T03:05:00.000Z' },
  ]).execute();
}
module.exports = { ids, accounts, seedDemoGraph, seedDemoMessages };
if (require.main === module) {
  assert.equal(new Set(Object.values(ids)).size, Object.values(ids).length);
  assert.ok(Object.values(ids).every((value) => /^e0080000-0000-4000-8000-\d{12}$/.test(value)));
  assert.equal(5200000 + 301000 + 100000, 5601000);
  console.log('Demo fixture IDs and billing sum verified');
}
