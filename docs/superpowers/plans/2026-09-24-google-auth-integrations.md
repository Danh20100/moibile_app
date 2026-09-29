# Google Auth Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a vendor-isolated Google Identity verification adapter, a committed `.env.example`, and a minimal automated test harness without wiring TrọƠi user persistence, JWT/session logic, or auth endpoints.

**Architecture:** `src/integrations/` is an infrastructure boundary separate from `src/modules/`. Google-specific SDK usage stays inside `src/integrations/google-identity/`, which verifies an ID token and returns the internal `GoogleIdentity` contract. Configuration is supplied at construction/factory boundaries; business modules do not read Google SDK types or make provider-specific decisions.

**Tech Stack:** Node.js 22.22.3+/24.15+/26+, TypeScript 6, NestJS 12 foundation, pnpm, `google-auth-library`, Node built-in `node:test`, `tsx` for TypeScript test execution, ESLint, Prettier.

**Spec:** `docs/superpowers/specs/2026-09-24-google-auth-integrations-design.md`

## Global Constraints

- Implementation branch is `backend/google-auth-integrations` and must start from the latest `backend/core-foundations` HEAD, not `main`.
- `src/modules/**` must not import `google-auth-library`.
- `src/integrations/` may depend on vendor SDKs but must return internal contracts and must not contain user creation, role assignment, persistence, JWT/session issuance, or domain-state mutation.
- `GoogleIdentity.subject` is required and comes from Google claim `sub`; email must not be used as the stable external identity key.
- Do not introduce a generic multi-provider auth abstraction while Google is the only provider.
- Do not scaffold placeholder integrations for future providers.
- `.env.example` contains only environment variables with an actual runtime/config contract: `PORT` and `GOOGLE_CLIENT_ID`.
- Do not add `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, database/Redis/MinIO variables, Passport, JWT/session packages, or OAuth redirect/callback flow.
- Google verifier configuration is injected/provided at construction; do not read `process.env` inside verification methods.
- Existing 12 bounded modules and their READMEs must remain unchanged.

## Review Focus

- Whitespace-only ID tokens must be rejected before the Google SDK is called.
- Missing or whitespace-only `GOOGLE_CLIENT_ID` must fail early as a configuration error.
- A verified payload with missing or whitespace-only `sub` must be rejected as invalid payload.
- A Google client rejection, including a non-`Error` thrown value, must become a safe internal provider error without leaking vendor error text.
- Optional claims may be absent; `email_verified: false` must be preserved as `emailVerified: false` rather than dropped.

---

## File Map

**Create**

```text
.env.example
src/integrations/README.md
src/integrations/google-identity/README.md
src/integrations/google-identity/google-identity.types.ts
src/integrations/google-identity/google-identity.errors.ts
src/integrations/google-identity/google-id-token-verifier.ts
src/integrations/google-identity/google-id-token-verifier.factory.ts
src/integrations/google-identity/google-id-token-verifier.spec.ts
src/integrations/google-identity/index.ts
```

**Modify**

```text
package.json
pnpm-lock.yaml
.gitattributes
```

**Must remain unchanged**

```text
src/modules/**
src/app.module.ts
src/main.ts
```

---

## Execution Precondition: Branch and Worktree

At execution time, use `superpowers:using-git-worktrees` and create the implementation worktree from the latest remote backend foundation.

```powershell
git fetch origin backend/core-foundations
$base = git rev-parse origin/backend/core-foundations

git worktree add .worktrees/google-auth-integrations -b backend/google-auth-integrations $base
cd .worktrees/google-auth-integrations

if ((git rev-parse HEAD) -ne $base) {
  throw 'backend/google-auth-integrations did not start from latest backend/core-foundations'
}

git status --short
```

Expected: branch starts exactly at current `origin/backend/core-foundations` and working tree is clean.

---

### Task 1: Establish the integration boundary, dependencies, env example, and test command

**Files:**
- Create: `.env.example`
- Create: `src/integrations/README.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.gitattributes`

**Interfaces:**
- Consumes: existing pnpm/NestJS/TypeScript foundation.
- Produces: installed `google-auth-library`, TypeScript test execution via `tsx`, the `src/integrations/` convention, and the documented environment contract used by later tasks.

- [ ] **Step 1: Confirm forbidden integration packages are not already present**

```powershell
pnpm list google-auth-library tsx --depth 0
```

Expected: neither package is installed at the project root before this task.

- [ ] **Step 2: Install only the required production and test dependencies**

```powershell
pnpm add google-auth-library
pnpm add -D tsx
```

Expected: `google-auth-library` appears under `dependencies`, `tsx` under `devDependencies`, and `pnpm-lock.yaml` changes.

- [ ] **Step 3: Add the generic test script to `package.json`**

Add exactly this script without changing existing scripts:

```json
"test": "tsx --test \"src/**/*.spec.ts\""
```

Expected scripts include the existing foundation scripts plus `test`.

- [ ] **Step 4: Create `.env.example`**

```dotenv
# Application
PORT=3000

