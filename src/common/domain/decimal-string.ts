export type DecimalString = string;

const NUMERIC_18_SCALE_2_NON_NEGATIVE = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;

export function isNumeric18Scale2NonNegative(value: string): boolean {
  return NUMERIC_18_SCALE_2_NON_NEGATIVE.test(value);
}
