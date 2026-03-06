[PRD]
# PRD: Vue Docs App For Comprehensive Repository Documentation

## Overview

Create a dedicated Vue documentation application for this monorepo that documents every relevant runtime, package, script, and operational workflow without changing existing product behavior. The docs app must reuse the exact Tailwind Plus Syntax visual system already present in this repository under `docs/tailwind-plus-syntax/syntax-ts`, but implemented as a Vue 3 application instead of the current Next.js template.

The docs app is a separate surface from the current markdown/QMD files in `docs/`. Existing documents should be treated as source material and migrated into a cohesive docs experience with navigation, search, table-of-contents behavior, syntax highlighting, and visual styling that matches the in-repo Tailwind Plus Syntax reference exactly.

Implementation scope for the future build must stay limited to docs work:
- `apps/docs/**`
- `docs/**`
- minimal workspace wiring required to run/build the docs app

No business logic changes are allowed in `apps/web`, `apps/api`, `apps/pipeline-monitor`, `packages/*`, or operational scripts beyond read-only inspection for documentation content.

## Goals

- Create a separate Vue docs app that covers the full repository surface area.
- Preserve the Tailwind Plus Syntax look and feel by porting its styles, layout patterns, navigation model, and content presentation exactly from the in-repo template.
- Consolidate existing markdown/QMD architecture, runbook, research, and review documents into a single navigable docs experience.
- Add complete documentation for the current workspace layout, app architecture, shared packages, API surfaces, sync flows, map layers, and operational scripts.
- Make the docs app usable for onboarding, maintenance, architecture review, and operational troubleshooting.
- Require `agent-browser` verification for every story so visual parity and navigation integrity are checked incrementally during implementation.

## Quality Gates

These commands and checks must pass for every user story:

- `bun --cwd apps/docs lint`
- `bun --cwd apps/docs typecheck`
- `bun --cwd apps/docs build`
- `bun x ultracite fix apps/docs docs`
- `bun x ultracite check apps/docs docs`
- Verify the changed route(s) with `agent-browser` at desktop (`1440x900`) and mobile (`390x844`) breakpoints.
- For each story, use `agent-browser` to confirm the touched screen preserves Tailwind Plus Syntax parity against the reference implementation in `docs/tailwind-plus-syntax/syntax-ts`.
- For each story, capture at least one screenshot showing the final verified state of the changed docs surface.

## User Stories

### US-001: Bootstrap the docs application workspace
**Description:** As a maintainer, I want a dedicated Vue docs app scaffolded inside the monorepo so that repository documentation can ship as an isolated surface without touching existing product apps.

**Acceptance Criteria:**
- [ ] Add a new docs app at `apps/docs` using Vue 3, Vite, Tailwind CSS 4, and TypeScript.
- [ ] Use Composition API with `<script setup lang="ts">` as the standard for all Vue components.
- [ ] Add only the minimal workspace wiring needed for local dev, build, typecheck, and lint for the docs app.
- [ ] The docs app can run independently from `apps/web`, `apps/api`, and `apps/pipeline-monitor`.
- [ ] The initial route renders a working app shell without importing runtime code from existing product apps.

### US-002: Port Tailwind Plus Syntax styling exactly into Vue
**Description:** As a docs reader, I want the docs app to look exactly like the in-repo Tailwind Plus Syntax template so that the documentation experience has a polished and consistent visual system.

**Acceptance Criteria:**
- [ ] Port the visual system from `docs/tailwind-plus-syntax/syntax-ts/src/styles/tailwind.css` and `docs/tailwind-plus-syntax/syntax-ts/src/styles/prism.css` into the Vue docs app.
- [ ] Reuse the Tailwind Plus Syntax font, color, spacing, gradient, code block, and prose treatment from the in-repo reference instead of inventing a new design.
- [ ] Preserve the Lexend-driven display typography and the dark/light styling behavior from the reference template.
- [ ] Reuse or faithfully port the Tailwind Plus Syntax static assets needed for the visual system, including the referenced fonts and background imagery.
- [ ] Document any unavoidable Vue-specific implementation differences while keeping the rendered result visually equivalent.