# Google Identity
GOOGLE_CLIENT_ID=
```

Do not add secrets or variables not consumed by this integration contract.

- [ ] **Step 5: Extend line-ending normalization for YAML and the env example**

Ensure `.gitattributes` contains the existing rules plus:

```gitattributes
*.yaml text eol=lf
*.yml text eol=lf
.env.example text eol=lf
```

This prevents Windows checkout warnings for `pnpm-lock.yaml` and keeps the committed example deterministic.

- [ ] **Step 6: Create `src/integrations/README.md`**

Create exactly this boundary documentation:

```markdown
# External Integrations

`src/integrations/` is the backend infrastructure boundary for external APIs, SDKs, and service providers.

## Rules

- Provider-specific SDKs and payloads stay inside their integration folder.
- Integrations return internal contracts instead of leaking vendor payload types into `src/modules/`.
- Integrations do not create TrọƠi users, assign roles, decide permissions, persist domain state, or issue sessions/tokens.
- Each real provider gets its own folder only when a concrete use case exists.
- Do not add placeholder folders for providers that are not implemented yet.

Business and application concerns remain in `src/modules/`; external communication and vendor normalization remain in `src/integrations/`.
```

- [ ] **Step 7: Verify dependency/config changes do not break the existing foundation**

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
git diff --check
git diff -- src/modules
```

Expected: all commands exit `0`; `src/modules` diff is empty. Do not run `pnpm test` yet because no spec file exists until Task 2.

- [ ] **Step 8: Commit the integration foundation**

```powershell
git add package.json pnpm-lock.yaml .env.example .gitattributes src/integrations/README.md
git commit -m "chore: establish external integrations foundation"
```

---

### Task 2: Implement Google ID-token verification with an internal contract

**Files:**
- Create: `src/integrations/google-identity/google-identity.types.ts`
- Create: `src/integrations/google-identity/google-identity.errors.ts`
- Create: `src/integrations/google-identity/google-id-token-verifier.ts`
- Create/Test: `src/integrations/google-identity/google-id-token-verifier.spec.ts`

**Interfaces:**
- Consumes: `google-auth-library` from Task 1 and a constructor-provided Google client ID.
- Produces: `GoogleIdentity`, `GoogleIdTokenVerifier`, `GoogleIdentityVerificationError`, and concrete `GoogleAuthIdTokenVerifier`.

- [ ] **Step 1: Write the failing verifier tests first**

Create `src/integrations/google-identity/google-id-token-verifier.spec.ts`:

