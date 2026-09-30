#!/usr/bin/env node
// Exact-set classifier: a JUnit result (Node built-in junit reporter) is accepted only when its
// failing testcase names equal the committed expected-failure baseline. Everything else fails closed.
import { existsSync, readFileSync } from 'node:fs';

class ClassificationError extends Error {}

function fail(message) {
  throw new ClassificationError(message);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!['--junit', '--baseline', '--suite', '--exit-code'].includes(key)) {
      fail(`unknown argument: ${key}`);
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) fail(`missing value for ${key}`);
    args[key.slice(2)] = value;
    i += 1;
  }
  for (const required of ['junit', 'baseline', 'suite']) {
    if (!args[required]) fail(`--${required} is required`);
  }
  if (args['exit-code'] !== undefined && !/^-?\d+$/.test(args['exit-code'])) {
    fail(`--exit-code must be an integer, got ${args['exit-code']}`);
  }
  return args;
}

function decodeXml(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    const lower = entity.toLowerCase();
    if (lower === 'amp') return '&';
    if (lower === 'lt') return '<';
    if (lower === 'gt') return '>';
    if (lower === 'quot') return '"';
    if (lower === 'apos') return "'";
    if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16));
    return String.fromCodePoint(parseInt(lower.slice(1), 10));
  });
}

function parseAttributes(raw) {
  const attributes = {};
  const pattern = /\s+([\w:.-]+)="([^"]*)"/g;
  let consumed = 0;
  let match;
  while ((match = pattern.exec(raw)) !== null) {
    if (match.index !== consumed) break;
    attributes[match[1]] = decodeXml(match[2]);
    consumed = pattern.lastIndex;
  }
  if (raw.slice(consumed).trim() !== '') fail(`malformed testcase attributes: ${raw.slice(0, 120)}`);
  return attributes;
}

function parseJunit(path) {
  if (!existsSync(path)) fail(`JUnit result file not found: ${path}`);
  const xml = readFileSync(path, 'utf8');
  if (!/<testsuites\b[^>]*>/.test(xml) || !/<\/testsuites>\s*$/.test(xml)) {
    fail('JUnit result is missing a complete <testsuites> root');
  }

  const totals = {};
  for (const key of ['tests', 'pass', 'fail', 'cancelled']) {
    const matches = [...xml.matchAll(new RegExp(`<!-- ${key} (\\d+) -->`, 'g'))];
    if (matches.length !== 1) fail(`JUnit completion metadata "${key}" is missing or duplicated`);
    totals[key] = Number(matches[0][1]);
  }

  const testcases = [];
  const openTag = /<testcase((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>/g;
  let match;
  while ((match = openTag.exec(xml)) !== null) {
    const attributes = parseAttributes(match[1]);
    if (typeof attributes.name !== 'string') fail('testcase without name attribute');
    let body = '';
    if (match[2] !== '/') {
      const close = xml.indexOf('</testcase>', openTag.lastIndex);
      if (close === -1) fail(`unterminated testcase: ${attributes.name}`);
      body = xml.slice(openTag.lastIndex, close);
      openTag.lastIndex = close + '</testcase>'.length;
    }
    const failed = /<(failure|error)\b/.test(body);
    testcases.push({ name: attributes.name.trim(), failed });
  }

  const rawTestcaseTags = (xml.match(/<testcase\b/g) ?? []).length;
  if (rawTestcaseTags !== testcases.length) fail('JUnit contains testcase elements that could not be parsed');
  if (testcases.length === 0) fail('JUnit contains no testcase elements');
  if (testcases.length !== totals.tests) {
    fail(`JUnit totals inconsistent: ${testcases.length} testcases but metadata tests=${totals.tests}`);
  }
  const failedCount = testcases.filter((t) => t.failed).length;
  if (failedCount !== totals.fail + totals.cancelled) {
    fail(
      `JUnit totals inconsistent: ${failedCount} failing testcases but metadata fail=${totals.fail} cancelled=${totals.cancelled}`,
    );
  }
  return { testcases, totals };
}

function loadBaseline(path) {
  if (!existsSync(path)) fail(`baseline file not found: ${path}`);
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`baseline is not valid JSON: ${error.message}`);
  }
  if (data === null || typeof data !== 'object' || data.version !== 1 || !Array.isArray(data.expectedFailures)) {
    fail('baseline must be { "version": 1, "expectedFailures": [...] }');
  }
  const names = [];
  data.expectedFailures.forEach((entry, index) => {
    for (const field of ['name', 'owner', 'reason']) {
      if (typeof entry?.[field] !== 'string' || entry[field].trim() === '') {
        fail(`baseline entry #${index} must have non-empty string "${field}"`);
      }
    }
    names.push(entry.name.trim());
  });
  const duplicates = names.filter((name, i) => names.indexOf(name) !== i);
  if (duplicates.length > 0) fail(`baseline contains duplicate names:\n  - ${[...new Set(duplicates)].join('\n  - ')}`);
  return new Set(names);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const expected = loadBaseline(args.baseline);
  const { testcases, totals } = parseJunit(args.junit);

  const observedNames = testcases.filter((t) => t.failed).map((t) => t.name);
  const duplicates = observedNames.filter((name, i) => observedNames.indexOf(name) !== i);
  if (duplicates.length > 0) {
    fail(`observed failures have ambiguous duplicate names:\n  - ${[...new Set(duplicates)].join('\n  - ')}`);
  }
  const observed = new Set(observedNames);

  if (args['exit-code'] !== undefined) {
    const exitCode = Number(args['exit-code']);
    if (exitCode !== 0 && observed.size === 0) {
      fail(`test command exited ${exitCode} without any failing testcase (harness/command failure)`);
    }
    if (exitCode === 0 && observed.size > 0) {
      fail(`test command exited 0 but ${observed.size} failing testcases were reported`);
    }
  }

  const unexpected = [...observed].filter((name) => !expected.has(name));
  const missing = [...expected].filter((name) => !observed.has(name));
  const matched = [...observed].filter((name) => expected.has(name));

  console.log(`[${args.suite}] tests=${totals.tests} pass=${totals.pass} fail=${totals.fail} cancelled=${totals.cancelled}`);
  console.log(`[${args.suite}] matched expected failures: ${matched.length}/${expected.size}`);

  if (unexpected.length > 0 || missing.length > 0) {
    if (unexpected.length > 0) {
      console.error(`[${args.suite}] unexpected failures (${unexpected.length}):\n  - ${unexpected.join('\n  - ')}`);
    }
    if (missing.length > 0) {
      console.error(
        `[${args.suite}] missing expected failures (${missing.length}) — reconcile the baseline:\n  - ${missing.join('\n  - ')}`,
      );
    }
    process.exit(1);
  }
  console.log(`[${args.suite}] PASS — observed failures exactly match the committed baseline`);
}

try {
  main();
} catch (error) {
  const message = error instanceof ClassificationError ? error.message : error?.stack ?? String(error);
  console.error(`verify-test-baseline: ${message}`);
  process.exit(2);
}
