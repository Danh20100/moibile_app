# V1 E2E case matrix

`flows/` answers **what product action exists**. `cases/` answers **which situations must be tested for that action**.

Case kinds include happy path, negative validation, authorization, privacy, lifecycle/state guards, invariants, concurrency, open-policy boundaries, and cross-actor effects.

Cross-actor example for V1 discovery/contact:

`Searcher submits Inquiry -> Inquiry is persisted -> operator receives Notification -> operator opens the same Inquiry`.

This is **Inquiry/Contact**, not appointment booking or reservation. V1 explicitly excludes OTA/instant-booking semantics. If product copy later uses wording such as `Hẹn chủ trọ`, the backend meaning must still remain Inquiry/Contact unless Canonical is changed.

Notification assertions cover recipient, source reference, delivery/read facts, and navigation. They do not assume push, email, SMS, or Zalo because exact channels remain OPEN.

Run static completeness validation with:

```powershell
pnpm e2e:coverage
```

The validator fails when an atomic flow has no case, a case references an unknown flow, a V1 backlog source is missing, or one of the frozen Notification use cases is not covered.
