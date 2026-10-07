import { createHmac } from 'node:crypto';

export const SEPAY_SANDBOX_CHECKOUT_URL = 'https://pay-sandbox.sepay.vn/v1/checkout/init';
export const SEPAY_SANDBOX_API_ORIGIN = 'https://pgapi-sandbox.sepay.vn';

type SepayFields = Readonly<Record<string, string | number | null | undefined>>;

// Pinned SDK 62178220f36cda2f6657731ef182ecd84dd67e2f/src/checkout.ts.
// Source algorithm only: these fields do not authorize application features or transport.
const signedFields = new Set([
  'merchant',
  'env',
  'operation',
  'payment_method',
  'order_amount',
  'currency',
  'order_invoice_number',
  'order_description',
  'customer_id',
  'agreement_id',
  'agreement_name',
  'agreement_type',
  'agreement_payment_frequency',
  'agreement_amount_per_payment',
  'success_url',
  'error_url',
  'cancel_url',
  'order_id',
]);

export function sepayFormRaw(orderedFields: SepayFields): string {
  return Object.entries(orderedFields)
    .filter(([key, value]) => signedFields.has(key) && value !== undefined)
    .map(([key, value]) => `${key}=${value ?? ''}`)
    .join(',');
}

export function signSepayFields(orderedFields: SepayFields, secret: string): string {
  return createHmac('sha256', secret).update(sepayFormRaw(orderedFields), 'utf8').digest('base64');
}
