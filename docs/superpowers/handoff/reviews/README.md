# Handoff Reviews

This directory stores immutable review responses to handoff documents.

A review is not an automatic bug-fix instruction. Its purpose is to record what the reviewer observed, what may have been intentional, what evidence exists, and what still requires a decision.

## File naming

Use:

```text
<reviewer>-<YYYYMMDD-HHmmss>-<handoff-short>-review.md
```

Rules:
- `reviewer`: lowercase agent/person handle.
- timestamp: local project time (`Asia/Ho_Chi_Minh`, UTC+07:00).
- `handoff-short`: concise kebab-case identifier derived from the reviewed handoff.
- one review event = one immutable timestamped Markdown file.
- never overwrite an earlier review; create a new review for each review round.

## Required metadata

Every review must identify:

```yaml
review_of: docs/superpowers/handoff/<handoff-file>.md
reviewer: <reviewer>
reviewed_sha: <git-sha>
status: accepted | changes-requested | owner-decision-required
```

## Finding classifications

Every finding must use exactly one primary classification:

- `CONFIRMED_DEFECT` — evidence shows the implementation or handoff violates an approved contract, test, spec, or invariant.
- `INTENTIONAL_DEVIATION` — the implementation differs from the plan/spec, and evidence supports that the deviation was deliberate and justified.
- `CONTEXT_MISSING` — the behavior looks questionable, but available evidence is insufficient to determine whether it is wrong or intentional.
- `PROPOSED_IMPROVEMENT` — the current behavior is not proven wrong, but there is a defensible improvement with explicit trade-offs.
- `NEEDS_OWNER_DECISION` — multiple valid choices exist and choosing among them changes architecture, product behavior, scope, or authority.

Do not convert every difference from the plan into `CONFIRMED_DEFECT`.

## Evidence discipline

For each finding, separate these concepts explicitly:

```text
Observed fact
Inferred intent
Verified intent
Evidence
Reviewer recommendation
Owner decision
```

Rules:
- `Observed fact` must be directly supported by code, tests, logs, commits, docs, or runtime evidence.
- `Inferred intent` must be labeled unverified unless evidence exists.
- `Verified intent` requires an explicit source such as commit message, comment, spec, test name/assertion, handoff text, or owner statement.
- Never state that an agent "intentionally" did something without evidence.
- If the rationale is plausible but unverified, write `Possible rationale — unverified`.
- Reviewer recommendation is advisory unless the handoff or owner explicitly authorizes implementation.

## Review workflow

```text
handoff created
  -> recipient reads handoff
  -> reviewer inspects implementation/evidence
  -> review file created
  -> findings classified
  -> intentional deviations explained or challenged
  -> owner decisions raised when required
  -> implementation/fix proceeds only within authorized scope
```

A review can end in:

```text
accepted
changes-requested
owner-decision-required
```

## Decision rules

- A `CONFIRMED_DEFECT` may be fixed directly only when the current execution scope already authorizes that fix.
- An `INTENTIONAL_DEVIATION` must preserve its rationale in the review even if the owner later chooses to revert it.
- A `CONTEXT_MISSING` finding must not trigger code changes until evidence is gathered or the owner explicitly decides.
- A `PROPOSED_IMPROVEMENT` must state costs/trade-offs and is not a defect by default.
- A `NEEDS_OWNER_DECISION` finding is a hard stop for that decision branch; agents must not silently choose.

Use `docs/superpowers/handoff/reviews/TEMPLATE.md` for new reviews.
