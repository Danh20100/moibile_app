# onboarding Architecture

> Canonical v3.7 / frozen ERD3 is authoritative.

## Role

Onboarding is orchestration only. It may coordinate manual creation of CURRENT domain data but never owns Organization, Property or Room after creation.

## CURRENT versus FUTURE

CURRENT may reuse orchestration for explicit manual setup.

FUTURE includes:

- CSV/Excel import;
- bulk-file parsing;
- import templates and import-specific mapping pipelines.

No current-core invariant may depend on those FUTURE capabilities.

## Reconciliation note

Existing preview/confirm bulk setup is pre-ERD3 scaffolding. Conformance must distinguish reusable orchestration from import scope and must not delete current manual creation merely because CSV/Excel import is FUTURE.