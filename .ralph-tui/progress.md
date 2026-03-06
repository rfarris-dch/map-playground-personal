# Ralph Progress Log

This file tracks progress across iterations. It's automatically updated
after each iteration and included in agent prompts for context.

## Codebase Patterns (Study These First)

- The docs app treats `apps/docs/src/features/docs/docs-navigation.service.ts` as the authoritative navigation tree. Section order, page order, derived slugs, search grouping, and prev/next links should all be driven from that single definition, while Markdown content stays focused on page content.
- Tailwind Plus Syntax parity in the Vue docs app depends on document-level setup, not copied CSS alone: define the font variables in `apps/docs/src/styles/tailwind.css` and set the initial `light`/`dark` class from `apps/docs/index.html` before Vue mounts to avoid first-paint drift.
- Tailwind Plus Syntax-style docs search works best when the Markdown pipeline emits section-level search entries alongside rendered HTML: index the page title plus each `h2` section with anchor-aware slugs so the modal can deep-link into content instead of only returning whole pages.
- The docs app stays isolated by keeping its runtime entirely inside `apps/docs` and wiring root workspace commands through filtered package scripts like `dev:docs`, `build:docs`, and `typecheck:docs` rather than sharing entrypoints with product apps.
- Onboarding docs are strongest when `Start Here` gives a fixed contributor path, `Workspace And Commands` maps root scripts to the actual workflows they start, and `Repository Architecture` points directly to preserved `docs/architecture` artifacts for older design context.
- Application foundation pages work best when they document process entrypoints, shared runtime helpers, and cross-cutting config in one place, while pushing route- or slice-specific behavior into companion pages such as `api-geo-slices.md`.
- API geo docs stay readable when they group slices by runtime shape instead of forcing every domain into one inventory page: compact PostGIS route -> repo -> mapper slices, transport-heavy multi-endpoint slices, upstream proxy slices, and paginated reporting slices each need different documentation emphasis.
- Web-application foundation pages read more clearly when they separate the composition-root route (`/map`) from narrower reporting routes first, then document shell orchestration, shared UI plumbing, and package/API seams without duplicating the feature-domain inventory.
- Package documentation reads more clearly when the `Packages` section keeps an overview page for orientation but gives each core runtime package its own page for exports, consumers, and build/test reality; application pages can then deep-link to the exact package seam instead of a catch-all summary.
- Legacy docs-corpus migration works best when the docs app treats `docs/architecture`, `docs/research`, `docs/review`, and `docs/runbooks` as first-class content sources with explicit metadata and nav ordering, instead of copying those files into shadow duplicates under `apps/docs`.
- Operational workflow pages are clearest when they start with the root script aliases from `package.json`, then map those aliases to the wrapper scripts, phase markers, and on-disk artifacts that the API and pipeline monitor consume; that keeps the docs aligned with the commands operators actually run.
- Pipeline monitor docs are strongest when they treat the app as a single-screen operator client over `/api/geo/parcels/sync/status`: document the thin shell, polling controller, derivation services, and script/runbook links together so each UI warning can be traced back to the sync artifacts and API snapshot that produced it.
- Large `apps/web/src/features` coverage is easier to keep trustworthy when the docs split the inventory into shell/control domains, map-data domains, and reporting/analysis domains; that mirrors the real runtime boundaries between composables, layer controllers, and route-level table surfaces.
- Final release-verification pages stay honest when they derive representative route and search checks from `docsCollection` and `searchDocsPages` instead of hand-maintained status prose; that way navigation or search drift shows up directly in the docs UI.
- Reference-oriented docs are more usable when page-level `sources` frontmatter is rendered by the shared page shell: readers can see the authored-doc source separately from the authoritative runtime files or imported artifacts, and companion docs links can be derived from those same paths.
- Support-package docs are stronger when they explicitly state that a package currently has no direct `apps/*` or `scripts/*` consumers; for packages like `bench` and `fixtures`, that absence is concrete repo information and keeps the page honest about present-day runtime impact.
- Docs-authoring guidance stays trustworthy when every documented Markdown affordance is backed by `markdown.service.ts`; if contributors are told to use a syntax like `:::note`, the renderer and shared prose styles need to implement it centrally instead of leaving the convention as aspirational prose.
- Operational runbook pages work best when the imported artifact stays preserved as source material, while the authored `operations` page becomes the current decision tree with live route names, command entrypoints, marker files, and explicit exit criteria; that lets the docs correct stale operational paths without mutating the legacy artifact.

