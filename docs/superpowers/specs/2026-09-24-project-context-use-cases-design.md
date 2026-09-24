# Project Context & Use Case Documentation Design

Status: Draft for review

## 1. Problem

The backend now has module-level README and ARCHITECTURE documents that explain responsibility, ownership, state, boundaries, persistence independence, and cross-module relationships.

However, a new contributor or agent can still understand each module separately without understanding the product as a whole.

The missing layer is project-level context that answers:

- What is TrọƠi?
- Which problem does it solve?
- Who pays, who operates, who interacts, and who belongs to later phases?
- Which product flows matter in the MVP?
- How does one real user action cross several bounded contexts?
- Which modules own each part of an end-to-end use case?
- Which features are supporting surfaces instead of the product core?
- In what order should an agent read documentation before implementation?

This documentation must sit above module architecture without duplicating implementation details.

## 2. Source of Truth

Project-level context must follow the reworked EXE101 documents currently treated as the product baseline.

The product definition is:

TrọƠi is a rental-operations record focused on each room or rental asset. Its core value is recording, following, and reconciling operational information throughout the rental lifecycle, including tenant context, rent, deposit, fees, receivables, receipts, incidents, and operational history.

The product must not be framed primarily as another room-search application.

Room discovery or listing may exist as an entry or support surface, but post-rental operations remain the core positioning.

## 3. Product Actors

Project-level documentation must distinguish business actors clearly.

### 3.1 Payer

The primary payer is the landlord, owner, or party responsible for rental operations.

This actor decides whether the product creates enough operational value to justify subscription payment.

### 3.2 Operator

The operator is the person performing day-to-day rental operations.

An operator may be the landlord directly, a relative, a property manager, or an operational staff member.

The operator works with room records, receivables, receipts, incidents, and operational history.

### 3.3 Tenant User

The tenant is a strategic user but not the main source of MVP revenue.

The tenant participates in operational interaction such as viewing relevant rental information, viewing or confirming receipts when required, reporting incidents, and creating two-way operational evidence.

### 3.4 Future Service Partner

Service partners belong to a later controlled layer.

The MVP records incident demand and handling history first. Partner connection becomes appropriate only after enough real incident data and operating capability exist.

The architecture must not assume an open technician marketplace in the MVP.

## 4. Product Scope

### 4.1 MVP Core

Project-level context must identify these as the operational core:

- room or rental-asset operational profile;
- tenant information only at the level needed for operation;
- rent, deposit, utilities, and recurring-fee baseline;
- receivables and monthly collection tracking;
- receipts or payment records used for operational reconciliation;
- incident reporting and processing history;
- basic operational dashboard;
- minimal tenant interaction layer;
- onboarding support including templates and bulk import where appropriate;
- audit/history for important operational facts;
- subscription as the initial commercial model for the payer side.

### 4.2 Supporting Surface

Listing, discovery, and map presentation can support the rental lifecycle, but they are not the primary product positioning.

The documentation must prevent agents from interpreting the presence of a `listing` module as evidence that TrọƠi is primarily a rental-search marketplace.

### 4.3 Explicit MVP Non-goals

Project-level documents must state that the MVP does not assume:

- an uncontrolled service marketplace;
- legal adjudication or legal-service guarantees;
- guaranteed outcomes in deposit or cost disputes;
- a complete in-platform payment system;
- AI/OCR as a core product dependency;
- TrọƠi itself guaranteeing maintenance quality;
- a fully activated three-sided marketplace.

## 5. Documentation Structure

The project will add four project-level entry documents.

### 5.1 Root `README.md`

Purpose: fast orientation.

It must answer in a short form:

- what TrọƠi is;
- what the product core is;
- who the main actors are;
- what phase the backend currently focuses on;
- which documents an agent should read next.

It must not become a duplicate product specification.

### 5.2 `docs/PROJECT_CONTEXT.md`

Purpose: explain product identity and domain context.

Required sections:

1. Product Definition
2. Problem Being Solved
3. Product Positioning
4. Actors
5. Economic Roles
6. Core Domain
7. MVP Scope
8. Non-goals
9. Product Phases
10. Domain Vocabulary
11. Architectural Mental Model
12. Reading Order for Agents

This document describes why the system exists and how to think about it before reading individual modules.

### 5.3 `docs/USE_CASES.md`

Purpose: describe end-to-end business behavior from the user perspective.

