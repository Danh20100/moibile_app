# room

> Authority: Canonical v3.7 / frozen Database v1 override this module and current code.

## Purpose

`room` owns Room identity plus two independent dimensions:

- `operationalState = vacant | occupied | maintenance | inactive`
- `recordLifecycle = active | archived`

## Current Database v1 boundary

- Room does not own agreed rent / base rent truth;
- operational transitions are cause-aware (`manual`, `tenancy_activated`, `checkout_confirmed`);
- archive requires `inactive` plus no non-terminal Tenancy and no open Incident;
- archived parent Property blocks create and inactive→vacant reactivation.