## 2026-03-06 - docs-1.26
- Expanded `Runbooks And Troubleshooting` from a thin routing note into a full operator-facing runbook page that mirrors the preserved spatial-analysis artifact while updating the current parcel sync status route, incident surfaces, and decision flow for stalled extraction, failed canonical load, failed tile build, coherency mismatch, and drift-related incidents.
- Added source references, search terms, incident routing tables, required-input checklists, command snippets, stop conditions, and cross-links to the parcel workflow, parcel/API sync slice, pipeline monitor, sync architecture, and the preserved runbook artifact so operators can move from quick triage to source-of-truth detail without leaving the docs app.
- Files changed:
  - `apps/docs/src/content/operations/runbooks-and-troubleshooting.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - The preserved `docs/runbooks/spatial-analysis-ops.md` artifact is useful as historical source material, but the authored operations page needs to document current repo reality such as `/api/geo/parcels/sync/status`; keeping both surfaces lets the docs app stay honest without rewriting imported artifacts.
  - Drift-related guidance in this repo is intentionally weaker than parcel manifest rollback because there is no single repair script; the docs should say that directly instead of implying a one-command recovery path that does not exist.
  - Browser verification remains blocked in this sandbox because `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`.
---

## 2026-03-06 - docs-1.24
- Split the shared data-and-operations docs into a real package overview plus five concrete package pages for `geo-sql`, `geo-tiles`, `ops`, `bench`, and `fixtures`, each covering package purpose, exported responsibilities, current consumers, build/test behavior, and links back to the app and operations docs that rely on them.
- Expanded the package navigation so the docs app now treats these support/data packages as first-class pages instead of a single summary block, and added source-reference frontmatter so the shared page shell can show the authoritative runtime files behind each page.
- Files changed:
  - `apps/docs/src/content/packages/data-and-operations.md`
  - `apps/docs/src/content/packages/geo-sql.md`
  - `apps/docs/src/content/packages/geo-tiles.md`
  - `apps/docs/src/content/packages/ops.md`
  - `apps/docs/src/content/packages/bench.md`
  - `apps/docs/src/content/packages/fixtures.md`
  - `apps/docs/src/features/docs/docs-navigation.service.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - `geo-sql` is best documented as a query-contract package, not a database-access package: it owns SQL specs and row-budget metadata, while `apps/api` still owns execution and row mapping.
  - `geo-tiles` sits on both sides of the parcel tile path in this repo, with the scripts using it to publish and roll back manifests and the web app using it to validate and consume the live manifest.
  - `bench` and `fixtures` are concrete support packages even without current runtime imports, so their docs should call out the missing consumers directly instead of implying active enforcement or generated fixture flows that do not exist in code today.
  - Browser verification remains blocked in this sandbox because `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`.
---
## 2026-03-06 - docs-1.28
- Replaced the thin `Docs Authoring` page with a maintainer-facing workflow that now documents where authored and imported content lives, how to add or edit pages, the required frontmatter contract, kebab-case naming, heading and TOC rules, code-fence and callout conventions, cross-link and source-reference expectations, Tailwind Plus Syntax parity rules, and the required `agent-browser` verification flow.
- Added real support for the existing `:::note` and `:::warning` Markdown syntax in the shared docs renderer and styled those callouts in the shared docs CSS so the authoring guidance matches the behavior contributors now see in the app.
- Files changed:
  - `apps/docs/src/content/contributing/docs-authoring.md`
  - `apps/docs/src/features/docs/markdown.service.ts`
  - `apps/docs/src/styles/tailwind.css`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - The docs authoring page is most useful when it documents the real contract between `docs-navigation.service.ts`, frontmatter, the Markdown renderer, and the source-reference panel instead of only describing Markdown content in isolation.
  - Shared docs syntax such as callouts belongs in `markdown.service.ts` and the shared prose CSS, not as one-off page conventions; otherwise maintainers inherit guidance they cannot safely follow.
  - Browser verification remains blocked in this sandbox because `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`.
---

