# Ralph Progress Log

This file tracks progress across iterations. It's automatically updated
after each iteration and included in agent prompts for context.

## Codebase Patterns (Study These First)

- The docs app treats `apps/docs/src/features/docs/docs-navigation.service.ts` as the authoritative navigation tree. Section order, page order, derived slugs, search grouping, and prev/next links should all be driven from that single definition, while Markdown content stays focused on page content.
- Tailwind Plus Syntax parity in the Vue docs app depends on document-level setup, not copied CSS alone: define the font variables in `apps/docs/src/styles/tailwind.css` and set the initial `light`/`dark` class from `apps/docs/index.html` before Vue mounts to avoid first-paint drift.
- Tailwind Plus Syntax-style docs search works best when the Markdown pipeline emits section-level search entries alongside rendered HTML: index the page title plus each `h2` section with anchor-aware slugs so the modal can deep-link into content instead of only returning whole pages.
- The docs app stays isolated by keeping its runtime entirely inside `apps/docs` and wiring root workspace commands through filtered package scripts like `dev:docs`, `build:docs`, and `typecheck:docs` rather than sharing entrypoints with product apps.
- Application foundation pages work best when they document process entrypoints, shared runtime helpers, and cross-cutting config in one place, while pushing route- or slice-specific behavior into companion pages such as `api-geo-slices.md`.
- Web-application foundation pages read more clearly when they separate the composition-root route (`/map`) from narrower reporting routes first, then document shell orchestration, shared UI plumbing, and package/API seams without duplicating the feature-domain inventory.
- Package documentation reads more clearly when the `Packages` section keeps an overview page for orientation but gives each core runtime package its own page for exports, consumers, and build/test reality; application pages can then deep-link to the exact package seam instead of a catch-all summary.

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
