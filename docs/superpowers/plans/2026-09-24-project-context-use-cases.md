# Project Context & Use Cases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a project-level documentation layer that tells contributors and agents what TrọƠi is, who uses it, which end-to-end use cases matter, and how those use cases map across bounded contexts before implementation begins.

**Architecture:** Add four Markdown entry documents above the existing module README/ARCHITECTURE layer. The root README provides orientation; PROJECT_CONTEXT defines product identity and scope; USE_CASES describes end-to-end business behavior; SYSTEM_CONTEXT maps those flows to module ownership and collaboration rules. Existing module architecture remains authoritative for module-local invariants.

**Tech Stack:** Markdown, Git, existing TrọƠi module documentation.

**Spec:** `docs/superpowers/specs/2026-09-24-project-context-use-cases-design.md`

## Global Constraints

- No product runtime code is part of this rollout.
- No DTOs, interfaces, database schemas, ORM models, endpoint signatures, framework syntax, provider-specific implementation, or implementation-shaping pseudo-code in the four project-level documents.
- TrọƠi must be positioned primarily as a rental-operations record / “sổ vận hành thuê trọ”, not as a search-first marketplace.
- Landlord/owner/payer, operator, tenant user, and future service partner must remain distinct roles.
- Listing/discovery/map are supporting surfaces, not the product core.
- Service-partner connection is Phase 2+ and must not be represented as an open MVP marketplace.
- Unknown information remains unknown until an authoritative source provides it.
- Existing module `ARCHITECTURE.md` files remain authoritative for module-local ownership and invariants.

## Review Focus

1. Product-positioning drift: no document may make discovery/listing appear to be the core purpose of TrọƠi.
2. Actor conflation: payer, operator, tenant, and future partner must not be treated as interchangeable identities or economic roles.
3. Phase leakage: Phase 2/3 capabilities must not be described as MVP guarantees.
4. Ownership leakage: end-to-end flows must not imply one orchestration/read surface owns the states of participating modules.
5. Documentation contradiction: project-level wording must not silently conflict with module-local ownership, state, or invariants.

---

### Task 1: Create the Root Project Entry README

**Files:**
- Create: `README.md`
- Read: `docs/superpowers/specs/2026-09-24-project-context-use-cases-design.md`
- Read: `src/modules/*/README.md`

**Interfaces:**
- Consumes: project definition, actors, MVP scope, and reading order from the spec.
- Produces: the first project entry point used by humans and agents before deeper documentation.

- [ ] **Step 1: Confirm the root README does not already exist**

Run: `git ls-files README.md`

Expected: no tracked root `README.md`.

- [ ] **Step 2: Write the root README with only fast-orientation content**

Required content:

- one-paragraph product definition;
- “Core / Primary payer / Secondary user / Future layer” orientation;
- explicit statement that listing/search is supportive, not the core positioning;
- current backend documentation model;
- exact reading order: `README.md` → `docs/PROJECT_CONTEXT.md` → `docs/USE_CASES.md` → `docs/SYSTEM_CONTEXT.md` → target module `README.md` → target module `ARCHITECTURE.md` → related module docs → implementation;
- links to the three project-level docs and `src/modules/`.

Do not duplicate full use cases or module responsibilities here.

- [ ] **Step 3: Verify README terminology**

Run: `rg -n "sổ vận hành|landlord|operator|tenant|listing|PROJECT_CONTEXT|USE_CASES|SYSTEM_CONTEXT" README.md`

Expected: all orientation concepts are present.

- [ ] **Step 4: Check forbidden implementation leakage**

Run: `rg -n "interface |DTO|Prisma|TypeORM|CREATE TABLE|SELECT |INSERT |endpoint|controller|service class" README.md`

Expected: no matches.

- [ ] **Step 5: Commit**

Run:

`git add README.md && git commit -m "docs: add project orientation readme"`

---

### Task 2: Create `docs/PROJECT_CONTEXT.md`

**Files:**
- Create: `docs/PROJECT_CONTEXT.md`
- Read: `docs/superpowers/specs/2026-09-24-project-context-use-cases-design.md`
- Read: relevant module README files for terminology consistency.

**Interfaces:**
- Consumes: product identity, actors, MVP scope, non-goals, phases, and reading-order rules from the spec.
- Produces: the authoritative project-level explanation of why TrọƠi exists and how to think about the domain before reading module internals.

- [ ] **Step 1: Write all 12 required sections**

Required headings:

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

- [ ] **Step 2: Make actor/economic-role distinctions explicit**