This document must not define API contracts, DTOs, database schemas, framework code, or transport details.

Each use case must contain:

- use-case identifier and name;
- primary actor;
- business goal;
- preconditions expressed at business level;
- main flow;
- relevant alternate or intentionally unresolved conditions;
- participating modules;
- primary owner of the flow;
- boundary notes explaining what participating modules are not allowed to assume.

The initial use-case set is defined in Section 6.

### 5.4 `docs/SYSTEM_CONTEXT.md`

Purpose: connect product concepts, use cases, and bounded contexts.

This document must contain:

- high-level system mental model;
- module relationship overview;
- use-case-to-module ownership matrix;
- rules for cross-module collaboration;
- state-independence reminder;
- reference/decision/event communication model;
- project-level reading flow into module-level documentation.

This document must not repeat every module architecture file.

## 6. Initial End-to-End Use Cases

### UC-01 — Authenticate an Actor

Primary actor: any user entering the application.

Goal: accept a valid external identity into the system without pretending to know profile or domain data that has not yet been loaded.

Main flow:

Identity proof is verified, a valid identity is accepted, and the actor may proceed at the authentication level.

The system may still not know the actor's complete profile, organization membership, property access, room relationship, or subscription context.

Participating areas:

- external identity integration;
- identity-access.

Primary owner: identity-access after provider verification has been normalized.

Boundary rule: authentication success must not require fabricated profile data.

### UC-02 — Set Up a Rental Operation

Primary actor: landlord or operator.

Goal: establish the minimum operational structure needed to manage real rental assets.

Main flow:

The authenticated actor operates within or establishes an organization scope, creates or imports property information, creates rooms, and reaches a state where rooms can participate in rental workflows.

Participating modules:

- identity-access;
- organization;
- property;
- room;
- onboarding when bulk setup is used.

Primary ownership is distributed by bounded context. No single setup module owns the resulting property, room, or tenancy data after creation.

### UC-03 — Start a Tenancy

Primary actor: landlord or operator.

Secondary actor: tenant.

Goal: create an operational rental relationship between a room and a tenant for a defined rental period.

Main flow:

A valid room and tenant identity context are selected, rental terms are recorded at the level needed for operation, and the tenancy begins its active lifecycle when business conditions are satisfied.

Participating modules:

- room;
- identity-access;
- tenancy;
- audit-trust for important facts.

Primary owner: tenancy.

Boundary rule: room must not absorb tenancy lifecycle, tenant profile, billing state, or receipt history.

### UC-04 — Track a Monthly Receivable and Payment Record

Primary actor: landlord or operator.

Secondary actor: tenant when confirmation or viewing is part of the flow.

Goal: know what is due for a rental period, what has been recorded as paid, and what remains outstanding.

Main flow:

Tenancy context provides the rental baseline, a billing period is established, charges are recorded, payment information is recorded through the receipt/payment-record boundary, and billing updates its receivable state from authorized payment outcomes.

Participating modules:

- tenancy;
- billing;
- receipt;
- identity-access when actor authorization is needed;
- audit-trust for important facts.

Primary owner of receivable state: billing.

Primary owner of operational payment/receipt record: receipt.

Boundary rule: receipt must not calculate the entire debt model, while billing must not take ownership of receipt history.

### UC-05 — Report and Resolve an Incident

Primary actor: tenant or operator reporting a problem.

Responding actor: landlord or operator.

Goal: record a room-related issue and follow its handling history until resolution or closure.

Main flow:

An authorized actor reports an incident for a valid room context. The incident is acknowledged, processed, may require additional information, is resolved, and is eventually closed according to its lifecycle.

Relevant business changes may cause notifications or audit facts, but those side effects do not own the incident lifecycle.

Participating modules:

- identity-access;
- room;
- tenancy when the right to report depends on rental relationship;
- incident;
- audit-trust;
- notification boundary when introduced.

Primary owner: incident.

Boundary rule: the incident module can operate with actor and room references without needing complete profiles or device information.

### UC-06 — View an Operational Dashboard

Primary actor: landlord or operator.

Goal: obtain a concise operational view of the rental business.

The MVP dashboard focuses on facts such as active rooms, unpaid receivables, and unresolved incidents.

Participating modules may include:

- room;
- billing;
- incident;
- receipt where reconciliation context is needed.

The dashboard is a read model or presentation concern. It does not become the owner of the underlying states.

