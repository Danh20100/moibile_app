# Identity / KYC MVP Policy Draft

**Status:** proposed; requires explicit product and privacy approval before implementation.

## Current code boundary

- `CitizenIdOcr` extracts a candidate name and birth date on device. Its source comment explicitly says OCR is not identity verification or a KYC decision.
- `LandlordOnboardingScreen` holds front/back images in transient `Bitmap` state. `LocalLandlordApplication` contains no images or ID number, and no Identity/Organization API or database KYC record was found in the current baseline.
- `identityPhotosAccepted` means the applicant reviewed the OCR-assisted fields. It must not be rendered or stored as an approved/verified identity result.
- Frozen migration `000008_identity_foundation` and Organization ownership remain independent of any OCR/KYC result.

## Proposed MVP decision

1. **Do not claim KYC in the MVP.** The profile may show a user-entered legal name and birth date as unverified/self-reported only. No `VERIFIED`, `APPROVED`, or equivalent state is inferred from OCR, image presence, Google email verification, or Organization membership.
2. **Make CCCD capture optional.** Manual entry remains available. If the user chooses capture, perform OCR locally only to suggest name and birth date; show both values for user review. Do not extract, submit, or persist the card number, QR payload, or image bytes.
3. **Discard transient images after OCR, cancel, or onboarding completion.** Do not write them to app files, analytics, crash reports, logs, or remote storage. Do not promise secure memory erasure; release references and rely on process lifecycle cleanup.
4. **No reviewer workflow or evidence retention in this MVP.** Do not create identity review records, reviewer roles, KYC notifications, or an identity badge. Organization ownership continues to require its own approved Identity/session reauthentication flow.

## Future evidence-based review, only after separate approval

If product/legal review establishes a need to retain evidence, treat it as a separate feature and schema, not an extension of the frozen Identity contract:

- Require a documented lawful purpose, clear consent and user notice, evidence fields, access roles, jurisdiction-specific retention approval, deletion procedure, appeal process, and operational reviewer ownership before collection.
- Use a new additive migration after the current head (currently `000016`); never edit `000008`. Bind each review case to the durable User ID, keep Organization membership separate, and use enumerated review states and reason codes. Store no card number unless the approved purpose proves it necessary.
- Store evidence only in private object storage under random server-generated keys. Enforce owner access and a distinct audited reviewer role; deny public, Organization-operator, and ordinary support access. Log evidence access without logging OCR text, card numbers, object keys, or signed URLs.
- A human reviewer makes the decision. OCR output is input assistance only and cannot advance a case to an approved state. Require audit events for submission, review, decision, access, and deletion.
- Proposed retention for discussion: delete image evidence 30 days after a final decision; delete abandoned drafts within 24 hours; retain only minimal decision metadata for a separately approved period. These periods require privacy/legal confirmation before code or migrations.

## Tests and acceptance criteria

For the proposed no-KYC MVP:

- Unit tests prove OCR returns only candidate name/date and never an approval result; bad/ambiguous input remains empty and editable.
- Android tests prove image capture is optional, user review is required for extracted fields, and cancel/completion clears both image references without creating a verified badge.
- Repository/API contract tests prove `LocalLandlordApplication` sends no image bytes or ID number; backend tests prove no KYC record or identity-verified state is created.
- Acceptance requires explicit UI wording that distinguishes self-reported fields from verified identity, no image/network/file/log egress, and Organization ownership unaffected by OCR.

For any future retained-evidence feature, additionally test owner/reviewer authorization, outsider and Organization-operator denial, audit-write atomicity, retention deletion, storage failure recovery, migration up/down on empty data, and rollback refusal when evidence rows/objects remain. Acceptance requires a real reviewer workflow and verified deletion; fixtures or OCR output cannot stand in for human review.

## Migration and rollback

- No migration is needed for the proposed no-KYC MVP.
- A future evidence workflow must use a new migration after `000016`. Its down migration must refuse to drop tables while review/evidence records exist; rollback first disables new submissions, preserves approved audit requirements, deletes evidence through the audited retention path, verifies storage is empty, and only then permits schema rollback.
- Rollback must never alter User identity bindings, Organization ownership, Payment provenance, or frozen migration `000008`.

## Approval requested

Approve or revise these decisions before implementation:

1. No KYC claim or retained evidence in the MVP; legal name/date of birth remain unverified self-reported fields.
2. Make CCCD capture optional and local-OCR-only; do not send or store image bytes or card number.
3. Require a separate product/privacy approval before any reviewer workflow or evidence retention; 30-day post-decision retention is only a proposal, not an approved policy.
