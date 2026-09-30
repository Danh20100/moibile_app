import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const SCRIPT = resolve(__dirname, '../../scripts/verify-test-baseline.mjs');

interface CaseSpec {
  name: string;
  failed?: boolean;
}

function junit(cases: CaseSpec[], totals?: Partial<Record<'tests' | 'pass' | 'fail', number>>): string {
  const fail = cases.filter((c) => c.failed).length;
  const tests = totals?.tests ?? cases.length;
  const pass = totals?.pass ?? cases.length - fail;
  const failCount = totals?.fail ?? fail;
  const body = cases
    .map((c) =>
      c.failed
        ? `\t<testcase name="${c.name}" time="0.001" classname="test" file="x.test.ts" failure="boom">\n` +
          `\t\t<failure type="testCodeFailure" message="boom">\n[Error: boom] &lt;anonymous>\n\t\t</failure>\n` +
          `\t</testcase>`
        : `\t<testcase name="${c.name}" time="0.001" classname="test" file="x.test.ts"/>`,
    )
    .join('\n');
  return (
    `<?xml version="1.0" encoding="utf-8"?>\n<testsuites>\n${body}\n` +
    `\t<!-- tests ${tests} -->\n\t<!-- suites 0 -->\n\t<!-- pass ${pass} -->\n\t<!-- fail ${failCount} -->\n` +
    `\t<!-- cancelled 0 -->\n\t<!-- skipped 0 -->\n\t<!-- todo 0 -->\n\t<!-- duration_ms 1 -->\n</testsuites>\n`
  );
}

function baseline(names: string[]): string {
  return JSON.stringify({
    version: 1,
    expectedFailures: names.map((name) => ({ name, owner: 'Wave B Listing/Tenancy', reason: 'deferred' })),
  });
}

function run(files: { junit?: string; baseline?: string }, extraArgs: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), 'baseline-classifier-'));
  try {
    const junitPath = join(dir, 'result.junit.xml');
    const baselinePath = join(dir, 'baseline.json');
    if (files.junit !== undefined) writeFileSync(junitPath, files.junit);
    if (files.baseline !== undefined) writeFileSync(baselinePath, files.baseline);
    return spawnSync(
      process.execPath,
      [SCRIPT, '--junit', junitPath, '--baseline', baselinePath, '--suite', 'fixture', ...extraArgs],
      { encoding: 'utf8' },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const EXPECTED = ['LISTING lifecycle is DRAFT PUBLISHED UNPUBLISHED ARCHIVED only', 'Receipt is not the payment record'];

test('accepts exact expected failure set', () => {
  const result = run({
    junit: junit([{ name: 'core passes' }, ...EXPECTED.map((name) => ({ name, failed: true }))]),
    baseline: baseline(EXPECTED),
  });
  assert.equal(result.status, 0, result.stderr + result.stdout);
});

test('accepts XML-escaped testcase names by decoding them', () => {
  const name = 'allocation & deposit <cannot> cross "Tenancy"';
  const result = run({
    junit: junit([{ name: 'allocation &amp; deposit &lt;cannot> cross &quot;Tenancy&quot;', failed: true }]),
    baseline: baseline([name]),
  });
  assert.equal(result.status, 0, result.stderr + result.stdout);
});

test('rejects an unexpected additional failure', () => {
  const result = run({
    junit: junit([...EXPECTED.map((name) => ({ name, failed: true })), { name: 'Room regression', failed: true }]),
    baseline: baseline(EXPECTED),
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unexpected[\s\S]*Room regression/i);
});

test('rejects a missing expected failure', () => {
  const result = run({
    junit: junit([{ name: EXPECTED[0], failed: true }, { name: EXPECTED[1] }]),
    baseline: baseline(EXPECTED),
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing[\s\S]*Receipt is not the payment record/i);
});

test('rejects malformed JUnit', () => {
  const result = run({ junit: '<testsuites><testcase name="x"', baseline: baseline(EXPECTED) });
  assert.notEqual(result.status, 0);
});

test('rejects JUnit with inconsistent totals', () => {
  const result = run({
    junit: junit(EXPECTED.map((name) => ({ name, failed: true })), { fail: 1 }),
    baseline: baseline(EXPECTED),
  });
  assert.notEqual(result.status, 0);
});

test('rejects missing JUnit file', () => {
  const result = run({ baseline: baseline(EXPECTED) });
  assert.notEqual(result.status, 0);
});

test('rejects duplicate baseline names', () => {
  const result = run({
    junit: junit(EXPECTED.map((name) => ({ name, failed: true }))),
    baseline: baseline([...EXPECTED, EXPECTED[0]]),
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /duplicate/i);
});

test('rejects malformed baseline entries', () => {
  const result = run({
    junit: junit(EXPECTED.map((name) => ({ name, failed: true }))),
    baseline: JSON.stringify({ version: 1, expectedFailures: EXPECTED.map((name) => ({ name })) }),
  });
  assert.notEqual(result.status, 0);
});

test('rejects fully green result while baseline is non-empty', () => {
  const result = run({
    junit: junit(EXPECTED.map((name) => ({ name }))),
    baseline: baseline(EXPECTED),
  });
  assert.notEqual(result.status, 0);
});

test('accepts fully green result only when baseline is empty', () => {
  const result = run({ junit: junit([{ name: 'core passes' }]), baseline: baseline([]) });
  assert.equal(result.status, 0, result.stderr + result.stdout);
});

test('rejects nonzero exit code without any observed test failure', () => {
  const result = run({ junit: junit([{ name: 'core passes' }]), baseline: baseline([]) }, ['--exit-code', '1']);
  assert.notEqual(result.status, 0);
});

test('rejects zero exit code while failures were observed', () => {
  const result = run(
    { junit: junit(EXPECTED.map((name) => ({ name, failed: true }))), baseline: baseline(EXPECTED) },
    ['--exit-code', '0'],
  );
  assert.notEqual(result.status, 0);
});
