export function isBillingDayRule(value: unknown): value is { day: number } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 1 && Object.hasOwn(record, 'day') &&
    Number.isInteger(record.day) && (record.day as number) >= 1 && (record.day as number) <= 31;
}

/** Returns a Vietnam calendar date. Unknown historical JSON stays readable and yields no inferred due date. */
export function resolveBillingDueDate(rule: unknown, year: number, month: number): string | null {
  if (!isBillingDayRule(rule) || !Number.isInteger(year) || year < 1 || year > 9999 ||
      !Number.isInteger(month) || month < 1 || month > 12) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(rule.day, lastDay)).padStart(2, '0')}`;
}
