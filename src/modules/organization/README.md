# organization

> Authority: `docs/database/canonical-v3.7.md` and frozen ERD3 override this module and current code.

## Purpose

`organization` owns the rental operating workspace.

## Current ERD3 boundary

- Organization identity;
- exactly one primary owner/operator reference for the MVP model;
- relationship to child Properties;
- no invented generic lifecycle unless frozen authority defines one.

Advanced team/member delegation is FUTURE.

## Known pre-ERD3 code drift

Current contracts still expose `OrganizationStatus = active | inactive | archived` and omit the primary-owner reference. Those are pre-ERD3 contracts scheduled for rebuild.