## 2026-03-06 - docs-1.25
- Replaced the stub `Parcel And Tile Workflows` page with concrete repo-level script documentation covering schema setup, hyperscale sync inventory, the full parcel production path, rerun commands, build and publish artifacts, manifest rollback behavior, and the explicit split between operational and development-only commands.
- Added command-level guidance around `sync:parcels` as the authoritative happy path, documented the phase markers and status files written under `var/parcels-sync`, and cross-linked the workflow page to the API runtime, pipeline monitor, sync architecture, and runbook surfaces that consume those artifacts.
- Files changed:
  - `apps/docs/src/content/operations/parcel-and-tile-workflows.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - The parcel production path is best documented from `scripts/refresh-parcels.sh` outward because that wrapper owns the real phase order, resume logic, status heartbeat, and completion markers; the individual subcommands make sense mainly as targeted recovery surfaces.
  - The clean rollback story in this repo is manifest-level only: `scripts/rollback-parcels-manifest.ts` safely flips `latest.json`, while database-side recovery depends on the archived `parcel_history.parcels_prev_<timestamp>` table rather than a matching one-command DB rollback script.
  - Browser verification remains blocked in this sandbox because `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`.
---
## 2026-03-06 - docs-1.23
- Split the package-runtime docs into a real overview page plus four concrete package pages for `contracts`, `map-engine`, `map-layer-catalog`, and `map-style`, each covering exported responsibilities, current consumers, build/test behavior, and links back to the app/runtime docs that depend on them.
- Expanded the `Core Runtime Packages` page into a navigation hub so the package section now reads as overview first, package detail second, instead of collapsing all four packages into one thin summary.
- Files changed:
  - `apps/docs/src/content/packages/core-runtime.md`
  - `apps/docs/src/content/packages/contracts.md`
  - `apps/docs/src/content/packages/map-engine.md`
  - `apps/docs/src/content/packages/map-layer-catalog.md`
  - `apps/docs/src/content/packages/map-style.md`
  - `apps/docs/src/features/docs/docs-navigation.service.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - `packages/contracts` is the strongest package-doc candidate for source/reference split: the package page should explain the runtime contract boundary, while the reference page should stay focused on transport-source-of-truth and OpenAPI alignment.
  - The clean line between `map-layer-catalog` and `map-style` is policy versus style identity: catalog owns layer IDs/default visibility/dependencies, while style owns layer-ID expansion and stacking rules.
  - `map-engine` and `map-style` currently rely on typecheck/build plus web integration rather than package-local tests, so package docs should call out that gap explicitly instead of implying equivalent coverage across all four packages.
- Browser verification remains blocked in this sandbox because `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser` fails with `Daemon failed to start`.
---

