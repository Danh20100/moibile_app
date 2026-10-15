import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

export function readRepoFiles(relativePaths: readonly string[]): string {
  return relativePaths.map((path) => readRepoFile(path)).join('\n');
}

export function assertContainsAll(source: string, tokens: readonly string[]): void {
  for (const token of tokens) {
    assert.ok(source.includes(token), `Expected source to contain token: ${token}`);
  }
}

export function assertContainsNone(source: string, tokens: readonly string[]): void {
  for (const token of tokens) {
    assert.ok(!source.includes(token), `Expected source not to contain token: ${token}`);
  }
}
