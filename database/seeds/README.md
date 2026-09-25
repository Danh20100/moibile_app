# Database seeds

This directory is reserved for **future non-production seed data** used to make development and testing environments reproducible.

## Purpose

Potential future seed categories include:

- development-only sample organizations/properties/rooms;
- test fixtures required by integration tests;
- stable reference/catalog data such as approved amenity or incident categories, when the product model defines them;
- local demo data for development environments.

## Current status

**Skeleton only. No seed data or executable seed scripts have been added in this change.**

## Rules for future seed data

- Never commit production credentials or secrets.
- Never copy real tenant/customer personal data into repository seeds.
- Prefer synthetic data for development and testing.
- Keep environment-specific demo data clearly separated from stable reference data.
- Seed data must not become an undocumented source of business rules.
- If a reference value is required for the system to function, document its ownership and lifecycle explicitly.

The concrete seed runner/file format will be selected only when the backend persistence/migration approach is approved.
