import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyMomoResult } from '../../src/modules/payment-gateway/momo/momo-result';

test('MoMo distinguishes create acceptance from settlement and authorization', () => {
  assert.equal(classifyMomoResult('CREATE', 0, true), 'CREATE_ACCEPTED');
  assert.equal(classifyMomoResult('PAYMENT_IPN', 0, true), 'PAYMENT_SUCCEEDED');
  assert.equal(classifyMomoResult('PAYMENT_IPN', 9000, true), 'PAYMENT_SUCCEEDED');
  assert.equal(classifyMomoResult('PAYMENT_IPN', 9000, false), 'PENDING');
  assert.equal(classifyMomoResult('CREATE', 9000, true), 'PENDING');
});

test('MoMo finality is an explicit payment applicable allowlist', () => {
  for (const stage of ['CREATE', 'PAYMENT_IPN'] as const) {
    for (const code of [1000, 7000, 7002])
      assert.equal(classifyMomoResult(stage, code, true), 'PENDING');
    for (const code of [
      98, 99, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1017, 1026, 4001, 4002, 4100,
    ]) {
      assert.equal(classifyMomoResult(stage, code, true), 'FINAL_FAILURE');
    }
    for (const code of [10, 11, 12, 13, 20, 21, 22, 42, 43, 45, 47]) {
      assert.equal(classifyMomoResult(stage, code, true), 'RETRYABLE_NON_FINAL');
    }
    // 2019 concerns orderGroupId, which this integration does not send; refund codes are other APIs.
    for (const code of [40, 41, 2019, 1080, 1081, 1088, -1, 9999, NaN, 0.5]) {
      assert.equal(classifyMomoResult(stage, code, true), 'RECONCILE');
    }
  }
});