### US-003: Recreate the Tailwind Plus Syntax shell, navigation, and search in Vue
**Description:** As a docs reader, I want the Vue docs app to preserve the Tailwind Plus Syntax shell patterns so that navigation, search, table-of-contents, and reading flow work the same way as the reference.

**Acceptance Criteria:**
- [ ] Implement Vue equivalents for the Tailwind Plus Syntax shell patterns represented by the reference components under `docs/tailwind-plus-syntax/syntax-ts/src/components`.
- [ ] Recreate the landing hero, docs header, left navigation, mobile navigation, search modal, table of contents, prose wrapper, and previous/next navigation behavior in Vue.
- [ ] Preserve the navigation grouping model shown in `docs/tailwind-plus-syntax/syntax-ts/src/lib/navigation.ts`.
- [ ] Preserve section extraction and table-of-contents behavior equivalent to `docs/tailwind-plus-syntax/syntax-ts/src/lib/sections.ts`.
- [ ] Keep route-level views thin and place shared stateful behavior in focused composables/services.

### US-004: Define the repository documentation information architecture
**Description:** As a maintainer, I want a clear docs information architecture so that every relevant part of the repo has an obvious place in the docs app.

**Acceptance Criteria:**
- [ ] Define the final docs navigation tree before large-scale content migration begins.
- [ ] The top-level information architecture includes onboarding, repository architecture, applications, shared packages, data/sync flows, operations, API/contracts, and contribution guidance.
- [ ] Each section maps to concrete source areas in the repository rather than vague conceptual pages.
- [ ] The docs route structure is documented and stable enough to support search indexing and prev/next links.
- [ ] The IA explicitly covers existing `docs/architecture`, `docs/research`, `docs/review`, and `docs/runbooks` content.

### US-005: Build the docs content pipeline foundation
**Description:** As a docs maintainer, I want a repeatable content pipeline so that authored pages can be rendered, indexed, and organized consistently inside the Vue docs app.

**Acceptance Criteria:**
- [ ] Define the primary content format(s) the Vue docs app accepts for authored pages.
- [ ] Add content loading that can render headings, code fences, callouts, tables, and long-form prose.
- [ ] Add metadata support for navigation, search labels, section labeling, and prev/next linking.
- [ ] Keep the content system isolated to docs surfaces and independent of product app runtime code.
- [ ] Document the chosen content model in a maintainer-facing page or note within the docs app.

### US-006: Migrate the existing docs corpus into the new app
**Description:** As a maintainer, I want the existing architecture, research, review, and runbook materials migrated into the docs app so that the current docs corpus is not stranded outside the new experience.

**Acceptance Criteria:**
- [ ] Migrate content from `docs/architecture`, `docs/research`, `docs/review`, and `docs/runbooks` into the docs app.
- [ ] Preserve the meaning and structure of the current source documents during migration.
- [ ] Preserve code fences, headings, callouts, tables, and long-form technical content during migration.
- [ ] Ensure migrated pages participate in navigation and search.
- [ ] Keep migrated source content organized for long-term maintenance instead of using a one-off import path.

### US-007: Document workspace onboarding and repository architecture
**Description:** As a new engineer, I want onboarding and architecture docs so that I can understand the monorepo layout, commands, and boundaries without reading source blindly.

**Acceptance Criteria:**
- [ ] Add docs covering the workspace layout from `README.md` and the major repo conventions enforced in `AGENTS.md`.
- [ ] Document the shared commands used to install, run, build, test, lint, and typecheck the workspace.
- [ ] Explain the high-level architecture boundaries between apps, packages, shared contracts, and operational scripts.
- [ ] Include orientation for the existing architecture docs already stored under `docs/architecture`.
- [ ] Include an explicit “where to start” path for new contributors.

### US-008: Document the web app entrypoints and runtime foundations
**Description:** As a frontend engineer, I want docs for the web app shell and runtime foundations so that I can understand how the application is composed before diving into individual feature domains.

