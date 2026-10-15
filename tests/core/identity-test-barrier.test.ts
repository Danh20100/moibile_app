import assert from 'node:assert/strict';
import test from 'node:test';
import { createIdentityTestBarrier } from '../integration/persistence/support/identity-test-barrier';
import { loadPersistenceScenarios } from '../support/identity-fixtures';
const F = loadPersistenceScenarios();
const barrier = () =>
  createIdentityTestBarrier({
    participants: F.configuration.barrierParticipants,
    timeoutMs: F.configuration.barrierTimeoutMs,
    timeoutError: new Error(F.errors.barrierTimeout),
  });
test('setup failure cancels waiting and late-arriving peers with the same cause', async () => {
  const gate = barrier();
  const cause = new Error(F.errors.staleState);
  const waiting = gate.wait();
  gate.cancel(cause);
  await assert.rejects(waiting, (error) => error === cause);
  await assert.rejects(gate.wait(), (error) => error === cause);
});
test('barrier opens only after all actors arrive; later cancellation cannot alter completion', async () => {
  const gate = barrier();
  let finished = false;
  const first = gate.wait().then(() => {
    finished = true;
  });
  await Promise.resolve();
  assert.equal(finished, false);
  await Promise.all([
    first,
    ...Array.from({ length: F.configuration.barrierParticipants - 1 }, () => gate.wait()),
  ]);
  gate.cancel(new Error(F.errors.staleState));
  await gate.wait();
  assert.equal(finished, true);
});
test('watchdog reports stalled setup instead of leaving an unbounded wait', async () => {
  const gate = barrier();
  await assert.rejects(gate.wait(), new RegExp(F.errors.barrierTimeout));
});

test('cancellation before any arrival rejects later waiters without an unhandled promise', async () => {
  const gate = barrier();
  const cause = new Error(F.errors.staleState);
  gate.cancel(cause);
  await assert.rejects(gate.wait(), (error) => error === cause);
});
