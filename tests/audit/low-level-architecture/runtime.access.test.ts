import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';

function parseDotEnv(filePath: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  if (!existsSync(filePath)) return parsed;
  for (const raw of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function fillMissingFromDotEnv(): Record<string, string> {
  const fromFile = parseDotEnv(join(process.cwd(), '.env'));
  const filled: Record<string, string> = {};
  for (const [key, value] of Object.entries(fromFile)) {
    if (!process.env[key]?.trim() && value) filled[key] = value;
  }
  return filled;
}

function requireDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'DATABASE_URL is required for runtime HTTP access audit. Set it or add it to .env; this test does not inherit a previous e2e shell.',
    );
  }
  return url;
}

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not reserve a TCP port'));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForServer(
  url: string,
  child: ChildProcess,
  getStderr: () => string,
): Promise<void> {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(
        `Server process exited prematurely with code ${child.exitCode}. Output: ${getStderr()}`,
      );
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not become ready: ${url}. Output: ${getStderr()}`);
}

function stopChild(child: ChildProcess | undefined): void {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  child.kill('SIGTERM');
}

describe('runtime HTTP access audit', () => {
  let child: ChildProcess;
  let baseUrl: string;

  before(async () => {
    const filled = fillMissingFromDotEnv();
    const env: NodeJS.ProcessEnv = { ...process.env, ...filled };
    const databaseUrl = requireDatabaseUrl(env);
    const port = await reservePort();
    baseUrl = `http://127.0.0.1:${port}`;
    let stderr = '';
    child = spawn(process.execPath, ['build/main.js'], {
      cwd: process.cwd(),
      env: {
        ...env,
        PORT: String(port),
        DATABASE_URL: databaseUrl,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    await waitForServer(`${baseUrl}/api/v1/health`, child, () => stderr);
  });

  after(() => {
    stopChild(child);
  });

  it('keeps the health endpoint public', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(response.status, 200);
  });

  it('blocks unauthenticated access to private organization data', async () => {
    const response = await fetch(`${baseUrl}/api/v1/organizations`);
    assert.ok(
      response.status === 401 || response.status === 403,
      `Expected 401/403 for a private route, received ${response.status}.`,
    );
  });

  it('rejects arbitrary non-empty bearer tokens with 401', async () => {
    const response = await fetch(`${baseUrl}/api/v1/organizations`, {
      headers: {
        Authorization: 'Bearer arbitrary-unverified-token-12345',
      },
    });
    assert.equal(response.status, 401);
  });

  it('keeps public listing discovery reachable without authentication', async () => {
    const response = await fetch(`${baseUrl}/api/v1/listings/public`);
    assert.equal(response.status, 200);
  });
});
