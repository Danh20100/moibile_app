# Ledger Terms due-day policy draft — 2026-10-14

**Status: APPROVED FOR IMPLEMENTATION — 2026-10-15.** Product owner approved LED-P1-02 and LED-P1-03 as written. This approval authorizes implementation and testing; it does not change runtime Terms creation, billing, or Payment behavior until each slice is implemented and verified.

## Current contract observed in source

- `CreateTenancyTermsDto.billingDayOrDueDateRule` is currently `unknown` and only checked for presence; `TenancyTermsService` stores the JSON unchanged.
- The Android Terms editor sends `{"day": N}` and restricts `N` to 1–31. The Android reader extracts a `day` value but does not validate historical JSON shapes.
- PostgreSQL stores this field as JSONB. Existing Terms versions are immutable and are read back from stored JSON. Repository and test fixtures include legacy empty objects (`{}`), so tightening writes must not rewrite or make historical rows unreadable.
- Billing currently creates monthly cycles; no automatic payment verification or due-date execution is implied by this field. Manual cash/transfer provenance remains `USER_RECORDED`.

## LED-P1-02 — Proposed short-month rule

For a recurring monthly day `N` from 1 through 31, set the due date to the earlier of `N` and the last calendar day of that billing month. Thus day 31 is due on February 28/29 and March 31; day 30 is due on February 28/29. Do not carry an unavailable day into the next month, shift the billing cycle, prorate charges, or imply a payment was received. Interpret it as a local Vietnam calendar date (date-only), with no UTC conversion.

### Required tests

- Days 1, 28, 29, 30, and 31 in short/long months.
- February in leap and non-leap years, including day 29/30/31.
- Year boundary and stable date-only serialization independent of device timezone.
- Due-date calculation does not alter cycle boundaries, Terms versions, charge totals, Payment provenance, or acknowledgement state.

## LED-P1-03 — Proposed API validation and compatibility

1. Define the new-write v1 rule as exactly `{"day": integer}` with `1 <= day <= 31`. Reject missing `day`, non-integer values, out-of-range values, arrays/scalars, and unknown keys on new Terms creation.
2. Preserve the semantic JSON value and shape of already-stored Terms on list/get. Do not revalidate, backfill, or rewrite historical Terms, even when their JSON is `{}` or an older shape.
3. Before enforcing strict new-write validation, inventory all supported API writers and payloads. The current Android writer is the known client and emits `{day}`; any additional supported writer or legacy payload format must be documented and handled by an explicitly versioned compatibility rule before rollout. Do not silently infer a day from an unknown shape.
4. The server remains authoritative for validation. Android and API contract tests must assert the same 1–31 range and exact new-write shape.

### Schema, rollback, and acceptance

- No migration is needed for JSONB validation or short-month arithmetic. Keep `000008` and all historical Terms/Payment/ownership rows unchanged.
- Rollback disables the new calculation/validation code and restores the previous JSON pass-through writer behavior; stored Terms remain unchanged and readable. No Payment rows are created or altered as part of date calculation.
- Accept after product approval of LED-P1-02 and LED-P1-03, a source inventory confirms all active writers, backend tests cover invalid payloads and date boundaries, Android editor/decoder contract tests pass, and PostgreSQL integration proves legacy `{}` and any approved old shapes round-trip structurally without mutation. Report only `PASS_BACKEND`/`PASS_ANDROID` for their proven slices; no Full-stack claim follows from contract tests alone.

## Approval record

| Decision | Status | Approver / date | Notes |
|---|---|---|---|
| LED-P1-02 short-month rule | APPROVED — implementation pending | Product owner / 2026-10-15 | Clamp recurring day to last date in each month; date-only Vietnam calendar semantics |
| LED-P1-03 write schema/backward compatibility | APPROVED — implementation pending | Product owner / 2026-10-15 | Strict new `{day}` shape after writer inventory; preserve historical JSON reads and values |
