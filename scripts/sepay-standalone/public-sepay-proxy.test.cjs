const test = require('node:test');
const assert = require('node:assert/strict');
const { allowedRoute } = require('./public-sepay-proxy.cjs');

test('expose only SePay IPN, signed handoff, and fixed return paths', () => {
  for (const [method, route] of [
    ['POST', '/api/v1/finance/checkouts/sepay/ipn'],
    ['GET', '/api/v1/finance/checkouts/sepay/handoff?token=fake'],
    ['POST', '/api/v1/finance/checkouts/sepay/handoff?token=fake'],
    ['GET', '/api/v1/finance/checkouts/sepay/return/success'],
    ['GET', '/api/v1/finance/checkouts/sepay/return/error'],
    ['GET', '/api/v1/finance/checkouts/sepay/return/cancel'],
  ]) assert.equal(allowedRoute(method, route), true, method + ' ' + route);
});

test('do not expose demo identity or private checkout APIs through ngrok', () => {
  for (const [method, route] of [
    ['POST', '/api/v1/demo/login'],
    ['POST', '/api/v1/demo/refresh'],
    ['GET', '/api/v1/demo/status'],
    ['GET', '/api/v1/identity-access/me'],
    ['GET', '/api/v1/finance/checkouts/123'],
    ['POST', '/api/v1/finance/checkouts'],
    ['POST', '/api/v1/finance/checkouts/123/reconcile'],
    ['GET', '/api/v1/finance/checkouts/sepay/ipn'],
    ['POST', '/api/v1/finance/checkouts/sepay/return/success'],
    ['GET', '/api/v1/finance/checkouts/sepay/return/other'],
    ['GET', '/api/v1/finance/checkouts/sepay/../demo/login'],
    ['GET', '/api/v1/health'],
  ]) assert.equal(allowedRoute(method, route), false, method + ' ' + route);
});
