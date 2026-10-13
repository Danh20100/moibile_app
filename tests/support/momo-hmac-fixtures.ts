import { loadFixture } from './fixture-loader';
interface Fixture {
  version: number;
  values: {
    accessKey: string;
    accessKey2: string;
    equalScenario: boolean;
    scenarioValue: string;
    equalScenario2: boolean;
    signaturesMatchScenario: string;
    equalScenario3: boolean;
  };
}
export const data = loadFixture<Fixture>('payment/momo-hmac-regression');
