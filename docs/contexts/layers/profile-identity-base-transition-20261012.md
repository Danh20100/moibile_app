# Profile / Identity branch base transition — 2026-10-12

**Current development branch:** `feature/profile-identity-foundation`.

This branch was rebuilt to use the clean Android + NestJS + Database v1 + MinIO/Redis scaffold from `design/app-ui-redesign` at commit `ef1da3b015c92c9fc49d29d3a0a805583d5181f4` as its **first parent**.

## History preservation

- Previous incarnation: `fc097f20ca9c7ad3618ded0304c57bd4e769fcc9`, based on `integration/v1-current`.
- Immutable historic branch pointer: [`archive/profile-identity-foundation-integration-base-20261012`](https://github.com/onsra520/TroOi-Project/tree/archive/profile-identity-foundation-integration-base-20261012).
- Only the four **design-only** Profile/DB vNext documents and a context index entry were ported into the new base. Changes to frozen Database v1, SQL migrations, payment gateways and live Auth/KYC services were **not** imported.
- `integration/v1-current` is deprecated as the starting point for this feature; its original commits/history are still available.

## Verification and implementation boundary

Current foundation includes the Android test relocation/legacy cleanup and optional MinIO/Redis scaffold previously verified by the respective GitHub workflows. This rebuild must pass **its own** CI on the new branch HEAD. None of the design documents is an approved authorization to create a database migration or to treat Redis/S3 as integrated runtime service.

At this base transition, Profile/authentication contracts were proposals. The subsequent [Google-first decision register](../../superpowers/specs/2026-10-12-profile-identity-decision-register.md) approves Google-only registration, optional password and OTP verification/recovery/sensitive-operation purposes. Remaining physical/security details, KYC, consent and lifecycle still require review; no implementation or migration is authorized by the documentation update.
