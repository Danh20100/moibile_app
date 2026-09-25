import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('test discovery audit', () => {
  it('includes repository audit tests in the default test command', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const testScript = pkg.scripts?.test ?? '';

    assert.match(
      testScript,
      /tests\//,
      'The default test command only discovers src/**/*.spec.ts; tests/audit/** can be silently skipped by CI/developers.',
    );
  });
});
