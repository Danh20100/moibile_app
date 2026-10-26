# TrọƠi — Incident UI-first audit notes (2026-10-26)

Status: UI DESIGN FROZEN on 2026-10-26; source discrepancies remain BACKLOG / DEFERRED IMPLEMENTATION. No domain change.

## Decision
- Prioritize UX/UI design and interactive review of the owner **Sự cố** screen first.
- Do not modify Android source, backend, schema, domain FSM or migrations while reviewing the prototype.
- Approved UI: Sổ main layout; Biên nhận list/detail; Sự cố list/detail/report/state updates/history (approved 2026-10-26).
- Prototype uses explicitly labeled sample data; all UI actions are local simulation.

## Verified source snapshot
- Local repo D:\Projects\TroOi-Project, branch main, clean working tree at start of audit.
- Contracts: src/modules/incident/contracts/index.ts; dto/index.ts; controllers/incident.controller.ts; services/incident.service.ts.
- Android: app/src/main/java/com/trooi/app/features/shared/V1RentalGateway.kt; features/tenancy/RentalWorkspace.kt; features/tenancy/RentalViewModel.kt; features/ledger/OwnerLedgerDashboard.kt; app/core/data/BackendTroOiRepository.kt.
- Reference DDL: docs/database/v1/schema/trooi-schema-20260927T153946Z.sql.
- Relevant authority: docs/database/v1/canonical.md and incident backlog; keep FROZEN domain authority unchanged.
- Targeted tests executed: incident.contract.test.ts + incident-trust.behavior.test.ts: 8/8 pass. Not an end-to-end Android/API verification.

## Deferred source issues (do not fix in UI phase)
1. **FSM mismatch:** Android V1RentalGateway.INCIDENT_TRANSITIONS offers REPORTED -> CLOSED and IN_PROGRESS -> CLOSED, but backend IncidentService.VALID_TRANSITIONS rejects those two paths. Canonical/backlog allows them; reconcile later against authority.
2. **Overview count mismatch:** backend dashboard counts RESOLVED as open; Android OwnerLedgerDashboard's incident counter/attention excludes RESOLVED. Use authoritative definition: open = REPORTED, ACKNOWLEDGED, IN_PROGRESS, RESOLVED.
3. **Navigation gap:** OwnerLedgerDashboard incident rows dispatch onOpenIncidents() rather than passing selected incidentId for direct detail navigation.
4. **Unhelpful display fields:** Android maps incident.title = incident.category; some UI shows raw state codes, Incident IDs, and IncidentEvent strings. UX should render localized labels.
5. **Missing report content:** CreateIncidentDto only takes roomId + category (+ optional reporter managed by server); no incident title, description, severity/priority or create-time attachment workflow.
6. **Attachment incomplete:** incident_events.attachment_reference exists, but verified upload/view flow for incident evidence is not implemented.
7. **Doc drift:** PATCH incidents/:id/status ApiOperation summary refers to obsolete processing/need_more_information sequence, not current closed vocabulary.
8. **Closure consistency:** Backend has closureReason field but the validation/requirements for direct closure need alignment with frozen policy; do not solve by guessing in the UI.
9. **Tenant/operator permissions:** tenant can submit/access authorized incidents; only operator updates incident status. Do not offer tenant update-state actions.
10. **History semantics:** meaningful IncidentEvent history is append-only; preserve status changes/reopen, never replace history on UI edits.

## UI prototype scope before approval
- Owner list: search, asset filter, status filter (open includes RESOLVED), counts, category and room labels, chronological ordering.
- Detail: category, room, property, current state, created date, reporter when resolved from authorized read, append-only timeline, operator-only next actions.
- New report: authorized room and one of 6 frozen categories; future proposed fields (description, images) must be tagged **needs domain/API approval**, not claimed as implemented.
- Responsive dark mode; Sổ navigation and back behavior maintain filter context.
- Do not add marketplace dispatch, contractor pricing, public personal rating, or unsupported priority claims.
- Approval gate completed: Sự cố UI approved 2026-10-26; proceed to Tin đăng (3/6).

## Current status
- Biên nhận: UI Design Frozen, no source implementation requested.
- Sự cố: UI Design Frozen (2026-10-26); no source implementation.
- Source issue fixes: deferred to implementation phase.
