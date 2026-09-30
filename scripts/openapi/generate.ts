import 'reflect-metadata';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../src/app.module';
import { createOpenApiDocument } from '../../src/openapi';

/**
 * Offline OpenAPI contract exporter.
 *
 * Generates the OpenAPI document from the current-core AppModule without
 * starting an HTTP server or connecting to PostgreSQL (Nest preview mode does
 * not instantiate providers). This gives Frontend a stable, versionable
 * contract artifact to consume after the Backend+Database lane merges.
 *
 * Usage: `pnpm openapi:generate [outputPath]`
 * Default output: docs/api/openapi.json
 */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });

  try {
    const document = createOpenApiDocument(app);
    const outputPath = resolve(process.cwd(), process.argv[2] ?? 'docs/api/openapi.json');
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    process.stdout.write(`OpenAPI contract written to ${outputPath}\n`);
  } finally {
    await app.close();
  }
}

void main();
