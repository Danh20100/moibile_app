# Notification preferences MVP policy — 2026-10-15

**Status: DRAFT — awaiting product approval.** No preference storage, API, or runtime behavior is enabled by this draft.

## Source behavior

`AccountSettingsFlow` currently keeps notification and privacy choices in Compose state and shows local save boundaries. It displays marketing and operational categories together, offers channel toggles, and has no persisted preference API. The existing notification module lists and marks delivery records read for `CurrentUser`; it does not define notification delivery preferences. Identity sessions and Organization onboarding remain gated OFF.

## Proposed MVP contract

1. A User may opt in separately to **in-app promotions** and **email promotions**. Both default to off for new Users and for existing Users without a preference row. No preference is inferred from current local UI defaults.
2. Security, authentication, payment/receipt, incident, tenancy, and due-date notifications remain operational and cannot be disabled through marketing preferences. “Nhắc việc thuê trọ” belongs to this operational group, not marketing.
3. Email promotions can be enabled only when the User has a verified email address. This preference does not verify an address, change login identity, or authorize account recovery. Actual email delivery remains off until a real provider and unsubscribe handling are configured.
4. Android OS notification permission is a device setting, separate from account preferences. An app-level in-app marketing opt-in does not override OS permission.
5. API reads and writes are bound to the authenticated `CurrentUser`; no client-supplied User ID. The API returns effective defaults when no row exists. Writes validate the finite preference fields and are idempotent.
6. New storage, if needed, is additive and keyed to the existing durable User; no change to frozen `000008`, ownership, notification records, or Payment provenance. Identity runtime gate stays OFF until its separately approved acceptance and enablement conditions are met.

## Implementation and acceptance if approved

- Add one additive migration after `000016` for User-scoped marketing preferences; no data backfill. Rollback disables the API/UI wiring and leaves stored rows untouched; reads fall back to opt-out defaults.
- Add authenticated `GET` and `PATCH` endpoints. Tests cover default-off reads, verified-email constraint, strict DTO validation, persistence/readback, idempotence, and cross-User denial. Existing operational notification rows and read watermarks remain unaffected.
- Replace local-only save behavior for these preference fields with API read/write and explicit loading/error states. A rejected save must keep the draft and must not show success. Session changes clear displayed preferences before loading the next User.
- Acceptance: isolated PostgreSQL/API tests and Android contract/UI tests pass. Report `PASS_BACKEND` and `PASS_ANDROID` for their proven slices; no `PASS_FULLSTACK` absent authenticated live-session device acceptance.

## Decision requested

Approve this policy as written, or specify changes to the marketing categories/channels, default behavior, or verified-email requirement before implementation.