**Acceptance Criteria:**
- [ ] Document `apps/web` entrypoints, routing, page surfaces, and shared runtime plumbing.
- [ ] Document the role of the app shell, map runtime, shared UI plumbing, and cross-feature coordination layers.
- [ ] Explain how the web app depends on shared packages such as `contracts`, `map-engine`, `map-layer-catalog`, `map-style`, `geo-tiles`, and `ops`.
- [ ] Include documentation for map rendering responsibilities, layer management, and API integration boundaries at the app-shell level.
- [ ] Cover existing README information and current docs references that are relevant to the web runtime foundations.

### US-009: Document the web feature domains
**Description:** As a frontend engineer, I want docs for the web feature modules so that I can navigate domain-specific behavior without reconstructing it from source.

**Acceptance Criteria:**
- [ ] Document the major `apps/web/src/features/*` domains including basemap, boundaries, facilities, fiber locator, layers, markets, measure, navigation, parcels, power, providers, quick-view, scanner, spatial analysis, and table utilities.
- [ ] Group feature docs into digestible domain pages instead of one monolithic web page.
- [ ] Explain the responsibility boundaries between feature services, layers, composables, and page-level integration points.
- [ ] Cross-link feature-domain docs back to the runtime foundation docs and relevant shared packages.
- [ ] Ensure the feature-domain pages are discoverable in docs navigation and search.

### US-010: Document the API runtime foundations
**Description:** As a backend engineer, I want docs for the API runtime foundations so that I can understand entrypoints, transport helpers, runtime config, and worker boundaries before diving into slice-specific behavior.

**Acceptance Criteria:**
- [ ] Document `apps/api` entrypoints, runtime configuration, database wiring, and shared HTTP helpers.
- [ ] Document the distinction between the HTTP runtime and background worker runtime.
- [ ] Explain the role of shared response envelopes, request parsing helpers, policy services, and runtime configuration.
- [ ] Surface the currently documented API notes from `apps/api/README.md` where they fit in the foundation docs.
- [ ] Keep the foundation docs separate from per-slice endpoint documentation.

### US-011: Document the API geo slices
**Description:** As a backend engineer, I want docs for the geo slices so that I can understand route, repo, mapper, service, and policy responsibilities per domain.

**Acceptance Criteria:**
- [ ] Document the geo slices under `apps/api/src/geo`, including boundaries, facilities, fiber-locator, markets, parcels, and providers.
- [ ] Explain route, repo, mapper, service, and policy boundaries where they exist in the current codebase.
- [ ] Document the sync worker and parcel/hyperscale sync services where they intersect with geo-serving behavior.
- [ ] Cross-link slice docs back to the API runtime foundation docs and relevant runbooks.
- [ ] Ensure the geo-slice docs are split into digestible pages or subsections rather than a single oversized page.

### US-012: Document the pipeline monitor and pipeline tracking flow
**Description:** As an operator, I want docs for the pipeline monitor so that I can understand how ingestion progress and monitoring views are modeled in the repo.

**Acceptance Criteria:**
- [ ] Document `apps/pipeline-monitor` entrypoints, app structure, and feature boundaries.
- [ ] Document the pipeline dashboard, pipeline view, and pipeline tracking services.
- [ ] Explain how the pipeline monitor relates to parcel sync and operational runbooks.
- [ ] Make clear which data it reads, what states it visualizes, and how it fits into the broader repo.
- [ ] Cross-link the pipeline monitor docs to the relevant runbooks and sync architecture material.

### US-013: Document the shared package runtime surfaces
**Description:** As a contributor, I want docs for the core shared runtime packages so that I can understand the contract and rendering boundaries used by the apps.

**Acceptance Criteria:**
- [ ] Add package docs for `packages/contracts`, `packages/map-engine`, `packages/map-layer-catalog`, and `packages/map-style`.
- [ ] For each package, document its purpose, key exported responsibilities, current consumers, and important tests or build behavior.
- [ ] Explain contract-sharing patterns, map engine boundaries, layer catalog responsibilities, and style responsibilities with repo-specific detail.
- [ ] Avoid placeholder pages; each package page must contain concrete repo information.
- [ ] Cross-link package docs back to the app/runtime docs that consume them.

### US-014: Document the shared data and operations packages
**Description:** As a contributor, I want docs for the remaining shared data and operations packages so that I can understand query, tile, and support utilities used across the repo.

