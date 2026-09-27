import test from 'node:test';
import assert from 'node:assert/strict';
import { scrollPositionForRender } from '../src/core/scroll.js';
import { tenantHomeView } from '../src/views/tenant.js';

test('saving a room should not reset scroll on the same route', () => {
  assert.equal(scrollPositionForRender('/tenant', '/tenant', 625), 625);
  assert.equal(scrollPositionForRender('/tenant', '/tenant', -3), 0);
});

test('navigating to another page must not restore the previous scroll', () => {
  assert.equal(scrollPositionForRender('/tenant', '/tenant/saved', 625), 0);
  assert.equal(scrollPositionForRender(null, '/tenant', 625), 0);
});

test('save-room button is not nested inside navigation link', () => {
  const room = {
    id: 2, name: 'Studio 02', area: 'Quận 3', price: 4400000,
    size: '22m²', type: 'Studio', score: 4.7,
  };
  const html = tenantHomeView({ rooms: [room], savedIds: [], notice: null });
  const card = html.split('class="card room-card"')[1];
  assert.ok(card, 'room card must exist');
  const linkClose = card.indexOf('</a>');
  const saveButton = card.indexOf('class="heart ');
  assert.ok(linkClose > 0, 'card overlay link must be closed');
  assert.ok(saveButton > linkClose, 'button must be separate from the link');
});
