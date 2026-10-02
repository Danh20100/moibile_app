#!/bin/sh
set -eu

echo "Running database migrations..."
pnpm exec tsx scripts/database/migrate.ts up

echo "Starting NestJS API..."
exec node build/main.js
