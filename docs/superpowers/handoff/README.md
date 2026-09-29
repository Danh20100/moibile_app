# Handoff

This directory is the canonical location for agent-to-agent handoff documents and their review responses.

## Handoff file naming

Use:

```text
<recipient>-<YYYYMMDD-HHmmss>-<short-description>.md
```

Rules:
- `recipient`: lowercase agent/person handle, e.g. `duyanh`.
- timestamp: local project time (`Asia/Ho_Chi_Minh`, UTC+07:00).
- `short-description`: concise kebab-case scope.
- one handoff event = one immutable timestamped Markdown file.

Backend handoffs currently target `duyanh`.

Do not create a generic root `HANDOFF.md`. Each handoff must live here and be self-contained enough for the recipient to continue without chat history.

## Review responses

Handoff reviews live under:

```text
docs/superpowers/handoff/reviews/
```

A review exists to capture not only what looks wrong, but also whether a difference may be intentional, whether evidence is missing, and whether a different implementation could contain a useful idea worth preserving.

Review files use:

```text
<reviewer>-<YYYYMMDD-HHmmss>-<handoff-short>-review.md
```

Each review must link back to the exact handoff it reviews and record the reviewed Git SHA.

Review findings use these classifications:

```text
CONFIRMED_DEFECT
INTENTIONAL_DEVIATION
CONTEXT_MISSING
PROPOSED_IMPROVEMENT
NEEDS_OWNER_DECISION
```

A reviewer must not assume motive. Separate observed facts from inferred intent, verified intent, evidence, recommendation, and owner decision. Plausible but unverified rationale must be labeled `Possible rationale — unverified`.

A review does not automatically authorize fixes. Findings that require architecture/product trade-offs or lack enough evidence must be escalated instead of silently changed.

Read `docs/superpowers/handoff/reviews/README.md` for the protocol and use `docs/superpowers/handoff/reviews/TEMPLATE.md` when creating a new review.
