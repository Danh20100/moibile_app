# Handoff Review — <short description>

```yaml
review_of: docs/superpowers/handoff/<handoff-file>.md
reviewer: <reviewer>
reviewed_sha: <git-sha>
status: accepted | changes-requested | owner-decision-required
```

## Review scope

State exactly what was reviewed:

```text
files / commits / runtime evidence / tests / CI run / handoff sections
```

Also state what was not reviewed so absence of a finding is not mistaken for approval.

## Findings

### Finding 1 — <short title>

**Classification:** `CONFIRMED_DEFECT | INTENTIONAL_DEVIATION | CONTEXT_MISSING | PROPOSED_IMPROVEMENT | NEEDS_OWNER_DECISION`

**Observed fact**

Describe only what is directly observable.

**Inferred intent**

If intent is not proven, write:

```text
Possible rationale — unverified: <rationale>
```

Otherwise write `none`.

**Verified intent**

Cite the explicit source of intent, or write `none`.

**Evidence**

Record concrete evidence such as:

```text
file/path:line or symbol
commit SHA / message
test name and result
CI run / artifact
spec / plan / handoff section
owner statement
```

**Why this matters**

Explain the technical/product impact without assuming motive.

**Reviewer recommendation**

State the recommended action and trade-offs.

**Owner decision**

Use one of:

```text
not required
pending
accepted recommendation
rejected recommendation
custom decision: <text>
```

## Intentional deviations retained

List deviations that should remain because their rationale is verified or accepted.

If none:

```text
None.
```

## Open owner decisions

List only unresolved `NEEDS_OWNER_DECISION` items.

If none:

```text
None.
```

## Review conclusion

Summarize:

```text
confirmed defects: N
intentional deviations: N
context missing: N
proposed improvements: N
owner decisions required: N
```

Final review status must match the metadata at the top of the file.