```typescript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  GoogleIdentityVerificationError,
  type GoogleIdentityErrorCode,
} from './google-identity.errors';
import {
  GoogleAuthIdTokenVerifier,
  type GoogleIdTokenClient,
  type GoogleTokenPayload,
} from './google-id-token-verifier';

function expectIntegrationError(code: GoogleIdentityErrorCode) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof GoogleIdentityVerificationError);
    assert.equal(error.code, code);
    return true;
  };
}

function clientWithPayload(
  payload: GoogleTokenPayload | undefined,
  expectedToken = 'valid-token',
  expectedAudience = 'google-client-id',
): GoogleIdTokenClient {
  return {
    async verifyIdToken(options) {
      assert.equal(options.idToken, expectedToken);
      assert.equal(options.audience, expectedAudience);
      return {
        getPayload: () => payload,
      };
    },
  };
}

describe('GoogleAuthIdTokenVerifier', () => {
  it('normalizes a valid verified Google payload', async () => {
    const verifier = new GoogleAuthIdTokenVerifier(
      '  google-client-id  ',
      clientWithPayload({
        sub: 'google-subject',
        email: 'user@example.com',
        email_verified: true,
        name: 'TrọƠi User',
        picture: 'https://example.com/avatar.png',
      }),
    );

    const identity = await verifier.verify('valid-token');

    assert.deepEqual(identity, {
      subject: 'google-subject',
      email: 'user@example.com',
      emailVerified: true,
      name: 'TrọƠi User',
      pictureUrl: 'https://example.com/avatar.png',
    });
  });

  it('accepts a valid payload when optional claims are absent', async () => {
    const verifier = new GoogleAuthIdTokenVerifier(
      'google-client-id',
      clientWithPayload({ sub: 'google-subject' }),
    );

    assert.deepEqual(await verifier.verify('valid-token'), {
      subject: 'google-subject',
    });
  });

  it('preserves email_verified false', async () => {
    const verifier = new GoogleAuthIdTokenVerifier(
      'google-client-id',
      clientWithPayload({
        sub: 'google-subject',
        email_verified: false,
      }),
    );

    assert.deepEqual(await verifier.verify('valid-token'), {
      subject: 'google-subject',
      emailVerified: false,
    });
  });

  it('rejects an empty or whitespace-only token before calling Google', async () => {
    let calls = 0;
    const client: GoogleIdTokenClient = {
      async verifyIdToken() {
        calls += 1;
        throw new Error('must not be called');
      },
    };
    const verifier = new GoogleAuthIdTokenVerifier('google-client-id', client);

    await assert.rejects(() => verifier.verify(''), expectIntegrationError('INVALID_TOKEN'));
    await assert.rejects(() => verifier.verify('   '), expectIntegrationError('INVALID_TOKEN'));
    assert.equal(calls, 0);
  });

  it('rejects a verified payload without a usable sub claim', async () => {
    const missingSub = new GoogleAuthIdTokenVerifier(
      'google-client-id',
      clientWithPayload({}),
    );
    const whitespaceSub = new GoogleAuthIdTokenVerifier(
      'google-client-id',
      clientWithPayload({ sub: '   ' }),
    );

    await assert.rejects(
      () => missingSub.verify('valid-token'),
      expectIntegrationError('INVALID_PAYLOAD'),
    );
    await assert.rejects(
      () => whitespaceSub.verify('valid-token'),
      expectIntegrationError('INVALID_PAYLOAD'),
    );
  });

  it('maps Google client failures to a safe provider error', async () => {
    const client: GoogleIdTokenClient = {
      async verifyIdToken() {
        throw 'sensitive vendor failure';
      },
    };
    const verifier = new GoogleAuthIdTokenVerifier('google-client-id', client);

    await assert.rejects(
      () => verifier.verify('valid-token'),
      (error: unknown) => {
        assert.ok(error instanceof GoogleIdentityVerificationError);
        assert.equal(error.code, 'PROVIDER_ERROR');
        assert.equal(error.message, 'Google ID token verification failed.');
        assert.equal(error.message.includes('sensitive vendor failure'), false);
        return true;
      },
    );
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

```powershell
pnpm test
```

Expected: FAIL because the Google identity implementation files imported by the test do not exist yet.

- [ ] **Step 3: Create the internal identity and verifier contracts**

Create `src/integrations/google-identity/google-identity.types.ts`:

```typescript
export interface GoogleIdentity {
  subject: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  pictureUrl?: string;
}

export interface GoogleIdTokenVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}
```

- [ ] **Step 4: Create the internal error model**

Create `src/integrations/google-identity/google-identity.errors.ts`:

```typescript
export type GoogleIdentityErrorCode =
  | 'CONFIGURATION_ERROR'
  | 'INVALID_TOKEN'
  | 'INVALID_PAYLOAD'
  | 'PROVIDER_ERROR';

export class GoogleIdentityVerificationError extends Error {
  constructor(
    public readonly code: GoogleIdentityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleIdentityVerificationError';
  }
}
```

- [ ] **Step 5: Implement the Google verifier adapter**

Create `src/integrations/google-identity/google-id-token-verifier.ts`:

```typescript
import { OAuth2Client } from 'google-auth-library';

import { GoogleIdentityVerificationError } from './google-identity.errors';
import type { GoogleIdentity, GoogleIdTokenVerifier } from './google-identity.types';

export interface GoogleTokenPayload {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export interface GoogleIdTokenTicket {
  getPayload(): GoogleTokenPayload | undefined;
}

export interface GoogleIdTokenClient {
  verifyIdToken(options: {
    idToken: string;
    audience: string;
  }): Promise<GoogleIdTokenTicket>;
}

export class GoogleAuthIdTokenVerifier implements GoogleIdTokenVerifier {
  private readonly clientId: string;

  constructor(
    clientId: string,
    private readonly client: GoogleIdTokenClient = new OAuth2Client(),
  ) {
    const normalizedClientId = clientId.trim();

    if (!normalizedClientId) {
      throw new GoogleIdentityVerificationError(
        'CONFIGURATION_ERROR',
        'Google client ID is required.',
      );
    }

    this.clientId = normalizedClientId;
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (!idToken.trim()) {
      throw new GoogleIdentityVerificationError('INVALID_TOKEN', 'Google ID token is required.');
    }

    let ticket: GoogleIdTokenTicket;

    try {
      ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
    } catch {
      throw new GoogleIdentityVerificationError(
        'PROVIDER_ERROR',
        'Google ID token verification failed.',
      );
    }

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.sub.trim()) {
      throw new GoogleIdentityVerificationError(
        'INVALID_PAYLOAD',
        'Verified Google token does not contain a valid subject.',
      );
    }

