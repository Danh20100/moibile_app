import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

function walkTs(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walkTs(full) : full.endsWith('.ts') ? [full] : [];
  });
}

describe('access enforcement static audit', () => {
  it('has an authentication/authorization enforcement mechanism for non-public API routes', () => {
    const files = walkTs(join(process.cwd(), 'src'));
    const source = files.map((file) => readFileSync(file, 'utf8')).join('\n');
    const hasGuard = /APP_GUARD|useGlobalGuards|@UseGuards|implements\s+CanActivate/.test(source);

    assert.equal(
      hasGuard,
      true,
      'Swagger advertises bearer auth and identity-access owns permission decisions, but no Nest guard/global guard is wired into src/**.',
    );
  });
});
