import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { after, before, describe, it } from 'node:test';

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
  for (let attempt = 0; attempt < 150; attempt += 1) {
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

describe('runtime HTTP access audit', () => {
  let child: ChildProcess;
  let baseUrl: string;

  before(async () => {
    const port = await reservePort();
    baseUrl = `http://127.0.0.1:${port}`;
    let stderr = '';
    child = spawn(process.execPath, ['build/main.js'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        DATABASE_URL:
          process.env.DATABASE_URL?.trim() ||
          'postgresql://trooi:trooi_local@localhost:5432/trooi_dev',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    await waitForServer(`${baseUrl}/api/v1/health`, child, () => stderr);
  });

  after(() => {
    child.kill();
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

  it('keeps public listing discovery reachable without authentication', async () => {
    const response = await fetch(`${baseUrl}/api/v1/listings/public`);
    assert.equal(response.status, 200);
  });
});
