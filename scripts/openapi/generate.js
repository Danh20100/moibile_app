'use strict';
require('reflect-metadata');
const { mkdirSync, writeFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');
const { NestFactory } = require('@nestjs/core');

async function main() {
  const { AppModule } = require(resolve(process.cwd(), 'build/app.module.js'));
  const { createOpenApiDocument } = require(resolve(process.cwd(), 'build/openapi.js'));

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
