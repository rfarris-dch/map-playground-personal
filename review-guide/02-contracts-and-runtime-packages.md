# Contracts And Runtime Packages

## Goal

Review the shared runtime packages that define transport, map abstraction, and shared frontend/backend seams. The key question is whether these packages are reducing duplication and protecting boundaries, or whether they are turning into leaky mini-frameworks.

## Area snapshot

- `packages/contracts`: about 21 files and ~3000 lines
- `packages/core-runtime`: about 5 files and ~800 lines
- `packages/map-engine`: about 4 files and ~1100 lines
- `packages/map-layer-catalog`: about 2 files and ~300 lines
- `packages/map-style`: about 6 files and ~400 lines

## Start here

- `packages/contracts/src`
- `packages/core-runtime/src`
- `packages/map-engine/src`
- `packages/map-layer-catalog/src`
- `packages/map-style/src`
- `packages/contracts/test`
- `apps/docs/src/content/packages/contracts.md`
- `apps/docs/src/content/packages/core-runtime.md`
- `apps/docs/src/content/packages/map-engine.md`
- `apps/docs/src/content/packages/map-layer-catalog.md`
- `apps/docs/src/content/packages/map-style.md`
- `apps/docs/src/content/references/contracts-and-api-surfaces.md`

## Main questions

- Is `packages/contracts` truly the authoritative transport boundary, or are app-local request and response types drifting away from it?
- Does `packages/core-runtime` hold genuinely cross-runtime helpers, or is it a generic bucket for code that did not get an owner?
- Does `packages/map-engine` hide engine details cleanly, or do consumers still need to know MapLibre internals to use it correctly?
- Does `packages/map-layer-catalog` contain policy, or is it becoming a second control plane for the map app?
- Does `packages/map-style` hold stable style identity and ordering rules, or does it duplicate knowledge that belongs in the engine or the app?
- Are package exports narrow and intention-revealing?
- Do any of these packages leak implementation details through type names, literal IDs, or required call order?

## Boundary prompts

- Check whether transport schemas, route builders, and headers live in one place and are consumed consistently.
- Check whether map packages divide responsibilities cleanly:
  - engine abstraction
  - layer policy
  - style identity and ordering
- Check whether any consumer needs to import from multiple packages to complete one conceptual task that should have had a single owner.
- Check whether `core-runtime` is actually part of the stable public platform, or an unstable convenience layer.

## DRY and simplification prompts

- Search for duplicated enums, route constants, request headers, source-mode values, or style-layer IDs across apps and packages.
- Search for repeated validation or parsing logic that should either live in contracts or stay local, but not both.
- Search for wrapper APIs that only rename upstream objects without removing any coupling.
- Search for exported helpers with only one caller and ask whether they should move back to the caller.
- Search for files whose names are generic enough that ownership is unclear.

## DDD and SOLID prompts

- Does each package have one reason to change?
- Does each public API describe the domain intent, or just the implementation steps?
- Are interfaces used where they decouple a real dependency, or where the codebase is only trying to look architectural?
- Are callers operating at a single layer of abstraction, or mixing transport details with map-engine details and style details in the same flow?

## Legacy-context prompts

- The old DatacenterHawk system had multiple frontends sharing a monolithic API. Shared contracts are a real need, not an academic one.
- The map migration also has a real engine seam. Do not collapse `map-engine` if that would spread raw engine wiring across the app again.
- The correct target is smaller, clearer shared surfaces. The wrong target is deleting the seams that the migration actually depends on.

## Deliverables for this pass

- a keep, merge, delete recommendation for each package in scope
- the top shared abstractions that are pulling their weight
- the top shared abstractions that are leaky or ceremonial
- a list of duplicate contract or map-policy concepts across the repo

## What not to do

- Do not propose a single mega `shared` package.
- Do not keep a package alive only because it already has consumers.
- Do not recommend deleting shared contracts unless you can show that drift would not return immediately.
