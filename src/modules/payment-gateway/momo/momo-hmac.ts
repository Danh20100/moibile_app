import { createHmac, timingSafeEqual } from 'node:crypto';

export interface MomoCreateSignFields {
  accessKey: string;
  amount: string;
  extraData: string;
  ipnUrl: string;
  orderId: string;
  orderInfo: string;
  partnerCode: string;
  redirectUrl: string;
  requestId: string;
  requestType: string;
}

export interface MomoIpnSignFields {
  accessKey: string;
  amount: string;
  extraData: string;
  message: string;
  orderId: string;
  orderInfo: string;
  orderType: string;
  partnerCode: string;
  payType: string;
  requestId: string;
  responseTime: string;
  resultCode: string;
  transId: string;
}

export function signMomoRaw(raw: string, secretKey: string): string {
  return createHmac('sha256', secretKey).update(raw).digest('hex');
}

export interface MomoCreateResponseSignFields {
  accessKey: string;
  amount: string;
  message: string;
  orderId: string;
  partnerCode: string;
  payUrl: string;
  requestId: string;
  responseTime: string;
  resultCode: string;
}

export function momoCreateResponseRaw(fields: MomoCreateResponseSignFields): string {
  // Strict English captureWallet field set; EN/VI discrepancy requires provider clarification.
  return [
    `accessKey=${fields.accessKey}`,
    `amount=${fields.amount}`,
    `message=${fields.message}`,
    `orderId=${fields.orderId}`,
    `partnerCode=${fields.partnerCode}`,
    `payUrl=${fields.payUrl}`,
    `requestId=${fields.requestId}`,
    `responseTime=${fields.responseTime}`,
    `resultCode=${fields.resultCode}`,
  ].join('&');
}

export function momoCreateRaw(fields: MomoCreateSignFields): string {
  return [
    `accessKey=${fields.accessKey}`,
    `amount=${fields.amount}`,
    `extraData=${fields.extraData}`,
    `ipnUrl=${fields.ipnUrl}`,
    `orderId=${fields.orderId}`,
    `orderInfo=${fields.orderInfo}`,
    `partnerCode=${fields.partnerCode}`,
    `redirectUrl=${fields.redirectUrl}`,
    `requestId=${fields.requestId}`,
    `requestType=${fields.requestType}`,
  ].join('&');
}

export function momoIpnRaw(fields: MomoIpnSignFields): string {
  return [
    `accessKey=${fields.accessKey}`,
    `amount=${fields.amount}`,
    `extraData=${fields.extraData}`,
    `message=${fields.message}`,
    `orderId=${fields.orderId}`,
    `orderInfo=${fields.orderInfo}`,
    `orderType=${fields.orderType}`,
    `partnerCode=${fields.partnerCode}`,
    `payType=${fields.payType}`,
    `requestId=${fields.requestId}`,
    `responseTime=${fields.responseTime}`,
    `resultCode=${fields.resultCode}`,
    `transId=${fields.transId}`,
  ].join('&');
}

export function signaturesMatch(expected: string, provided: string): boolean {
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(provided, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}