## 2026-03-05 - docs-1.16
- Migrated the legacy docs corpus into the docs app as first-class artifact pages by extending the docs content pipeline to load the existing files from `docs/architecture`, `docs/research`, `docs/review`, and `docs/runbooks`, add artifact metadata, and place them in navigation and search without copying the source documents into `apps/docs`.
- Expanded the `Artifacts` section so it now links to the individual architecture, research, review, and runbook documents, while keeping the overview page as the orientation layer for those preserved source artifacts.
- Files changed:
  - `apps/docs/src/features/docs/docs-content.service.ts`
  - `apps/docs/src/features/docs/docs-navigation.service.ts`
  - `apps/docs/src/content/artifacts/architecture-artifacts.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - The cleanest migration path for legacy docs in this repo is content-source registration plus metadata overlays, not duplicating the files into `apps/docs/src/content`; that keeps the original docs authoritative while still making them searchable and navigable in the app.
  - YAML reference artifacts can participate in the same docs pipeline if they are wrapped into a fenced code block during rendering, which avoids special viewer components while preserving search coverage and source visibility.
  - Browser verification remains blocked in this sandbox because `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`.
---

## 2026-03-06 - docs-1.3
- Reworked the Vue docs search flow so it now indexes section-level results with anchor slugs derived from authored Markdown instead of only matching whole pages, bringing search behavior closer to the Tailwind Plus Syntax reference.
- Tightened the Markdown pipeline parity by failing fast when an `h3` appears before any `h2`, matching the reference TOC expectations, and updated the search modal hierarchy so deep section hits show their parent page title.
- Files changed:
  - `apps/docs/src/features/docs/components/search-dialog.vue`
  - `apps/docs/src/features/docs/docs-content.service.ts`
  - `apps/docs/src/features/docs/docs-content.types.ts`
  - `apps/docs/src/features/docs/markdown.service.ts`
- **Learnings:**
  - Search parity depends on indexing page sections and anchors during Markdown rendering; whole-page search alone loses the deep-link behavior the Syntax reference exposes.
  - The reference TOC model is intentionally strict about heading order, so the Vue port should fail fast on malformed heading structure instead of silently skipping orphaned `h3` entries.
  - Browser verification is still blocked in this sandbox because `vite preview` cannot bind to `127.0.0.1` (`listen EPERM`) and `agent-browser` fails to start its daemon.
---

## 2026-03-06 - docs-1.2
- Completed the Tailwind Plus Syntax styling port wiring by adding the missing font-variable setup, vendored Lexend font-face, root document classes, and prepaint theme initialization needed for the copied Syntax CSS to render correctly in the Vue app.
- Tightened the Vue shell styling to better match the Syntax reference by updating the theme selector iconography, search trigger and modal treatment, docs header spacing, and hero button styles, while documenting the intentional repo-branding difference from the sample Tailwind Plus wordmark.
- Files changed:
  - `apps/docs/index.html`
  - `apps/docs/src/styles/tailwind.css`
  - `apps/docs/src/features/docs/composables/use-theme.ts`
  - `apps/docs/src/features/docs/components/theme-selector.vue`
  - `apps/docs/src/features/docs/components/search-dialog.vue`
  - `apps/docs/src/features/docs/components/docs-header.vue`
  - `apps/docs/src/features/docs/components/hero-section.vue`
  - `apps/docs/src/content/contributing/docs-authoring.md`
- **Learnings:**
  - Copying the Tailwind Plus `tailwind.css` and `prism.css` files is not sufficient on its own; the Vue port also needs the root font variables and initial theme class that the Next.js reference normally injects through `layout.tsx`.
  - The largest remaining parity risks live in document wiring and shell controls like theme/search, not in the shared CSS assets themselves.
  - Browser verification remains blocked in this sandbox because preview servers cannot bind to localhost (`listen EPERM`), so `agent-browser` screenshots could not be captured here.
---

## 2026-03-06 - docs-1.4
- Implemented the repository information architecture by adding a dedicated `Information Architecture` page under the `Repository` section and a new top-level `Data And Sync` section with a concrete sync-surface page.
- Updated the docs navigation definition so the route tree now explicitly covers onboarding, repository architecture, applications, shared packages, data and sync flows, operations, references, contribution guidance, and migrated artifacts.
- Added minimal Biome workspace wiring to exclude the vendored `docs/tailwind-plus-syntax` reference subtree so `bun x ultracite fix apps/docs docs` and `bun x ultracite check apps/docs docs` can pass against authored docs surfaces.
- Files changed:
  - `apps/docs/src/features/docs/docs-navigation.service.ts`
  - `apps/docs/src/content/repository/architecture.md`
  - `apps/docs/src/content/repository/information-architecture.md`
  - `apps/docs/src/content/data-and-sync/sync-architecture.md`
  - `biome.json`
- **Learnings:**
  - The docs IA is already encoded structurally through folder-based content discovery plus navigation metadata, so adding or reshaping top-level sections should happen in `docs-navigation.service.ts` first and then be documented in content.
  - The vendored Tailwind Plus Syntax reference under `docs/tailwind-plus-syntax` is not Biome-clean under this repo’s Ultracite rules, so checks that target `docs/` need that subtree excluded unless the intent is to lint and refactor the upstream template itself.
  - Browser automation was attempted, but `agent-browser` could not start its daemon in this sandbox and local preview servers are blocked from binding to a port here.
---
## 2026-03-06 - docs-1.1
- Verified the docs workspace bootstrap was already implemented: `apps/docs` is a standalone Vue 3 + Vite + Tailwind CSS 4 + TypeScript application with its own `package.json`, Vite config, tsconfig files, router, and Composition API app shell.
- Confirmed the root workspace wiring is minimal and docs-specific through the filtered scripts in the root `package.json` (`dev:docs`, `build:docs`, `typecheck:docs`) and the existing Bun workspace plus Turbo setup.
- Verified the docs app does not import runtime code from `apps/web`, `apps/api`, or `apps/pipeline-monitor`; the remaining quality-gate gap is browser verification, which is blocked in this sandbox because preview servers cannot bind and `agent-browser` cannot start its daemon.
- Files changed:
  - `.ralph-tui/progress.md`
- **Learnings:**
  - In this repo, the bootstrap story is satisfied by package-level isolation plus root filtered commands; no extra cross-workspace wiring is needed once `apps/docs` has its own Vite, tsconfig, and scripts.
  - Verifying docs-app independence is easiest with a targeted import scan across `apps/docs` plus a check of the root Turbo and package scripts.
  - Browser verification remains blocked in this sandbox because `vite preview` cannot bind to localhost (`listen EPERM`) and `agent-browser` fails to start.
---
## ✓ Iteration 1 - docs-1.4: US-004: Define the repository documentation information architecture
*2026-03-06T02:36:08.405Z (441s)*

**Status:** Completed

**Notes:**
ady exists in code. I added a minimal authored-docs linting exclusion in [biome.json](/Users/robertfarris/map/biome.json) for the vendored Tailwind Plus reference subtree so the required Ultracite command can pass without refactoring upstream sample files.\n\nBrowser verification is the one blocked item: local preview servers cannot bind in this sandbox, and `agent-browser` could not start its daemon here, so I could not complete the required desktop/mobile screenshots from this environment.\n\n

---
## ✓ Iteration 2 - docs-1.2: US-002: Port Tailwind Plus Syntax styling exactly into Vue
*2026-03-06T02:47:04.614Z (654s)*

**Status:** Completed

**Notes:**
tes passed: `bun --cwd apps/docs lint`, `bun --cwd apps/docs typecheck`, `bun --cwd apps/docs build`, `bun x ultracite fix apps/docs docs`, and `bun x ultracite check apps/docs docs`. Browser verification is still blocked in this sandbox: `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, so `agent-browser` parity checks and screenshots could not be completed here. `docs-1.2` is closed; I had to use `--force` because the tracker still shows `docs-1.1` open.\n\n

---
## ✓ Iteration 3 - docs-1.3: US-003: Recreate the Tailwind Plus Syntax shell, navigation, and search in Vue
*2026-03-06T02:54:01.551Z (415s)*

