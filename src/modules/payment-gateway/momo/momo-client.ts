import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  momoCreateRaw,
  momoCreateResponseRaw,
  momoIpnRaw,
  signMomoRaw,
  signaturesMatch,
} from './momo-hmac';
import { classifyMomoResult } from './momo-result';
import type { MomoRequestSnapshot } from '../../../persistence/ports/gateway-checkout.types';
export type { MomoRequestSnapshot } from '../../../persistence/ports/gateway-checkout.types';

export interface MomoConfig {
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  endpoint: string;
  ipnUrl: string;
  redirectUrl: string;
}

export class MomoVerificationError extends BadGatewayException {}

export interface MomoCreatePaymentInput {
  snapshot?: MomoRequestSnapshot;
  orderId: string;
  requestId: string;
  amountVnd: number | string;
  orderInfo: string;
  checkoutId: string;
}

export interface MomoCreatePaymentResult {
  resultCode: number;
  message: string;
  payUrl: string | null;
  deeplink: string | null;
}

export interface MomoIpnPayload {
  partnerCode?: string;
  orderId: string;
  requestId: string;
  amount: number | string;
  orderInfo?: string;
  orderType?: string;
  transId?: number | string;
  resultCode: number | string;
  message?: string;
  payType?: string;
  responseTime?: number | string;
  extraData?: string;
  signature: string;
}

export interface MomoIpnExpectation {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amountVnd: number | string;
  extraData: string;
}

export interface MomoPaymentClient {
  snapshot(checkoutId: string): MomoRequestSnapshot;
  createCaptureWallet(input: MomoCreatePaymentInput): Promise<MomoCreatePaymentResult>;
  verifyIpn(payload: unknown, expected?: MomoIpnExpectation): boolean;
}

export const MOMO_PAYMENT_CLIENT = Symbol('MOMO_PAYMENT_CLIENT');

export function loadMomoConfig(env: NodeJS.ProcessEnv): MomoConfig {
  return {
    partnerCode: env.MOMO_PARTNER_CODE?.trim() ?? '',
    accessKey: env.MOMO_ACCESS_KEY?.trim() ?? '',
    secretKey: env.MOMO_SECRET_KEY?.trim() ?? '',
    endpoint: env.MOMO_ENDPOINT?.trim() || 'https://test-payment.momo.vn',
    ipnUrl: env.MOMO_IPN_URL?.trim() ?? '',
    redirectUrl: env.MOMO_REDIRECT_URL?.trim() || 'trooi://payment/momo',
  };
}

