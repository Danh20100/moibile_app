import type { INestApplication } from '@nestjs/common';
import express from 'express';

import { API_PREFIX } from '../constants';

export const TRUST_REPORT_JSON_LIMIT_BYTES = 8192;

export function applyHttpBodyParsers(app: INestApplication): void {
  const instance = app.getHttpAdapter().getInstance() as {
    use: (...args: unknown[]) => void;
  };
  instance.use(`/${API_PREFIX}/audit-trust/reports`, express.json({ limit: TRUST_REPORT_JSON_LIMIT_BYTES }));
  instance.use(`/${API_PREFIX}/messaging/conversations`, express.json({ limit: 13400000 }));
  instance.use(`/${API_PREFIX}/listings`, express.json({ limit: 8000000 }));
  instance.use(`/${API_PREFIX}/identity-access/profile/avatar`, express.json({ limit: 3145728 }));
  // Three bounded JPEGs via private authenticated endpoint, never logged or persisted as raw bytes.
  instance.use(`/${API_PREFIX}/identity-verification/auto-check`, express.json({ limit: 6400000 }));
  instance.use(express.json());
}
