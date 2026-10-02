#!/bin/sh
set -eu

: "${POSTGRES_TEST_DB:?POSTGRES_TEST_DB is required}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=test_db="$POSTGRES_TEST_DB" <<'EOSQL'
SELECT format('CREATE DATABASE %I', :'test_db')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'test_db'
)\gexec
EOSQL