**Acceptance Criteria:**
- [ ] Add package docs for `packages/geo-sql`, `packages/geo-tiles`, `packages/ops`, `packages/bench`, and `packages/fixtures`.
- [ ] For each package, document its purpose, key exported responsibilities, current consumers, and important tests or build behavior.
- [ ] Explain SQL/query responsibilities, tile concerns, operational helper responsibilities, and support-package intent with repo-specific detail.
- [ ] Avoid placeholder pages; each package page must contain concrete repo information.
- [ ] Cross-link these package docs back to the app/runtime docs that consume them.

### US-015: Document the parcel and tile scripts
**Description:** As an operator, I want script docs for parcel and tile workflows so that I can understand the command-level operational path without reverse engineering shell scripts.

**Acceptance Criteria:**
- [ ] Document the repo-level scripts used for sync, tiles, schema setup, and parcel operations.
- [ ] Document the parcel ingestion flow, canonical load flow, tile build/publish flow, and rollback flow.
- [ ] Make explicit which commands are operational and which are development-only.
- [ ] Cross-link script docs to the API, pipeline-monitor, and runbook docs where the workflows overlap.
- [ ] Keep the script documentation scoped to the repo’s current production path without adding fallback narratives.

### US-016: Document operational runbooks and troubleshooting
**Description:** As an operator, I want runbook and troubleshooting docs so that incident handling and operational recovery steps are easy to locate in the docs app.

**Acceptance Criteria:**
- [ ] Migrate and expand the operational guidance currently stored in `docs/runbooks/spatial-analysis-ops.md`.
- [ ] Document troubleshooting entry points for stalled extraction, failed loads, failed tile builds, coherency mismatches, and drift-related operational issues.
- [ ] Ensure runbook pages clearly identify required inputs, checks, actions, and exit criteria.
- [ ] Cross-link runbooks to the related scripts, API runtime docs, and pipeline-monitor docs.
- [ ] Keep the runbook content searchable and discoverable from the docs navigation.

### US-017: Add API, contract, and documentation reference patterns
**Description:** As a maintainer, I want consistent reference patterns so that docs pages can point back to real code, contracts, and existing architecture artifacts without duplication drift.

**Acceptance Criteria:**
- [ ] Define a repeatable pattern for linking docs content to source files, route groups, packages, and existing docs artifacts.
- [ ] Add API and contract reference coverage for the current shared transport schemas in `packages/contracts`.
- [ ] Include reference coverage for the existing OpenAPI artifact under `docs/architecture/spatial-analysis-openapi.yaml`.
- [ ] Ensure reference pages distinguish between authoritative source files and explanatory docs content.
- [ ] Make code references navigable from the docs app without requiring readers to search the repo manually.

### US-018: Document the docs-authoring workflow and contribution standards
**Description:** As a contributor, I want clear docs-authoring guidance so that future docs updates stay consistent with the new app, the repo conventions, and the Tailwind Plus Syntax presentation model.

**Acceptance Criteria:**
- [ ] Add contributor documentation for how to add, edit, organize, and review docs content in the new docs app.
- [ ] Define naming, frontmatter, navigation, code-block, and cross-link conventions for docs content.
- [ ] Explain how future contributors should preserve Tailwind Plus Syntax parity instead of redesigning the docs UI.
- [ ] Document how browser verification with `agent-browser` is expected to be used during docs work.
- [ ] Ensure the contribution guidance lives inside the docs app and is linked from the main navigation.

### US-019: Add final parity and release verification for the docs app
**Description:** As a maintainer, I want a final verification pass so that the docs app can be shipped with confidence and without accidental divergence from the Tailwind Plus Syntax reference.

**Acceptance Criteria:**
- [ ] Create a release checklist that covers styling parity, route integrity, search behavior, TOC generation, mobile navigation, dark mode, and content rendering.
- [ ] Verify the final docs app against the Tailwind Plus Syntax reference pages and shared components already present in this repo.
- [ ] Verify onboarding, migrated docs, app docs, package docs, operations docs, and reference docs are all represented in navigation and search.
- [ ] Ensure no implementation work changes business behavior in existing apps or packages.
- [ ] Capture final `agent-browser` screenshots for the homepage, a deep docs page, the search flow, and the mobile navigation flow.