The document must state that payer, operator, tenant user, and future service partner are distinct roles and that one real person may occupy more than one role without collapsing the role definitions.

- [ ] **Step 3: Lock product positioning and phase boundaries**

The document must explicitly state:

- post-rental operations are the core;
- listing/discovery/map are supporting surfaces;
- MVP does not assume an uncontrolled service marketplace, legal adjudication, guaranteed deposit/cost outcomes, a complete in-platform payment system, AI/OCR as a core dependency, TrọƠi-guaranteed maintenance quality, or a fully activated three-sided marketplace;
- partner connection belongs to later controlled phases.

- [ ] **Step 4: Verify structure and forbidden content**

Run:

`rg -n "^## [0-9]+\." docs/PROJECT_CONTEXT.md`

Expected: exactly 12 numbered project-context sections.

Run:

`rg -n "interface |DTO|Prisma|TypeORM|CREATE TABLE|SELECT |INSERT |endpoint|controller|class " docs/PROJECT_CONTEXT.md`

Expected: no implementation leakage.

- [ ] **Step 5: Commit**

Run:

`git add docs/PROJECT_CONTEXT.md && git commit -m "docs: add project context"`

---

### Task 3: Create `docs/USE_CASES.md`

**Files:**
- Create: `docs/USE_CASES.md`
- Read: `docs/superpowers/specs/2026-09-24-project-context-use-cases-design.md`
- Read: `src/modules/identity-access/ARCHITECTURE.md`
- Read: `src/modules/room/ARCHITECTURE.md`
- Read: `src/modules/tenancy/ARCHITECTURE.md`
- Read: `src/modules/billing/ARCHITECTURE.md`
- Read: `src/modules/receipt/ARCHITECTURE.md`
- Read: `src/modules/incident/ARCHITECTURE.md`
- Read: `src/modules/listing/ARCHITECTURE.md`

**Interfaces:**
- Consumes: project actors and module-local ownership/invariants.
- Produces: end-to-end business flows that explain when and why bounded contexts collaborate.

- [ ] **Step 1: Define the use-case document format**

Each use case must include:

- identifier and name;
- primary actor;
- business goal;
- business-level preconditions;
- main flow;
- relevant alternate or intentionally unresolved conditions;
- participating modules;
- primary owner of the flow or explicit distributed ownership;
- boundary notes.

Do not add transport/API/database detail.

- [ ] **Step 2: Write UC-01 through UC-04**

Required use cases:

- UC-01 Authenticate an Actor;
- UC-02 Set Up a Rental Operation;
- UC-03 Start a Tenancy;
- UC-04 Track a Monthly Receivable and Payment Record.

Preserve the rule that authentication may succeed before profile/domain enrichment exists.

- [ ] **Step 3: Write UC-05 through UC-09**

Required use cases:

- UC-05 Report and Resolve an Incident;
- UC-06 View an Operational Dashboard;
- UC-07 Tenant Operational Interaction;
- UC-08 Publish or Discover a Room;
- UC-09 Future Controlled Service Partner Connection.

Mark UC-09 explicitly as later-phase, not MVP core.

- [ ] **Step 4: Verify every use case has ownership and boundary language**

Run:

`rg -n "^## UC-0[1-9]" docs/USE_CASES.md`

Expected: exactly nine use-case headings.

Run:

`rg -n "Primary owner|Participating modules|Boundary" docs/USE_CASES.md`

Expected: each use case includes ownership/collaboration guidance.

- [ ] **Step 5: Check implementation leakage**

Run:

`rg -n "interface |DTO|Prisma|TypeORM|CREATE TABLE|SELECT |INSERT |POST /|GET /|controller|service class" docs/USE_CASES.md`

Expected: no matches.

- [ ] **Step 6: Commit**

Run:

`git add docs/USE_CASES.md && git commit -m "docs: add end-to-end use cases"`

---

### Task 4: Create `docs/SYSTEM_CONTEXT.md`

**Files:**
- Create: `docs/SYSTEM_CONTEXT.md`
- Read: `docs/PROJECT_CONTEXT.md`
- Read: `docs/USE_CASES.md`
- Read: all `src/modules/*/ARCHITECTURE.md` files.

**Interfaces:**
- Consumes: project context, use cases, and module-local architecture.
- Produces: the project-level map from business flows to bounded-context ownership and collaboration rules.

- [ ] **Step 1: Write the system mental model**

The document must explain this ownership path in prose:

Organization → Property → Room → Tenancy → Billing → Receipt.

