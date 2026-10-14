import assert from 'node:assert/strict';
import express from 'express';
import test from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { API_PREFIX, applyHttpBodyParsers } from '../../src/common';

test('profile avatar JSON size allowance is route-local and accepts the 2 MB base64 boundary', async () => {
  const app = express();
  applyHttpBodyParsers({ getHttpAdapter: () => ({ getInstance: () => app }) } as unknown as INestApplication);
  const avatarPath = `/${API_PREFIX}/identity-access/profile/avatar`;
  app.post(avatarPath, (_request, response) => response.sendStatus(204));
  app.post(`/${API_PREFIX}/identity-access/profile`, (_request, response) => response.sendStatus(204));
  app.use((error: { status?: number }, _request: express.Request, response: express.Response, _next: express.NextFunction) =>
    response.sendStatus(error.status ?? 500));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}/${API_PREFIX}`;
  try {
    const boundary = await fetch(`${baseUrl}/identity-access/profile/avatar`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contentType: 'image/jpeg', base64: 'a'.repeat(2796204) }),
    });
    assert.equal(boundary.status, 204);

    const unrelatedRoute = await fetch(`${baseUrl}/identity-access/profile`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'a'.repeat(120_000) }),
    });
    assert.equal(unrelatedRoute.status, 413);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