function validUrl(value: string, protocols: string[]): URL | null {
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function requireMomoConfig(config: MomoConfig): MomoConfig {
  const endpoint = validUrl(config.endpoint, ['https:']);
  if (
    !config.partnerCode ||
    !config.accessKey ||
    !config.secretKey ||
    !validUrl(config.ipnUrl, ['https:']) ||
    !validUrl(config.redirectUrl, ['https:', 'trooi:']) ||
    !endpoint ||
    !['test-payment.momo.vn', 'payment.momo.vn'].includes(endpoint.hostname) ||
    endpoint.port ||
    endpoint.pathname !== '/' ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new ServiceUnavailableException(
      'MoMo optional channel is unavailable: incomplete or invalid configuration',
    );
  }
  return config;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function integer(value: unknown): string | null {
  if (typeof value === 'number')
    return Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
  return typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) ? value : null;
}

function amount(value: unknown): number | null {
  // Decimal strings are converted exactly before Number; the VND ceiling is safely representable.
  const decimal = typeof value === 'string' ? value : integer(value);
  if (decimal === null || !/^(0|[1-9]\d*)(\.0{1,2})?$/.test(decimal)) return null;
  const whole = BigInt(decimal.split('.')[0]);
  return whole >= 1000n && whole <= 50000000n ? Number(whole) : null;
}

export class HttpMomoPaymentClient implements MomoPaymentClient {
  constructor(private readonly config: MomoConfig) {}

  snapshot(checkoutId: string): MomoRequestSnapshot {
    const config = requireMomoConfig(this.config);
    return {
      partnerCode: config.partnerCode,
      endpoint: config.endpoint,
      ipnUrl: config.ipnUrl,
      redirectUrl: config.redirectUrl,
      extraData: Buffer.from(JSON.stringify({ checkoutId }), 'utf8').toString('base64'),
      requestType: 'captureWallet',
      autoCapture: true,
    };
  }

  async createCaptureWallet(input: MomoCreatePaymentInput): Promise<MomoCreatePaymentResult> {
    const config = requireMomoConfig(this.config);
    const snapshot = input.snapshot ?? this.snapshot(input.checkoutId);
    if (snapshot.partnerCode !== config.partnerCode || snapshot.endpoint !== config.endpoint)
      throw new ServiceUnavailableException('MoMo snapshot configuration mismatch');
    const amountVnd = amount(input.amountVnd);
    if (
      amountVnd === null ||
      typeof input.checkoutId !== 'string' ||
      !input.checkoutId ||
      typeof input.orderId !== 'string' ||
      !/^[0-9a-zA-Z]([-_.]*[0-9a-zA-Z]+)*$/.test(input.orderId) ||
      input.orderId.length > 64 ||
      typeof input.requestId !== 'string' ||
      !input.requestId ||
      input.requestId.length > 50 ||
      typeof input.orderInfo !== 'string' ||
      !input.orderInfo ||
      input.orderInfo.length > 255
    ) {
      throw new BadRequestException('Invalid MoMo captureWallet input');
    }
    const extraData = snapshot.extraData;
    if (extraData.length > 1000) throw new BadRequestException('MoMo extraData is too long');
    const fields = {
      accessKey: config.accessKey,
      amount: String(amountVnd),
      extraData,
      ipnUrl: snapshot.ipnUrl,
      orderId: input.orderId,
      orderInfo: input.orderInfo,
      partnerCode: config.partnerCode,
      redirectUrl: snapshot.redirectUrl,
      requestId: input.requestId,
      requestType: snapshot.requestType,
    };
    const response = await fetch(`${config.endpoint.replace(/\/$/, '')}/v2/gateway/api/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(35000),
      body: JSON.stringify({
        ...fields,
        amount: amountVnd,
        autoCapture: snapshot.autoCapture,
        lang: 'vi',
        signature: signMomoRaw(momoCreateRaw(fields), config.secretKey),
      }),
    });
    if (!response.ok) throw new BadGatewayException('MoMo create HTTP response is unsuccessful');
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new MomoVerificationError('MoMo create response verification failed');
      throw error;
    }
    if (
      !record(payload) ||
      typeof payload.partnerCode !== 'string' ||
      typeof payload.orderId !== 'string' ||
      typeof payload.requestId !== 'string' ||
      typeof payload.message !== 'string' ||
      typeof payload.payUrl !== 'string' ||
      typeof payload.signature !== 'string' ||
      typeof payload.resultCode !== 'number' ||
      !Number.isSafeInteger(payload.resultCode) ||
      integer(payload.responseTime) === null ||
      integer(payload.amount) === null ||
      payload.partnerCode !== config.partnerCode ||
      payload.orderId !== input.orderId ||
      payload.requestId !== input.requestId ||
      integer(payload.amount) !== String(amountVnd)
    ) {
      throw new MomoVerificationError('MoMo create response verification failed');
    }
    const raw = momoCreateResponseRaw({
      accessKey: config.accessKey,
      amount: String(payload.amount),
      message: payload.message,
      orderId: payload.orderId,
      partnerCode: payload.partnerCode,
      payUrl: payload.payUrl,
      requestId: payload.requestId,
      responseTime: String(payload.responseTime),
      resultCode: String(payload.resultCode),
    });
    if (!signaturesMatch(signMomoRaw(raw, config.secretKey), payload.signature))
      throw new MomoVerificationError('MoMo create response verification failed');
    if (payload.payUrl) {
      const url = validUrl(payload.payUrl, ['https:']);
      if (!url || url.hostname !== new URL(config.endpoint).hostname || url.port)
        throw new MomoVerificationError('MoMo payment URL verification failed');
    } else if (payload.resultCode === 0) {
      throw new MomoVerificationError('MoMo accepted response is missing payment URL');
    }
    // deeplink is not in the signed response field set; only the verified web URL can be launched.
    return {
      resultCode: payload.resultCode,
      message: payload.message,
      payUrl: payload.payUrl || null,
      deeplink: null,
    };
  }

  verifyIpn(payload: unknown, expected?: MomoIpnExpectation): boolean {
    const config = requireMomoConfig(this.config);
    if (!record(payload)) return false;
    const {
      partnerCode,
      orderId,
      requestId,
      orderInfo,
      orderType,
      message,
      payType,
      extraData,
      signature,
    } = payload;
    if (
      typeof partnerCode !== 'string' ||
      partnerCode !== config.partnerCode ||
      typeof orderId !== 'string' ||
      !orderId ||
      typeof requestId !== 'string' ||
      !requestId ||
      typeof orderInfo !== 'string' ||
      typeof orderType !== 'string' ||
      orderType !== 'momo_wallet' ||
      typeof message !== 'string' ||
      typeof payType !== 'string' ||
      typeof extraData !== 'string' ||
      typeof signature !== 'string'
    )
      return false;
    const amountVnd = integer(payload.amount);
    const responseTime = integer(payload.responseTime);
    const resultCode = integer(payload.resultCode);
    const transId = integer(payload.transId);
    if (
      amountVnd === null ||
      amount(amountVnd) === null ||
      responseTime === null ||
      resultCode === null ||
      transId === null
    )
      return false;
    if (
      BigInt(resultCode) > 2147483647n ||
      (classifyMomoResult('PAYMENT_IPN', Number(resultCode), true) === 'PAYMENT_SUCCEEDED' &&
        transId === '0')
    )
      return false;
    if (
      expected &&
      (partnerCode !== expected.partnerCode ||
        orderId !== expected.orderId ||
        requestId !== expected.requestId ||
        amountVnd !== String(amount(expected.amountVnd)) ||
        extraData !== expected.extraData)
    )
      return false;
    const raw = momoIpnRaw({
      accessKey: config.accessKey,
      amount: amountVnd,
      extraData,
      message,
      orderId,
      orderInfo,
      orderType,
      partnerCode,
      payType,
      requestId,
      responseTime,
      resultCode,
      transId,
    });
    return signaturesMatch(signMomoRaw(raw, config.secretKey), signature);
  }
}
