# E2E flow specifications

This folder describes atomic product flows. A flow is smaller than a full user journey
and must have one business outcome that can be asserted across UI, API, and database.

## Status vocabulary

- `executable`: automation can run against the current backendDebug stack.
- `requires_google`: flow exists, but real Google identity configuration/session is required.
- `spec_only`: current V1 backlog defines the flow, but the Android write surface is not executable yet.
- `open_policy`: automation must not freeze behavior while Canonical/backlog policy is still OPEN.

## Required shape

Every flow has: `id`, `actor`, `preconditions`, `steps`, `assertions`, and `status`.
Assertions should cover the strongest available layers: Android UI, HTTP/API, and PostgreSQL facts.

Do not make UI state authoritative. A green E2E write flow must be backed by a real Backend
acknowledgement and a database assertion when the flow mutates business state.
