import { loadSepayProductionConfig } from '../../src/modules/payment-gateway/sepay/sepay-production-config';

const config = loadSepayProductionConfig(process.env);
if (!config) {
  process.stdout.write(
    'UNVERIFIED: SePay production transfer was not started. Production config is absent or points at a blocked database. No provider request was sent.\n',
  );
  process.exitCode = 2;
} else {
  process.stdout.write(
    'BLOCKED: Production config is present, but this process does not transfer money. A person must open the signed checkout and send one small bank transfer, then reconcile that checkout.\n',
  );
  process.exitCode = 2;
}
