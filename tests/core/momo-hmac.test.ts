import assert from 'node:assert/strict';
import test from 'node:test';

import { HttpMomoPaymentClient } from '../../src/modules/payment-gateway/momo/momo-client';
import { momoCreateRaw, momoIpnRaw, signMomoRaw, signaturesMatch } from '../../src/modules/payment-gateway/momo/momo-hmac';

const secret = 'secret-key-for-tests';

test('MoMo create and IPN signatures are stable HMAC-SHA256', () => {
  const createRaw = momoCreateRaw({
    accessKey: 'access',
    amount: '4470000',
    extraData: '',
    ipnUrl: 'https://example.test/ipn',
    orderId: 'order-1',
    orderInfo: 'TROOI P203 ABC',
    partnerCode: 'TEST',
    redirectUrl: 'trooi://payment/momo',
    requestId: 'req-1',
    requestType: 'captureWallet',
  });
  const createSig = signMomoRaw(createRaw, secret);
  assert.equal(createSig, signMomoRaw(createRaw, secret));
  assert.equal(signaturesMatch(createSig, createSig), true);
  assert.equal(signaturesMatch(createSig, '00' + createSig.slice(2)), false);

  const ipnRaw = momoIpnRaw({
    accessKey: 'access',
    amount: '4470000',
    extraData: '',
    message: 'Successful.',
    orderId: 'order-1',
    orderInfo: 'TROOI P203 ABC',
    orderType: 'momo_wallet',
    partnerCode: 'TEST',
    payType: 'qr',
    requestId: 'req-1',
    responseTime: '1',
    resultCode: '0',
    transId: '1',
  });
  const client = new HttpMomoPaymentClient({
    partnerCode: 'TEST',
    accessKey: 'access',
    secretKey: secret,
    endpoint: 'https://test-payment.momo.vn',
    ipnUrl: 'https://example.test/ipn',
    redirectUrl: 'trooi://payment/momo',
  });
  assert.equal(
    client.verifyIpn({
      partnerCode: 'TEST',
      orderId: 'order-1',
      requestId: 'req-1',
      amount: 4470000,
      orderInfo: 'TROOI P203 ABC',
      orderType: 'momo_wallet',
      transId: 1,
      resultCode: 0,
      message: 'Successful.',
      payType: 'qr',
      responseTime: 1,
      extraData: '',
      signature: signMomoRaw(ipnRaw, secret),
    }),
    true,
  );
});