**Status:** Completed

**Notes:**
ralph-tui/progress.md) and closed bead `docs-1.3`.\n\nValidation passed: `bun --cwd apps/docs lint`, `bun --cwd apps/docs typecheck`, `bun --cwd apps/docs build`, `bun x ultracite fix apps/docs docs`, and `bun x ultracite check apps/docs docs`. Browser verification is still blocked in this sandbox: `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser` fails with `Daemon failed to start`, so I could not capture the required screenshots here.\n\n

---
## ✓ Iteration 4 - docs-1.1: US-001: Bootstrap the docs application workspace
*2026-03-06T02:55:53.290Z (110s)*

**Status:** Completed

**Notes:**
build`, `bun x ultracite fix apps/docs docs`, and `bun x ultracite check apps/docs docs`. I appended the required progress entry in [.ralph-tui/progress.md](/Users/robertfarris/map/.ralph-tui/progress.md) and closed the bead with `bd close docs-1.1`.\n\nBrowser verification is still the only blocked gate in this environment: local preview binding fails with `listen EPERM`, and `agent-browser` cannot start here, so I could not capture the required desktop/mobile screenshots from this sandbox.\n\n

---
## 2026-03-06 - docs-1.20
- Expanded `API Runtime Foundations` into a full application-level foundation page covering the two process entrypoints, Hono app composition, shared HTTP hardening, runtime config, Bun SQL wiring, and the shared transport/policy helper surface.
- Folded the foundation-relevant notes from `apps/api/README.md` into the page while keeping per-slice endpoint detail delegated to the existing `API Geo Slices` page.
- Files changed:
  - `apps/docs/src/content/applications/api-runtime.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - The cleanest split for `apps/api` docs is `api-runtime.md` for process entrypoints and transport foundations, then `api-geo-slices.md` for route/repo/mapper and per-domain behavior.
  - `apps/api/src/http/runtime-config.ts` is not just env parsing; it is the shared metadata/config boundary that lets slice routes stamp source-mode and data-version information without duplicating env access.
  - Browser verification remains blocked in this sandbox because `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser` fails with `Daemon failed to start`.
---
## 2026-03-06 - docs-1.18
- Expanded `Web Runtime Foundations` into a full application-level page that now documents the boot flow, route surfaces, page split between the `/map` composition root and the reporting/table routes, the shell composables that coordinate map behavior, and the shared package/API seams the frontend depends on.
- Folded the `apps/web/README.md` note into the page and cross-linked the runtime foundation page back to the feature-domain, package, and contract reference docs so the docs app has a cleaner reading path from shell-level context into deeper module detail.
- Files changed:
  - `apps/docs/src/content/applications/web-runtime.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - `apps/web` is easiest to document as two runtime shapes: a map composition root under `map-page.vue` and narrower query-driven reporting routes for markets, providers, and facilities.
  - The app-shell seam is not just `use-app-shell.ts`; the real coordination layer is the set of shell composables around it (`state`, `selection`, `visibility`, `overlays`, `measure`, and `map-lifecycle`), so docs should name that composition explicitly.
  - The clean frontend API boundary is `apps/web/src/lib/api-client.ts` plus feature API modules that consume route builders and schemas from `@map-migration/contracts`, with parcel tile lineage handled separately through `@map-migration/geo-tiles`.
  - Browser verification remains blocked in this sandbox because `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser` fails with `Daemon failed to start`.
---
## ✓ Iteration 5 - docs-1.20: US-010: Document the API runtime foundations
*2026-03-06T03:00:06.901Z (252s)*

**Status:** Completed

**Notes:**
s.md), then closed bead `docs-1.20`.\n\nQuality gates passed: `bun --cwd apps/docs lint`, `bun --cwd apps/docs typecheck`, `bun --cwd apps/docs build`, `bun x ultracite fix apps/docs docs`, and `bun x ultracite check apps/docs docs`. Required browser verification is still blocked in this sandbox: `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser` fails with `Daemon failed to start`, so I could not capture desktop/mobile screenshots here.\n\n

---
## ✓ Iteration 6 - docs-1.18: US-008: Document the web app entrypoints and runtime foundations
*2026-03-06T03:05:34.331Z (325s)*

**Status:** Completed

**Notes:**
ress.md), then closed bead `docs-1.18`.\n\nChecks passed: `bun --cwd apps/docs lint`, `bun --cwd apps/docs typecheck`, `bun --cwd apps/docs build`, `bun x ultracite fix apps/docs docs`, and `bun x ultracite check apps/docs docs`. Browser verification is still blocked in this sandbox: `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser` fails with `Daemon failed to start`, so I could not capture the required desktop/mobile screenshots here.\n\n

---
## ✓ Iteration 7 - docs-1.23: US-013: Document the shared package runtime surfaces
*2026-03-06T03:12:09.669Z (393s)*

**Status:** Completed

**Notes:**
ld`, `bun x ultracite fix apps/docs docs`, and `bun x ultracite check apps/docs docs`. I also appended the required entry to [.ralph-tui/progress.md](/Users/robertfarris/map/.ralph-tui/progress.md) and closed bead `docs-1.23`.\n\nBrowser verification is still blocked in this sandbox. `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser` fails with `Daemon failed to start`, so I could not capture the required desktop/mobile screenshots here.\n\n

