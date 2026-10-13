export function createIdentityTestBarrier(input: {
  participants: number;
  timeoutMs: number;
  timeoutError: Error;
}): { wait: () => Promise<void>; cancel: (error: unknown) => void } {
  if (
    !Number.isSafeInteger(input.participants) ||
    input.participants < 1 ||
    !Number.isSafeInteger(input.timeoutMs) ||
    input.timeoutMs < 1
  )
    throw new RangeError('Barrier requires positive participant count and deadline');
  let ready = 0,
    settled = false;
  let resolve!: () => void, reject!: (error: unknown) => void;
  const pending = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  // Setup failure may precede a peer's wait; later awaits still receive the rejection.
  void pending.catch(() => undefined);
  const timer = setTimeout(() => cancel(input.timeoutError), input.timeoutMs);
  function stop(): boolean {
    if (settled) return false;
    settled = true;
    clearTimeout(timer);
    return true;
  }
  function cancel(error: unknown): void {
    if (stop()) reject(error);
  }
  return {
    wait: () => {
      if (!settled && ++ready === input.participants && stop()) resolve();
      return pending;
    },
    cancel,
  };
}
