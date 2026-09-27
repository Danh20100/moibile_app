# Low-Level Architecture Audit Tests

These tests are a handoff suite for `backend/low-level-architecture`.

They intentionally include failing contract tests. A red audit test means the current implementation does not satisfy a documented architecture/business boundary; do not weaken or delete the assertion merely to make the suite green.

## Run

Build first because `runtime.access.test.ts` launches the compiled Nest application:

```powershell
pnpm typecheck
pnpm build
pnpm exec tsx --test tests/audit/low-level-architecture/*.test.ts
```

The repository's current `pnpm test` command only discovers `src/**/*.spec.ts`, so it does **not** execute this audit suite yet.

## Test groups

- `baseline.behavior.test.ts` — behavior that currently works and should remain green.
- `architecture.contract.test.ts` — architecture invariants and mutation isolation.
- `boundary.validation.test.ts` — request/business validation boundaries.
- `cross-module.integrity.test.ts` — validity of references crossing bounded contexts.
- `lifecycle.edge-cases.test.ts` — lifecycle and financial edge cases.
- `access-boundary.static.test.ts` — static check for auth enforcement wiring.
- `runtime.access.test.ts` — runtime check for public/private HTTP access behavior.
- `test-discovery.static.test.ts` — verifies whether the default test command includes `tests/**`.

See `docs/audits/2026-09-25-low-level-architecture-audit.md` for evidence, severity and source locations.