## Functional Requirements

1. FR-1: The system must provide a dedicated Vue docs app under `apps/docs`.
2. FR-2: The docs app must implement Vue 3 Composition API with `<script setup lang="ts">`.
3. FR-3: The docs app must preserve the visual system from `docs/tailwind-plus-syntax/syntax-ts` rather than introducing a new docs design.
4. FR-4: The docs app must provide a landing page, docs index pages, deep content pages, and search-driven navigation.
5. FR-5: The docs app must reproduce the Tailwind Plus Syntax docs shell patterns in Vue, including left navigation, docs header, TOC, prev/next links, and mobile navigation.
6. FR-6: The docs app must support long-form technical prose, code fences, tables, callouts, and reference-style content.
7. FR-7: The docs app must migrate and incorporate the current materials under `docs/architecture`, `docs/research`, `docs/review`, and `docs/runbooks`.
8. FR-8: The docs app must document the root workspace layout, shared commands, and conventions.
9. FR-9: The docs app must document `apps/web` comprehensively, including feature modules and page surfaces.
10. FR-10: The docs app must document `apps/api` comprehensively, including geo slices, HTTP helpers, and sync runtimes.
11. FR-11: The docs app must document `apps/pipeline-monitor` comprehensively, including pipeline tracking concerns.
12. FR-12: The docs app must document all relevant shared packages under `packages/*`.
13. FR-13: The docs app must document operational scripts and parcel/tile workflows.
14. FR-14: The docs app must include API/contract/reference patterns that point readers back to authoritative source locations.
15. FR-15: The docs app must provide contributor guidance for maintaining documentation quality and UI parity.
16. FR-16: Every implementation story must include browser verification using `agent-browser`.

## Non-Goals

- Rewriting business logic in `apps/web`, `apps/api`, `apps/pipeline-monitor`, `packages/*`, or `scripts/*`.
- Redesigning Tailwind Plus Syntax into a new visual language.
- Building a generic marketing site unrelated to repository documentation.
- Introducing fallback docs implementations outside the dedicated Vue docs app.
- Converting the docs effort into a broad repo refactor.
- Replacing operational source-of-truth files with vague summaries that lose technical detail.

## Technical Considerations

- The visual reference is the in-repo Tailwind Plus Syntax TypeScript template at `docs/tailwind-plus-syntax/syntax-ts`.
- Future implementation should port the template behavior into Vue, not embed or partially wrap the existing Next.js app.
- Route views in the Vue docs app should stay thin; shared behavior should live in focused components and composables, consistent with the repo’s Vue conventions.
- The content model should support existing markdown/QMD-derived docs while remaining maintainable for future authored pages.
- Search, navigation grouping, TOC extraction, and syntax highlighting should preserve the reference experience as closely as possible.
- The docs app should document repo surfaces through read-only source inspection and cross-linking, not by copying large chunks of implementation code.
- The docs app must remain operationally separate from the main product apps.

## Success Metrics

- A new engineer can navigate from the docs homepage to clear documentation for every app, package, and operational workflow listed in the current repo structure.
- The docs app visually matches the in-repo Tailwind Plus Syntax reference closely enough that parity issues are treated as bugs.
- Existing `docs/` material is migrated into the new app with no major content areas orphaned.
- Search and navigation make it possible to find key runtime/package/runbook information without manual repo spelunking.
- Every implementation story includes `agent-browser` verification artifacts showing the touched surface in working state.

## Open Questions

- Which content format should be the long-term authoring standard for the Vue docs app: Markdown-only, MDX-equivalent, or a custom markdown-plus-frontmatter pipeline?
- Should search be implemented with a static build-time index, a client-side local index, or another approach that preserves the Tailwind Plus Syntax interaction model in Vue?
- Should the docs app expose generated API/package metadata automatically where practical, or should all content remain hand-authored with explicit file-path references?
- Is there a preferred deployment target for the future docs app, or should the initial effort focus only on local/buildable monorepo integration?
[/PRD]
