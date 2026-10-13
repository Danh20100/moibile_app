import type {
  CompreFaceConfig,
  FaceComparisonEvidence,
} from '../../src/integrations/compreface/compreface-verifier';
import type { ObjectStorageConfig } from '../../src/infrastructure/object-storage/object-storage.config';
import type {
  ComparisonEvidence,
  VerificationDraft,
} from '../../src/modules/identity-verification/domain/manual-verification.workflow';
import { loadFixture } from './fixture-loader';

type FoundationFixture = {
  version: 1;
  provenance: string;
  face: {
    enabled: Extract<CompreFaceConfig, { enabled: true }>;
    disabled: Extract<CompreFaceConfig, { enabled: false }>;
    jpeg: number[];
    invalidJpegs: number[][];
    success: { result: { face_matches: { similarity: number }[] }[] };
    expected: FaceComparisonEvidence;
    invalidResponses: Record<string, unknown>;
    invalidJson: string;
    httpError: string;
    httpErrorStatus: number;
    upstreamError: string;
    invalidInputError: string;
    nonfinite: string[];
    configCases: Record<'remoteHttp' | 'timeoutZero' | 'missingKey' | 'valid', NodeJS.ProcessEnv>;
    loaded: CompreFaceConfig;
  };
  storage: {
    config: Extract<ObjectStorageConfig, { enabled: true }>;
    disabled: Extract<ObjectStorageConfig, { enabled: false }>;
    bytes: number[];
    emptyBytes: number[];
    keys: Record<'disabled' | 'put' | 'get' | 'invalidPayload', string>;
    mime: string;
    badMime: string;
    invalidKeys: string[];
    missing: { name: string; sensitive: string };
    error: string;
    invalidEndpoints: string[];
    validEndpoints: string[];
  };
  manual: {
    draft: VerificationDraft;
    evidence: ComparisonEvidence;
    reviewer: string;
    unauthorized: string[];
    deny: boolean;
    truthy: string;
    authorizationError: string;
    decidedAt: string;
    repeatedAt: string;
    badDate: string;
    badScore: number;
    nan: string;
    states: {
      pending: 'PENDING_REVIEW';
      reviewing: 'IN_REVIEW';
      verified: 'VERIFIED';
      rejected: 'REJECTED';
    };
    revisions: Record<'draft' | 'pending' | 'reviewing' | 'decided', number>;
  };
};
export const verificationFixture = loadFixture<FoundationFixture>('verification/foundation');