    return {
      subject: payload.sub,
      ...(payload.email !== undefined ? { email: payload.email } : {}),
      ...(payload.email_verified !== undefined
        ? { emailVerified: payload.email_verified }
        : {}),
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.picture !== undefined ? { pictureUrl: payload.picture } : {}),
    };
  }
}
```

The default `OAuth2Client` structurally satisfies the narrow internal client port; Google-specific SDK types do not escape the integration folder.

- [ ] **Step 6: Run tests and verify GREEN**

```powershell
pnpm test
```

Expected: all verifier tests PASS with zero network calls.

- [ ] **Step 7: Run static/build gates for the new production code**

```powershell
pnpm typecheck
pnpm lint
pnpm format
pnpm format:check
pnpm build
git diff --check
git diff -- src/modules
```

Expected: all gates pass; `src/modules` diff remains empty.

- [ ] **Step 8: Commit the verifier and tests**

```powershell
git add src/integrations/google-identity/google-identity.types.ts `
        src/integrations/google-identity/google-identity.errors.ts `
        src/integrations/google-identity/google-id-token-verifier.ts `
        src/integrations/google-identity/google-id-token-verifier.spec.ts

git commit -m "feat: add google id token verifier"
```

---

### Task 3: Add the environment construction boundary, public exports, and provider documentation

**Files:**
- Modify/Test: `src/integrations/google-identity/google-id-token-verifier.spec.ts`
- Create: `src/integrations/google-identity/google-id-token-verifier.factory.ts`
- Create: `src/integrations/google-identity/index.ts`
- Create: `src/integrations/google-identity/README.md`

**Interfaces:**
- Consumes: `GoogleAuthIdTokenVerifier` and `GoogleIdTokenVerifier` from Task 2.
- Produces: `createGoogleIdTokenVerifierFromEnv(env?: NodeJS.ProcessEnv): GoogleIdTokenVerifier` plus a stable public barrel for future application wiring.

- [ ] **Step 1: Add failing configuration-boundary tests**

Append imports to the existing spec:

```typescript
import { createGoogleIdTokenVerifierFromEnv } from './google-id-token-verifier.factory';
```

Append these tests inside the file:

```typescript
describe('createGoogleIdTokenVerifierFromEnv', () => {
  it('fails early when GOOGLE_CLIENT_ID is missing', () => {
    assert.throws(
      () => createGoogleIdTokenVerifierFromEnv({}),
      expectIntegrationError('CONFIGURATION_ERROR'),
    );
  });

  it('fails early when GOOGLE_CLIENT_ID contains only whitespace', () => {
    assert.throws(
      () => createGoogleIdTokenVerifierFromEnv({ GOOGLE_CLIENT_ID: '   ' }),
      expectIntegrationError('CONFIGURATION_ERROR'),
    );
  });

  it('creates a verifier when GOOGLE_CLIENT_ID is configured', () => {
    const verifier = createGoogleIdTokenVerifierFromEnv({
      GOOGLE_CLIENT_ID: 'google-client-id',
    });

    assert.equal(typeof verifier.verify, 'function');
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

```powershell
pnpm test
```

Expected: FAIL because `google-id-token-verifier.factory.ts` does not exist yet.

- [ ] **Step 3: Implement the environment factory**

Create `src/integrations/google-identity/google-id-token-verifier.factory.ts`:

```typescript
import { GoogleAuthIdTokenVerifier } from './google-id-token-verifier';
import type { GoogleIdTokenVerifier } from './google-identity.types';

export function createGoogleIdTokenVerifierFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): GoogleIdTokenVerifier {
  return new GoogleAuthIdTokenVerifier(env.GOOGLE_CLIENT_ID ?? '');
}
```

This is the only environment-reading construction helper in this integration. `verify()` remains independent of `process.env`.

- [ ] **Step 4: Run the tests and verify GREEN**

```powershell
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 5: Create the public integration barrel**

Create `src/integrations/google-identity/index.ts`:

```typescript
export { GoogleIdentityVerificationError } from './google-identity.errors';
export type { GoogleIdentityErrorCode } from './google-identity.errors';
export { GoogleAuthIdTokenVerifier } from './google-id-token-verifier';
export { createGoogleIdTokenVerifierFromEnv } from './google-id-token-verifier.factory';
export type { GoogleIdentity, GoogleIdTokenVerifier } from './google-identity.types';
```

