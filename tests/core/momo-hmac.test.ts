import assert from 'node:assert/strict';
import test from 'node:test';
import fixtures from './fixtures/momo-signed-payloads.json';
import {
  momoCreateRaw,
  momoCreateResponseRaw,
  momoIpnRaw,
  signMomoRaw,
  signaturesMatch,
} from '../../src/modules/payment-gateway/momo/momo-hmac';

test('MoMo request, create response and IPN match independent immutable Python HMAC fixtures', () => {
  const response = fixtures.response.fields;
  const ipn = fixtures.ipn.fields;
  const raws = [
    momoCreateRaw(fixtures.request.fields),
    momoCreateResponseRaw({
      ...response,
      accessKey: 'access',
      amount: String(response.amount),
      responseTime: String(response.responseTime),
      resultCode: String(response.resultCode),
    }),
    momoIpnRaw({
      ...ipn,
      accessKey: 'access',
      amount: String(ipn.amount),
      responseTime: String(ipn.responseTime),
      resultCode: String(ipn.resultCode),
      transId: String(ipn.transId),
    }),
  ];
  for (const [index, fixture] of [fixtures.request, fixtures.response, fixtures.ipn].entries()) {
    assert.equal(raws[index], fixture.raw);
    assert.equal(signMomoRaw(raws[index], fixtures.secret), fixture.signature);
    assert.equal(signaturesMatch(fixture.signature, fixture.signature), true);
    assert.equal(signaturesMatch(fixture.signature, '00' + fixture.signature.slice(2)), false);
    assert.equal(signaturesMatch(fixture.signature, ''), false);
  }
});
