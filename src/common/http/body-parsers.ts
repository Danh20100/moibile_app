import type { INestApplication } from '@nestjs/common';
import express from 'express';

import { API_PREFIX } from '../constants';

export const TRUST_REPORT_JSON_LIMIT_BYTES = 8192;

export function applyHttpBodyParsers(app: INestApplication): void {
  const instance = app.getHttpAdapter().getInstance() as {
    use: (...args: unknown[]) => void;
  };
  instance.use(`/${API_PREFIX}/audit-trust/reports`, express.json({ limit: TRUST_REPORT_JSON_LIMIT_BYTES }));
  instance.use(express.json());
}
