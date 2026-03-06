---
title: Fixtures
description: Shared dataset-tier definitions used to describe repo scale, stress, and benchmark framing.
sources:
  - packages/fixtures/package.json
  - packages/fixtures/src/index.ts
  - packages/fixtures/src/index.types.ts
---

`packages/fixtures` is the repo's scale-framing package. It does not ship fixture files or sample parcel datasets directly; instead, it defines the tier labels and parcel-count ranges the workspace can use when talking about development, production-like, and stress-sized data.

## Purpose and package boundary

- `packages/fixtures/src/index.types.ts` defines the `DatasetTier` union and the `TierSpec` shape.
- `packages/fixtures/src/index.ts` exports `DATASET_TIERS` and `getTierSpec()`.
- The package does not provision data or run synthetic loads. It publishes the shared vocabulary for those activities.

## Key exported responsibilities

### Dataset tier definitions

The package defines four parcel-scale tiers:

- `A`: `100,000` parcels, described as the development sanity tier
- `B`: `10,000,000` to `30,000,000` parcels, described as production-like parcel scale
- `C`: `80,000,000` to `120,000,000` parcels, described as stress parcel scale
- `D`: `80,000,000` to `120,000,000` parcels, described as stress scale with high interaction concurrency

These values are useful because they make dataset-size discussions explicit instead of relying on vague phrases like "large" or "realistic."

### Tier lookup helper

`getTierSpec()` is a small helper, but it makes the tier map consumable from code if future benchmark or fixture tooling wants a stable lookup API instead of reaching into the raw record.

## Current consumers

No direct imports from `apps/*` or `scripts/*` were found in the current repo state.

Today the package is best treated as a support contract for benchmark planning, scale communication, and future fixture-aware tooling rather than as an active runtime dependency.

## Support-package intent in this repo

- `fixtures` gives the repo one stable way to talk about parcel scale tiers.
- it pairs naturally with [Bench](/docs/packages/bench), which defines the latency expectations that might be applied to those tiers later.
- it also complements the parcel sync and tile docs, where operators need to reason about whether a workflow is being exercised at development, production-like, or stress scale.

Even without current imports, this is concrete repo information because the package codifies the parcel-count ranges the team has chosen to name and preserve.

## Tests and build behavior

`packages/fixtures/package.json` follows the standard shared-package build shape:

- `build`: `tsc -p tsconfig.json && tsc-alias -p tsconfig.json`
- `typecheck`: `tsc --noEmit -p tsconfig.json`
- `lint`: `biome check .`
- `test`: `echo 'fixtures tests not implemented yet'`

Like `bench`, the package currently relies on typecheck and build correctness rather than package-local runtime tests.

## Related docs

- Use [Bench](/docs/packages/bench) for the latency-target companion package.
- Use [Parcel And Tile Workflows](/docs/operations/parcel-and-tile-workflows) when thinking about which operational path is being exercised at a given parcel scale.
- Use [Pipeline Monitor](/docs/applications/pipeline-monitor) when scale affects how an operator interprets row-rate, build-rate, and stall signals.
