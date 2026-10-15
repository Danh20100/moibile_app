import { data as D } from '../support/momo-hmac-fixtures';
import assert from 'node:assert/strict';
import test from 'node:test';
import type fixturesType from '../fixtures/payment/momo-signed-payloads.json';
import { loadFixture } from '../support/fixture-loader';
const fixtures = loadFixture<typeof fixturesType>('payment/momo-signed-payloads');
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
      accessKey: D.values.accessKey,
      amount: String(response.amount),
      responseTime: String(response.responseTime),
      resultCode: String(response.resultCode),
    }),
    momoIpnRaw({
      ...ipn,
      accessKey: D.values.accessKey2,
      amount: String(ipn.amount),
      responseTime: String(ipn.responseTime),
      resultCode: String(ipn.resultCode),
      transId: String(ipn.transId),
    }),
  ];
  for (const [index, fixture] of [fixtures.request, fixtures.response, fixtures.ipn].entries()) {
    assert.equal(raws[index], fixture.raw);
    assert.equal(signMomoRaw(raws[index], fixtures.secret), fixture.signature);
    assert.equal(signaturesMatch(fixture.signature, fixture.signature), D.values.equalScenario);
    assert.equal(
      signaturesMatch(fixture.signature, D.values.scenarioValue + fixture.signature.slice(2)),
      D.values.equalScenario2,
    );
    assert.equal(
      signaturesMatch(fixture.signature, D.values.signaturesMatchScenario),
      D.values.equalScenario3,
    );
  }
});
