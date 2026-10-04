export type MomoResultOutcome =
  | 'CREATE_ACCEPTED'
  | 'PAYMENT_SUCCEEDED'
  | 'PENDING'
  | 'FINAL_FAILURE'
  | 'RETRYABLE_NON_FINAL'
  | 'RECONCILE';

export function classifyMomoResult(
  stage: 'CREATE' | 'PAYMENT_IPN',
  resultCode: number,
  autoCapture: boolean,
): MomoResultOutcome {
  if (resultCode === 0) return stage === 'CREATE' ? 'CREATE_ACCEPTED' : 'PAYMENT_SUCCEEDED';
  if (resultCode === 9000)
    return stage === 'PAYMENT_IPN' && autoCapture ? 'PAYMENT_SUCCEEDED' : 'PENDING';
  if ([1000, 7000, 7002].includes(resultCode)) return 'PENDING';
  if (
    [98, 99, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1017, 1026, 4001, 4002, 4100].includes(
      resultCode,
    )
  )
    return 'FINAL_FAILURE';
  if ([10, 11, 12, 13, 20, 21, 22, 42, 43, 45, 47].includes(resultCode))
    return 'RETRYABLE_NON_FINAL';
  // orderGroupId (2019), refund, duplicate and unknown outcomes cannot settle this one-step payment.
  return 'RECONCILE';
}