It must also explain:

- Incident references Room and may use Tenancy context;
- Listing projects selected Room/Property context for public discovery;
- Identity-access provides identity/access decisions without owning domain data;
- Audit-trust records important business facts without taking source lifecycle ownership;
- Subscription provides organization-level entitlement decisions without replacing feature business rules;
- Onboarding coordinates initial entry and transfers resulting domain ownership to destination modules.

- [ ] **Step 2: Add the use-case-to-module ownership matrix**

The matrix must cover UC-01 through UC-09 and identify:

- primary owner;
- collaborators;
- whether the interaction is primarily reference, decision, event, or read-model aggregation.

- [ ] **Step 3: Add project-wide collaboration rules**

Required rules:

- module-to-module knowledge uses public references, decisions, and events;
- no module reconstructs another module’s business rules from internal state;
- bounded-context state remains independent;
- persistence restores/enriches knowledge but does not define business flow;
- unknown data remains unknown until authoritative enrichment;
- side-effect consumers do not take lifecycle ownership;
- listing/map/dashboard/read models do not redefine source-domain ownership.

- [ ] **Step 4: Add the project reading flow**

Repeat the canonical documentation order and explain why related module docs must be read for cross-module use cases.

- [ ] **Step 5: Verify cross-module coverage**

Run:

`rg -n "identity-access|organization|property|room|tenancy|billing|receipt|incident|listing|onboarding|subscription|audit-trust" docs/SYSTEM_CONTEXT.md`

Expected: all current bounded contexts are represented.

Run:

`rg -n "reference|decision|event|independent|unknown|ownership" docs/SYSTEM_CONTEXT.md`

Expected: the collaboration model is explicit.

- [ ] **Step 6: Commit**

Run:

`git add docs/SYSTEM_CONTEXT.md && git commit -m "docs: add system context map"`

---

### Task 5: Cross-Document Consistency Review and Final Verification

**Files:**
- Verify/modify if needed: `README.md`
- Verify/modify if needed: `docs/PROJECT_CONTEXT.md`
- Verify/modify if needed: `docs/USE_CASES.md`
- Verify/modify if needed: `docs/SYSTEM_CONTEXT.md`
- Verify only unless a conflict is found: `src/modules/*/README.md`
- Verify only unless a conflict is found: `src/modules/*/ARCHITECTURE.md`

**Interfaces:**
- Consumes: all project-level and module-level documentation.
- Produces: a coherent documentation hierarchy ready for implementation agents.

- [ ] **Step 1: Verify the four entry documents exist**

Run:

`git ls-files README.md docs/PROJECT_CONTEXT.md docs/USE_CASES.md docs/SYSTEM_CONTEXT.md`

Expected: all four paths are tracked.

- [ ] **Step 2: Review the five Review Focus risks manually**

Confirm:

- TrọƠi remains operations-first;
- actor roles stay distinct;
- Phase 2/3 features are not presented as MVP guarantees;
- orchestration/read surfaces do not take domain ownership;
- no project-level statement contradicts module-local architecture.

- [ ] **Step 3: Check documentation for implementation leakage**

Run:

`rg -n "interface |DTO|Prisma|TypeORM|CREATE TABLE|SELECT |INSERT |POST /|GET /|controller|service class" README.md docs/PROJECT_CONTEXT.md docs/USE_CASES.md docs/SYSTEM_CONTEXT.md`

Expected: no matches.

- [ ] **Step 4: Check product-positioning language**

Run:

`rg -n "sổ vận hành|operations|listing|marketplace|partner|MVP|Phase 2|Phase 3" README.md docs/PROJECT_CONTEXT.md docs/USE_CASES.md docs/SYSTEM_CONTEXT.md`

Expected: product core and later-phase boundaries are visible in the relevant documents.

- [ ] **Step 5: Verify only documentation changed from the branch base**

Run:

`git diff --name-only backend/core-foundations...HEAD`

Expected: only the design spec, implementation plan, root README, and the three project-level docs are changed.

- [ ] **Step 6: Check formatting**

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 7: Commit consistency fixes if any**

If review required changes, commit them with:

`git add README.md docs/PROJECT_CONTEXT.md docs/USE_CASES.md docs/SYSTEM_CONTEXT.md && git commit -m "docs: align project context and use cases"`

If no fixes are needed, do not create an empty commit.

- [ ] **Step 8: Final history check**

Run: `git log --oneline --decorate -8`

Expected: a short docs-only commit chain implementing this plan on top of the approved spec.
