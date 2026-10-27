#!/bin/sh
set -eu

# Docker development and finance runtimes are mutually exclusive.
# Never log database URLs or authentication secrets.
case "${TROOI_DATABASE_MODE:-}" in
  compose-postgres)
    export DATABASE_URL="$(node scripts/config/verify-runtime.cjs compose-database-url)"
    ;;
  external-finance)
    node scripts/config/verify-runtime.cjs finance
    ;;
  "")
    # Direct host deployments supply DATABASE_URL explicitly.
    : "${DATABASE_URL:?DATABASE_URL is required}"
    ;;
  *)
    echo "Unknown TROOI_DATABASE_MODE" >&2
    exit 1
    ;;
esac

echo "Running database migrations..."
./node_modules/.bin/tsx scripts/database/migrate.ts up

echo "Starting NestJS API..."
exec node build/main.js