### UC-07 — Tenant Operational Interaction

Primary actor: tenant.

Goal: participate in the rental operation without becoming the primary administrative user.

Main flow:

A tenant associated with an existing rental context enters through the authorized identity path, views permitted rental information, views receipts or payment records, confirms information when required, reports incidents, and reads permitted operational history.

Participating modules:

- identity-access;
- tenancy;
- room;
- receipt;
- incident;
- audit-trust where permitted history is exposed.

Boundary rule: the tenant layer consumes domain capabilities but does not own room, tenancy, billing, receipt, or incident state.

### UC-08 — Publish or Discover a Room

Primary actors: landlord/operator for publishing and prospective tenant for discovery.

Goal: provide an entry surface for room discovery when the product requires it without redefining TrọƠi as a search-first marketplace.

Main flow:

A valid room and property context may be projected into public listing content, published, discovered, and shown through search or map presentation according to listing rules.

Participating modules:

- property;
- room;
- listing;
- audit-trust where publish history matters.

Primary owner of public content and publish lifecycle: listing.

Boundary rule: listing is a public projection and must not own post-rental operational history.

### UC-09 — Future Controlled Service Partner Connection

Primary actors: operator and verified service partner in a later product phase.

Goal: route structured operational demand to controlled partners only after enough real incident data and quality-control capability exist.

Precondition: this is not an MVP core flow.

Main direction:

Incident demand is accumulated first. Later phases may introduce verified partner discovery, controlled connection, completion confirmation, and quality mechanisms.

Boundary rule: the architecture must not turn the MVP incident module into an open marketplace.

## 7. System Mental Model

The project-level model is hierarchical in ownership but collaborative in behavior.

A simplified domain path is:

Organization → Property → Room → Tenancy → Billing → Receipt

Incident references Room and may reference Tenancy context.

Listing projects selected Room and Property context for public discovery.

Identity-access provides identity and access decisions without taking ownership of domain data.

Audit-trust records important business facts without taking ownership of their source lifecycle.

Subscription determines product entitlement at the organization level without replacing feature-specific business rules.

Onboarding coordinates initial data entry but transfers ownership to destination modules once domain data is created.

## 8. Cross-Module Rules

Project-level documents must reinforce these rules:

1. A module may know another module's public reference, decision, or event.
2. A module must not read another module's internal representation to reconstruct its business rules.
3. State remains independent across bounded contexts.
4. Persistence enriches and restores business knowledge; it does not define the business flow.
5. Unknown data remains unknown until an authoritative source provides it.
6. Side effects such as notification, analytics, search indexing, or audit do not take ownership of the source business lifecycle.
7. Supporting surfaces such as listing, map, or dashboard must not redefine the ownership of source domains.

## 9. Agent Reading Order

The project must define this default reading order for implementation agents:

1. Root `README.md`
2. `docs/PROJECT_CONTEXT.md`
3. `docs/USE_CASES.md`
4. `docs/SYSTEM_CONTEXT.md`
5. Target module `README.md`
6. Target module `ARCHITECTURE.md`
7. Related module documents referenced by the use case
8. Only then inspect or modify implementation

This order is intended to prevent locally correct but product-inconsistent implementation.

## 10. Documentation Constraints

The four project-level documents must not contain production source code.

They must not define:

- DTOs;
- interfaces;
- database schemas;
- ORM models;
- framework syntax;
- provider-specific implementation;
- endpoint signatures;
- pseudo-code that dictates implementation shape.

They describe product intent, business flows, bounded-context ownership, collaboration, and evolution.

## 11. Relationship to Existing Module Architecture

Existing module `ARCHITECTURE.md` files remain authoritative for module-local ownership and invariants.

Project-level documents answer the broader question of why and when modules collaborate.

When project-level use-case wording conflicts with a module-local invariant, the conflict must be resolved explicitly before implementation rather than silently choosing one document.

## 12. Deliverables After Approval

After this design is approved, the documentation rollout will create or update:

- `README.md` at repository root;
- `docs/PROJECT_CONTEXT.md`;
- `docs/USE_CASES.md`;
- `docs/SYSTEM_CONTEXT.md`.

No product runtime code is part of this rollout.

The rollout must be followed by a consistency review against all module README and ARCHITECTURE documents, especially identity-access, room, tenancy, billing, receipt, incident, listing, onboarding, subscription, and audit-trust.
