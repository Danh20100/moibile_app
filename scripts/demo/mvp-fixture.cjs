const assert = require('node:assert/strict');

const accounts = Object.freeze([
  { identifier: 'owner@trooi.demo', userId: 'd0080000-0000-4000-8000-000000000001', name: 'Demo Owner' },
  { identifier: 'tenant@trooi.demo', userId: 'd0080000-0000-4000-8000-000000000002', name: 'Demo Tenant' },
]);
const organizationId = 'd0080000-0000-4000-8000-000000000010';

async function seedMvpPrincipals(transactions) {
  await transactions.run(async ({ repositories }) => {
    for (const account of accounts) {
      await repositories.identity.ensureUser(account.userId);
      await repositories.identityFoundation.initializeProfileIfAbsent({
        userId: account.userId,
        displayName: account.name,
        now: new Date().toISOString(),
      });
    }

    const organization = await repositories.organization.findOrganization(organizationId);
    if (organization) {
      assert.equal(organization.primaryOwnerUserId, accounts[0].userId, 'Demo organization collision');
    } else {
      await repositories.organization.createOrganization({
        organizationId,
        primaryOwnerUserId: accounts[0].userId,
        name: 'DEMO · Tài sản TrọƠi',
      });
    }
  });
}

module.exports = { accounts, organizationId, seedMvpPrincipals };
