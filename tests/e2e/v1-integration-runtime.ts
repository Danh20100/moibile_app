import { spawnSync } from 'node:child_process';

const url = process.env.TEST_DATABASE_URL ?? '';
if (!url.includes('trooi_test')) {
  console.error('v1-integration-runtime: TEST_DATABASE_URL must target trooi_test. Live Google/MoMo are not claimed.');
  process.exit(1);
}

const files = [
  'tests/integration/persistence/payment-gateway.integration.ts',
  'tests/integration/persistence/trust-submission.integration.ts',
];
const child = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', '--test-concurrency=1', ...files],
  { stdio: 'inherit', env: process.env },
);
process.exit(child.status ?? 1);