---
## ✓ Iteration 8 - docs-1.16: US-006: Migrate the existing docs corpus into the new app
*2026-03-06T03:18:00.166Z (348s)*

**Status:** Completed

**Notes:**
s-1.16`.\n\nValidation passed: `bun --cwd apps/docs lint`, `bun --cwd apps/docs typecheck`, `bun --cwd apps/docs build`, `bun x ultracite fix apps/docs docs`, and `bun x ultracite check apps/docs docs`. Browser verification is still blocked in this sandbox: `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`, so I could not capture the required desktop/mobile screenshots here.\n\n

---
## 2026-03-06 - docs-1.29
- Expanded the release checklist page into a real ship gate with explicit Tailwind Plus Syntax comparison targets, route-level browser checks, search expectations, screenshot requirements, and docs-only scope validation guidance.
- Added a docs-only live coverage audit on the release-checklist route that derives representative onboarding, application, package, operations, reference, and artifact checks from the actual docs navigation and search index instead of relying on static prose alone.
- Files changed:
  - `apps/docs/src/content/contributing/release-checklist.md`
  - `apps/docs/src/features/docs/components/release-verification-panel.vue`
  - `apps/docs/src/features/docs/pages/docs-page-view.vue`
  - `apps/docs/src/features/docs/release-verification.service.ts`

## 2026-03-06 - docs-1.21
- Replaced the thin `API Geo Slices` stub with a real hub page and three focused companion docs that now cover the six `apps/api/src/geo` slices by runtime shape: compact PostGIS reads for boundaries, transport-heavy facilities routes, the fiber-locator upstream proxy, table/reporting slices for markets and providers, and the parcel slice with its sync-worker intersections.
- Documented the route, repo, mapper, service, and policy seams where they actually exist today, including facilities route-helper services, fiber-locator config or fetch or tile-cache logic, the markets/providers query-service pipeline, parcel AOI policy and ingestion-run coherency checks, and the parcel or hyperscale sync services that influence geo serving.
- Expanded the `Applications` navigation so the API section now exposes the new detailed slice pages as first-class routes participating in navigation, search, and prev or next flow.
- Files changed:
  - `apps/docs/src/content/applications/api-geo-slices.md`
  - `apps/docs/src/content/applications/api-boundaries-and-facilities.md`
  - `apps/docs/src/content/applications/api-fiber-markets-and-providers.md`
  - `apps/docs/src/content/applications/api-parcels-and-sync.md`
  - `apps/docs/src/features/docs/docs-navigation.service.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - `apps/api/src/geo` is easier to document by runtime shape than by alphabetical slice order because the repo -> mapper seams, route-helper seams, and service-first proxy seams are genuinely different patterns in code.
  - The parcel slice is the only geo domain that directly exposes worker state to HTTP consumers, so sync-runtime coverage belongs with parcel docs first and with the broader sync architecture second.
  - Browser verification remains blocked in this sandbox because `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser` fails with `Daemon failed to start`.
---
  - `apps/docs/src/features/docs/release-verification.types.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - The final verification story is stronger when the checklist page includes a live audit sourced from `docsCollection` and `searchDocsPages`; it turns navigation and search coverage into something maintainers can see drift immediately instead of a note they must trust.
  - The most deterministic search checks are exact page-title phrases, not fuzzier topical queries, because the docs search scorer intentionally favors title equality and prefix matches.
  - Browser verification remains blocked in this sandbox because `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`.
---
## ✓ Iteration 9 - docs-1.25: US-015: Document the parcel and tile scripts
*2026-03-06T03:26:40.992Z (519s)*

**Status:** Completed

**Notes:**
apps/docs lint`, `bun --cwd apps/docs typecheck`, `bun --cwd apps/docs build`, and `bun x ultracite check apps/docs docs .ralph-tui/progress.md`. I also ran `bun x ultracite fix apps/docs docs .ralph-tui/progress.md`. Browser verification is still blocked in this sandbox: `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`, so I could not capture the required screenshots here.\n\n

---
## ✓ Iteration 10 - docs-1.29: US-019: Add final parity and release verification for the docs app
*2026-03-06T03:34:36.883Z (474s)*

**Status:** Completed