Do not export the internal `GoogleIdTokenClient`, ticket, or vendor payload test seam from the public barrel.

- [ ] **Step 6: Create provider-specific README**

Create `src/integrations/google-identity/README.md`:

```markdown
# Google Identity Integration

This integration verifies Google ID tokens and normalizes verified Google claims into TrọƠi's internal `GoogleIdentity` contract.

## Input

A Google ID token obtained by the client application.

## Configuration

`GOOGLE_CLIENT_ID` is the expected audience used during verification.

`.env.example` documents the variable, but this integration does not install an application-wide env loader. The factory reads `process.env` only when it is explicitly constructed; wiring that factory into an auth endpoint belongs to a later task.

## Output

```ts
interface GoogleIdentity {
  subject: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  pictureUrl?: string;
}
```

`subject` comes from Google's `sub` claim and is the stable external identity key. Email is optional metadata and must not replace `sub` as the identity key.

## Boundary

This folder does not create TrọƠi users, persist identities, issue JWT/session tokens, assign roles, manage organizations, or expose HTTP endpoints.
```

- [ ] **Step 7: Verify public boundary and project gates**

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm format
pnpm format:check
pnpm build

git diff --check
git diff -- src/modules
Get-ChildItem src/modules -Recurse -File | Select-String -Pattern 'google-auth-library|google-identity'
```

Expected: all gates pass; both module-diff and provider-import search produce no output.

- [ ] **Step 8: Commit the construction boundary and docs**

```powershell
git add src/integrations/google-identity/google-id-token-verifier.spec.ts `
        src/integrations/google-identity/google-id-token-verifier.factory.ts `
        src/integrations/google-identity/index.ts `
        src/integrations/google-identity/README.md

git commit -m "docs: finalize google identity integration boundary"
```

---

### Task 4: Fresh-install and whole-branch verification

**Files:**
- Verify all files from Tasks 1–3.
- Verify unchanged: `src/modules/**`, `src/app.module.ts`, `src/main.ts`.

**Interfaces:**
- Consumes: complete Google Identity integration branch.
- Produces: fresh evidence that the adapter, tests, lockfile, formatting, and existing backend foundation all work from committed state.

- [ ] **Step 1: Confirm branch ancestry and inspect changed paths**

```powershell
git fetch origin backend/core-foundations

git merge-base --is-ancestor origin/backend/core-foundations HEAD
if ($LASTEXITCODE -ne 0) {
  throw 'Branch is not based on current backend/core-foundations ancestry.'
}

git diff --name-only origin/backend/core-foundations...HEAD
```

Expected changed paths are limited to integration/config/test files defined by this plan; no files under `src/modules/`, `src/app.module.ts`, or `src/main.ts` appear.

- [ ] **Step 2: Confirm a clean tree before destructive generated-state cleanup**

```powershell
git status --short
```

Expected: no output.

- [ ] **Step 3: Remove generated local state and reinstall only from the committed lockfile**

```powershell
if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
if (Test-Path build) { Remove-Item -Recurse -Force build }

pnpm install --frozen-lockfile
```

Expected: install exits `0` and does not mutate `pnpm-lock.yaml`.

- [ ] **Step 4: Run the complete integration and foundation gates**

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
git diff --check
```

Expected: every command exits `0`.

- [ ] **Step 5: Verify architectural boundaries and environment example**

```powershell
git diff origin/backend/core-foundations...HEAD -- src/modules src/app.module.ts src/main.ts
Get-ChildItem src/modules -Recurse -File | Select-String -Pattern 'google-auth-library|google-identity'
Get-Content .env.example
```

Expected:

- first two commands produce no diff/provider import hits;
- `.env.example` contains only `PORT=3000` and blank `GOOGLE_CLIENT_ID=` plus comments;
- no secret value is committed.

- [ ] **Step 6: Verify no out-of-scope auth implementation was introduced**

```powershell
$changed = git diff --name-only origin/backend/core-foundations...HEAD
$changed

Get-ChildItem src/integrations -Recurse -File -Filter *.ts |
  Select-String -Pattern '@Controller|JwtService|passport|refresh token|role assignment|DATABASE_URL'
```

Expected: no endpoint, JWT/session, Passport, persistence, or role-assignment implementation appears.

- [ ] **Step 7: Capture final evidence**

```powershell
node --version
pnpm --version
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
git status --short
```

Do not claim completion unless these are fresh successful results and `git status --short` is empty.
