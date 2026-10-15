# audit-trust Architecture

> Canonical v3.7 / frozen Database v1 is authoritative.

## Ownership

Generic audit history remains cross-cutting evidence only. Database v1 trust semantics are represented by Review and TrustReport concepts; they do not own Listing, Tenancy, Property or Incident lifecycle.

## TrustReport invariant

A TrustReport targets exactly one of:

- Listing
- Review

It does not target arbitrary domain resources.

## Review boundary

Review eligibility is derived from ended-tenancy participation and eligible linked User context. The current model does not create a public personal landlord/user rating authority.

## OPEN policies

Authentication requirement, rate limits, moderation/evidence policy and other `[OPEN]` items remain explicitly unresolved until Canonical decides them.

## Rebuild note

Current generic targetType/targetId reporting is pre-database-v1 and should fail conformance until narrowed to the frozen target model.