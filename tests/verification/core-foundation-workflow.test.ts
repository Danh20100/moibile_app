import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepoFile } from '../conformance/erd3/support/source';

const WORKFLOW = '.github/workflows/backend-erd3-conformance.yml';

interface Step {
  name: string;
  body: string;
}

function steps(): Step[] {
  const source = readRepoFile(WORKFLOW).replace(/\r\n/g, '\n');
  return source
    .split(/\n(?=      - name: )/)
    .slice(1)
    .map((chunk) => ({ name: chunk.match(/- name: (.*)/)![1].trim(), body: chunk }));
}

function indexOfStep(predicate: (step: Step) => boolean, label: string): number {
  const index = steps().findIndex(predicate);
  assert.notEqual(index, -1, `workflow is missing step: ${label}`);
  return index;
}

const HARD_GATES: Array<[string, RegExp]> = [
  ['typecheck', /run: pnpm typecheck\b/],
  ['Core Foundation hard gate', /run: pnpm test:core-foundation\b/],
  ['database validators', /run: python -m unittest discover -s tests\/database -p 'test_\*\.py'/],
  [
    'Google identity regression',
    /run: pnpm exec tsx --test src\/integrations\/google-identity\/google-id-token-verifier\.spec\.ts/,
  ],
];

test('Core Foundation hard gates exist and cannot be tolerated failures', () => {
  for (const [label, pattern] of HARD_GATES) {
    const step = steps()[indexOfStep((s) => pattern.test(s.body), label)];
    assert.doesNotMatch(step.body, /continue-on-error/, `${label} must fail CI normally`);
  }
});

test('hard gates run before any baseline-classified suite', () => {
  const firstBaselined = indexOfStep((s) => /test:domain-contract:junit/.test(s.body), 'domain-contract JUnit run');
  for (const [label, pattern] of HARD_GATES) {
    assert.ok(indexOfStep((s) => pattern.test(s.body), label) < firstBaselined, `${label} must precede baselined suites`);
  }
});

test('only raw JUnit test commands may continue on error and each is classified by the exact baseline verifier', () => {
  for (const [script, file] of [
    ['test:domain-contract:junit', 'domain-contract.junit.xml'],
    ['test:full:junit', 'full-test.junit.xml'],
  ]) {
    const all = steps();
    const rawIndex = indexOfStep((s) => new RegExp(`pnpm ${script}\\b`).test(s.body), script);
    const classifierIndex = indexOfStep(
      (s) =>
        /node scripts\/verify-test-baseline\.mjs/.test(s.body) &&
        s.body.includes(`--junit ${file}`) &&
        s.body.includes('--baseline tests/conformance/erd3/expected-failures.json'),
      `${script} classifier`,
    );
    assert.ok(classifierIndex > rawIndex, `${script} classifier must run after the raw command`);
    assert.doesNotMatch(all[classifierIndex].body, /continue-on-error/, 'classifier steps must fail CI normally');
  }

  const tolerated = steps().filter((s) => /continue-on-error:\s*true/.test(s.body));
  assert.equal(tolerated.length, 2);
  for (const step of tolerated) {
    assert.match(step.body, /pnpm test:(domain-contract|full):junit\b/);
    assert.doesNotMatch(step.body, /verify-test-baseline/);
  }
});

test('reporter-dependent grep heuristics no longer classify expected failures', () => {
  const source = readRepoFile(WORKFLOW);
  assert.doesNotMatch(source, /\bgrep\b/);
  assert.doesNotMatch(source, /not ok|# fail/);
});

test('machine-readable results are uploaded as evidence', () => {
  const upload = steps()[indexOfStep((s) => /actions\/upload-artifact/.test(s.body), 'artifact upload')];
  assert.match(upload.body, /if: always\(\)/);
  assert.match(upload.body, /domain-contract\.junit\.xml/);
  assert.match(upload.body, /full-test\.junit\.xml/);
});