**Notes:**
ultracite fix apps/docs docs .ralph-tui/progress.md`, and `bun x ultracite check apps/docs docs .ralph-tui/progress.md`. Browser verification is still blocked in this sandbox: `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`, so I could not capture the required screenshots. `docs-1.29` is closed with `--force` because the bead tracker still has dependent beads marked open.\n\n

---
## 2026-03-06 - docs-1.27
- Added a shared `Source References` panel to the docs page shell so every non-home route can show its authored-doc source, any authoritative runtime or artifact paths from frontmatter `sources`, and companion docs links derived from those paths.
- Expanded the `Source Reference Patterns` and `Contracts And API Surfaces` pages with concrete source-of-truth matrices, module-level contract coverage, and explicit OpenAPI alignment guidance tied to the real `packages/contracts` and `apps/api` seams.
- Files changed:
  - `apps/docs/src/content/references/contracts-and-api-surfaces.md`
  - `apps/docs/src/content/references/source-reference-patterns.md`
  - `apps/docs/src/features/docs/components/source-reference-panel.vue`
  - `apps/docs/src/features/docs/docs-source-references.service.ts`
  - `apps/docs/src/features/docs/docs-source-references.types.ts`
  - `apps/docs/src/features/docs/pages/docs-page-view.vue`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Page-level `sources` metadata becomes much more valuable once the shared page shell renders it consistently; that keeps reference pages and runtime pages aligned without inventing a second manual link inventory.
  - The clean distinction for this docs app is between the page source file and the authoritative runtime sources it references; imported legacy artifact pages are the special case where the rendered page source is itself authoritative.
  - Browser verification remains blocked in this sandbox because `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`.
---
## ✓ Iteration 11 - docs-1.27: US-017: Add API, contract, and source-reference documentation patterns
*2026-03-06T03:41:37.067Z (418s)*

**Status:** Completed

**Notes:**
`bun --cwd apps/docs lint`, `bun --cwd apps/docs typecheck`, `bun --cwd apps/docs build`, `bun x ultracite fix apps/docs docs .ralph-tui/progress.md`, and `bun x ultracite check apps/docs docs .ralph-tui/progress.md`. Browser verification is still blocked in this sandbox: `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`, so I could not capture the required screenshots here.\n\n

---
## 2026-03-06 - docs-1.17
- Expanded the onboarding docs so the getting-started surface now maps the real root workspace scripts from `package.json`, documents the major repo constraints from `AGENTS.md`, and gives new contributors a concrete path from workspace orientation into the correct runtime, package, and artifact pages.
- Added explicit source references to the onboarding and repository architecture pages, and extended the architecture page with a guide to the preserved `docs/architecture` artifacts so older design material remains part of the recommended reading flow instead of an isolated appendix.
- Files changed:
  - `apps/docs/src/content/getting-started/start-here.md`
  - `apps/docs/src/content/getting-started/workspace-and-commands.md`
  - `apps/docs/src/content/repository/architecture.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - The acceptance bar for onboarding is not just a workspace table; the page needs the actual root command inventory plus intent-level guidance so new contributors know which entrypoint to run for each surface.
  - `AGENTS.md` conventions are more useful in docs when grouped into editing constraints, naming/type-safety rules, and production-path rules instead of being copied as a flat list.
  - The architecture docs are easier to trust when the authored `Repository Architecture` page explicitly tells readers which preserved artifact to open next for bounded-context framing, sequencing, or OpenAPI detail.
---
## ✓ Iteration 12 - docs-1.17: US-007: Document workspace onboarding and repository architecture
*2026-03-06T03:45:28.402Z (229s)*

**Status:** Completed

**Notes:**
s.md) and closed bead `docs-1.17`.\n\nValidation passed with `bun --cwd apps/docs lint`, `bun --cwd apps/docs typecheck`, `bun --cwd apps/docs build`, `bun x ultracite fix apps/docs docs .ralph-tui/progress.md`, and `bun x ultracite check apps/docs docs .ralph-tui/progress.md`. Browser verification is still blocked in this sandbox: `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, so I could not run `agent-browser` or capture the required screenshots here.\n\n

---
## 2026-03-06 - docs-1.22
- Replaced the stub `Pipeline Monitor` application page with a concrete runtime doc that now covers the app boot path, single-screen shell, dashboard composition boundary, polling controller, contract fetch layer, tracking services, and the exact operator panels rendered from the sync-status payload.
- Documented the `/api/geo/parcels/sync/status` contract as the monitor's authoritative input, explained how the app derives stall, rate, ETA, event-feed, and progress-bar signals from successive snapshots, and cross-linked the page to the sync architecture, parcel workflow, runbook, API runtime, and contracts docs.
- Files changed:
  - `apps/docs/src/content/applications/pipeline-monitor.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - The monitor is easiest to explain as a read model over the parcel sync status contract, not as a generic dashboard; the useful split is shell, polling controller, API contract seam, and derivation services.
  - `pipeline.view.ts` is the operational heart of the app even though it is not a Vue route component: it owns polling cadence, abort/retry behavior, bounded live history, and request-failure recovery events.
  - Browser verification remains blocked in this sandbox because `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`.
