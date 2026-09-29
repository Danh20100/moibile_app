# Backend Wave B Feature Briefs

Historical feature briefs copied from `integration/backend-database` after backend/database convergence.

## Source baseline

- Source branch: `integration/backend-database`
- Converged merge baseline: `50465bf0ddafc1b7aec2b1e8dfafde35636ca4b9`
- Database implementation baseline represented by the converged tree: `33975fb4c9300d444c3912fdc9bb7d04d030aab6`
- Original backlog creation commit: `92bbc7b72cbeb197daa21f7f9b13a51a5825d071` (`docs: add backend feature backlogs`)

The feature files in this directory are preserved byte-for-byte from the source branch. They are historical briefs, **not live backlog items and not authority**.

## Delivery evidence

| Brief | Backend delivery evidence | Persistence evidence |
| --- | --- | --- |
| `listing.md` | `0a46f3b32051cb5601f1fd351e1ec24aea463646` — rebuild Listing lifecycle/history | `827ae2be17444e62049fdd4973dd9abd3cb82ee6` — persist Listing/Inquiry services |
| `inquiry.md` | `4004b51b1d77b14cb7363338d6beba4f1386b1f8` — add Inquiry discovery bridge | `827ae2be17444e62049fdd4973dd9abd3cb82ee6` |
| `tenancy.md` | `ec0ec523446ce1b7ade0e3e3f848dd31965536e6` — rebuild Tenancy lifecycle contract | `c978d49683dbc13201b28a06d3e7d0ff8e368d1f` — persist Tenancy application services |
| `tenancy-participant.md` | `49f45d20277db38c14e7505477a666196477931f` — add Tenancy support features | `c978d49683dbc13201b28a06d3e7d0ff8e368d1f` |
| `tenancy-terms.md` | `49f45d20277db38c14e7505477a666196477931f` | `c978d49683dbc13201b28a06d3e7d0ff8e368d1f` |
| `terms-acknowledgement.md` | `49f45d20277db38c14e7505477a666196477931f` | `c978d49683dbc13201b28a06d3e7d0ff8e368d1f` |
| `tenancy-notice.md` | `49f45d20277db38c14e7505477a666196477931f` | `c978d49683dbc13201b28a06d3e7d0ff8e368d1f` |
| `rental-lifecycle.md` | `e433aaced262e850eb597466050579842daf8d1f` — coordinate Listing/Room/Tenancy lifecycle | persisted dependencies finalized through Task 17; final audit baseline `33975fb4c9300d444c3912fdc9bb7d04d030aab6` |

## Status at archive time

The converged database baseline records Task 17 as closing the source-of-truth audit and reports lint, typecheck, conformance, runtime, and full regression GREEN. This archive does not reinterpret canonical `OPEN`/`FUTURE` policy and does not claim that every future product capability is complete.
