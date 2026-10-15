import type {
  TenancyRecord,
  TenancyTermsRecord,
} from '../../src/persistence/ports/tenancy.repository';
import { loadFixture } from './fixture-loader';

interface CoreReferencesFixture {
  version: 1;
  provenance: string;
  tenancies: TenancyRecord[];
  terms: TenancyTermsRecord[];
}
export const coreReferencesFixture = loadFixture<CoreReferencesFixture>('rental/core-references');