---
## ✓ Iteration 13 - docs-1.22: US-012: Document the pipeline monitor and pipeline tracking flow
*2026-03-06T03:52:43.363Z (433s)*

**Status:** Completed

**Notes:**
/docs lint`, `bun --cwd apps/docs typecheck`, `bun --cwd apps/docs build`, `bun x ultracite fix apps/docs docs .ralph-tui/progress.md`, and `bun x ultracite check apps/docs docs .ralph-tui/progress.md`. Browser verification is still blocked in this sandbox: `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`, so I could not capture the required desktop/mobile screenshots here.\n\n

---
## ✓ Iteration 14 - docs-1.24: US-014: Document the shared data and operations packages
*2026-03-06T03:59:31.811Z (406s)*

**Status:** Completed

**Notes:**
lph-tui/progress.md`. I closed the bead with `bd close docs-1.24 --db /Users/robertfarris/map/.beads/beads.db --reason \"Documented the shared data and operations package surfaces in the docs app\"`.\n\nBrowser verification is still blocked in this sandbox. `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`, so I could not capture the required desktop/mobile screenshots here.\n\n

---
## ✓ Iteration 15 - docs-1.28: US-018: Document the docs-authoring workflow and contribution standards
*2026-03-06T04:10:18.685Z (645s)*

**Status:** Completed

**Notes:**
`bun --cwd apps/docs lint`, `bun --cwd apps/docs typecheck`, `bun --cwd apps/docs build`, `bun x ultracite fix apps/docs docs .ralph-tui/progress.md`, and `bun x ultracite check apps/docs docs .ralph-tui/progress.md`. Browser verification is still blocked in this sandbox: `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`, so I could not capture the required screenshots here.\n\n

---
## 2026-03-06 - docs-1.19
- Replaced the thin single-page `Web Feature Domains` inventory with a real hub page plus three focused application docs for shell/control domains, map-data domains, and reporting/analysis domains, so the major `apps/web/src/features/*` areas now have concrete ownership docs instead of a flat checklist.
- Documented the feature boundaries for basemap, boundaries, facilities, fiber locator, layers, markets, measure, navigation, parcels, power, providers, quick view, scanner, spatial analysis, and table utilities, including where services, layer controllers, composables, and route-level integrations should live.
- Expanded the `Applications` navigation so the new feature-domain pages are first-class routes that participate in navigation, search, and prev/next flow alongside the existing web runtime foundations page.
- Files changed:
  - `apps/docs/src/content/applications/web-feature-domains.md`
  - `apps/docs/src/content/applications/web-map-shell-domains.md`
  - `apps/docs/src/content/applications/web-map-data-domains.md`
  - `apps/docs/src/content/applications/web-reporting-and-analysis-domains.md`
  - `apps/docs/src/features/docs/docs-navigation.service.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - The cleanest split for `apps/web/src/features` docs is route-facing shell orchestration first, then map-data runtimes, then reporting/analysis helpers; trying to cover all of that on one page hides the real ownership boundaries.
  - `features/facilities` is intentionally dual-purpose in this repo: the same domain owns both map-layer behavior and facilities-table transport, so the docs need to call out that split instead of forcing facilities into only one bucket.
  - Browser verification remains blocked in this sandbox because `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`.
---
## ✓ Iteration 16 - docs-1.19: US-009: Document the web feature domains
*2026-03-06T04:16:53.191Z (392s)*

**Status:** Completed

**Notes:**
s/docs typecheck`, `bun --cwd apps/docs build`, `bun x ultracite fix apps/docs docs .ralph-tui/progress.md`, and `bun x ultracite check apps/docs docs .ralph-tui/progress.md`. I closed bead `docs-1.19`. Browser verification is still blocked in this sandbox: `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`, so I could not capture the required desktop/mobile screenshots here.\n\n

---
## ✓ Iteration 17 - docs-1.21: US-011: Document the API geo slices
*2026-03-06T04:22:38.767Z (343s)*

**Status:** Completed

**Notes:**
/docs lint`, `bun --cwd apps/docs typecheck`, `bun --cwd apps/docs build`, `bun x ultracite fix apps/docs docs .ralph-tui/progress.md`, and `bun x ultracite check apps/docs docs .ralph-tui/progress.md`. Browser verification is still blocked in this sandbox: `bun --cwd apps/docs preview --host 127.0.0.1 --port 4173` fails with `listen EPERM`, and `agent-browser open http://127.0.0.1:4173` fails with `Daemon failed to start`, so I could not capture the required desktop/mobile screenshots here.\n\n

---
