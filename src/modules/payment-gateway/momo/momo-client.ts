import { ServiceUnavailableException } from '@nestjs/common';

import {
  momoCreateRaw,
  momoIpnRaw,
  signMomoRaw,
  signaturesMatch,
  type MomoIpnSignFields,
} from './momo-hmac';

export interface MomoConfig {
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  endpoint: string;
  ipnUrl: string;
  redirectUrl: string;
}

export interface MomoCreatePaymentInput {
  orderId: string;
  requestId: string;
  amountVnd: number;
  orderInfo: string;
  extraData?: string;
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

export interface MomoPaymentClient {
  createCaptureWallet(input: MomoCreatePaymentInput): Promise<MomoCreatePaymentResult>;
  verifyIpn(payload: MomoIpnPayload): boolean;
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

export function requireMomoConfig(config: MomoConfig): MomoConfig {
  if (!config.partnerCode || !config.accessKey || !config.secretKey || !config.ipnUrl) {
    throw new ServiceUnavailableException(
      'MoMo sandbox is not configured. Set MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY, and MOMO_IPN_URL.',
    );
  }
  return config;
}

export class HttpMomoPaymentClient implements MomoPaymentClient {
  constructor(private readonly config: MomoConfig) {}

  async createCaptureWallet(input: MomoCreatePaymentInput): Promise<MomoCreatePaymentResult> {
    const config = requireMomoConfig(this.config);
    const extraData = input.extraData ?? '';
    const amount = String(input.amountVnd);
    const requestType = 'captureWallet';
    const raw = momoCreateRaw({
      accessKey: config.accessKey,
      amount,
      extraData,
      ipnUrl: config.ipnUrl,
      orderId: input.orderId,
      orderInfo: input.orderInfo,
      partnerCode: config.partnerCode,
      redirectUrl: config.redirectUrl,
      requestId: input.requestId,
      requestType,
    });
    const body = {
      partnerCode: config.partnerCode,
      accessKey: config.accessKey,
      requestId: input.requestId,
      amount,
      orderId: input.orderId,
      orderInfo: input.orderInfo,
      redirectUrl: config.redirectUrl,
      ipnUrl: config.ipnUrl,
      extraData,
      requestType,
      lang: 'vi',
      signature: signMomoRaw(raw, config.secretKey),
    };
    const response = await fetch(`${config.endpoint.replace(/\/$/, '')}/v2/gateway/api/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as {
      resultCode?: number;
      message?: string;
      payUrl?: string;
      deeplink?: string;
    };
    return {
      resultCode: payload.resultCode ?? -1,
      message: payload.message ?? 'MoMo create failed',
      payUrl: payload.payUrl ?? null,
      deeplink: payload.deeplink ?? null,
    };
  }

  verifyIpn(payload: MomoIpnPayload): boolean {
    const config = requireMomoConfig(this.config);
    const fields: MomoIpnSignFields = {
      accessKey: config.accessKey,
      amount: String(payload.amount ?? ''),
      extraData: payload.extraData ?? '',
      message: payload.message ?? '',
      orderId: payload.orderId,
      orderInfo: payload.orderInfo ?? '',
      orderType: payload.orderType ?? '',
      partnerCode: payload.partnerCode ?? config.partnerCode,
      payType: payload.payType ?? '',
      requestId: payload.requestId,
      responseTime: String(payload.responseTime ?? ''),
      resultCode: String(payload.resultCode ?? ''),
      transId: String(payload.transId ?? ''),
    };
    const expected = signMomoRaw(momoIpnRaw(fields), config.secretKey);
    return signaturesMatch(expected, payload.signature ?? '');
  }
}
