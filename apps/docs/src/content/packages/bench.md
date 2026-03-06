---
title: Bench
description: Shared latency-budget contracts for endpoint classes, currently published as a support package rather than a live runtime dependency.
sources:
  - packages/bench/package.json
  - packages/bench/src/index.ts
  - packages/bench/src/index.types.ts
---

`packages/bench` defines the repo's shared latency-budget vocabulary. It is not currently imported by the live app runtimes, but it gives the workspace one place to describe acceptable `p95` and `p99` budgets for the same endpoint classes already used elsewhere in docs and query metadata.

## Purpose and package boundary

- `packages/bench/src/index.types.ts` defines the shared `EndpointBudgetClass` and `LatencyBudget` types.
- `packages/bench/src/index.ts` exports the default budget table and a helper for checking whether an observed latency profile stays inside a budget.
- The package does not run benchmarks, collect metrics, or enforce SLOs by itself. It is a contract package for those concerns.

## Key exported responsibilities

### Endpoint budget classes

The package standardizes five runtime-budget categories:

- `interactive-query`
- `feature-collection`
- `boundary-aggregation`
- `proximity-enrichment`
- `tile-serving`

Those classes line up with the kinds of responses the repo already documents in query specs and app behavior.

### Default latency budgets

`DEFAULT_ENDPOINT_BUDGETS` assigns concrete `p95Ms` and `p99Ms` targets to each class. For example:

- `interactive-query`: `250ms / 600ms`
- `feature-collection`: `500ms / 900ms`
- `tile-serving`: `150ms / 400ms`

This keeps performance conversations grounded in versioned code instead of ad hoc comments.

### Budget evaluation helper

`isLatencyWithinBudget()` is the package's only behavioral helper. It compares observed `p95` and `p99` values against a chosen `LatencyBudget` and returns a boolean result.

## Current consumers

No direct imports from `apps/*` or `scripts/*` were found in the current repo state.

That absence is still useful to document because it means:

- the package is real and buildable today
- the latency vocabulary already exists for future benchmark or CI work
- current runtime enforcement is happening socially or in docs, not through a wired performance harness

## Support-package role in this repo

`bench` is best understood as a shared performance contract package:

- `geo-sql` already labels query specs with endpoint classes that could feed these budgets later
- operations docs and release checks can reference the budget vocabulary without hard-coding target numbers in prose
- future benchmark tooling can depend on this package instead of redefining budget classes

## Tests and build behavior

`packages/bench/package.json` defines the standard shared-package build scripts, but like `ops` it does not yet have runtime tests:

- `build`: `tsc -p tsconfig.json && tsc-alias -p tsconfig.json`
- `typecheck`: `tsc --noEmit -p tsconfig.json`
- `lint`: `biome check .`
- `test`: `echo 'bench tests not implemented yet'`

There is no benchmark harness or package-local assertion suite in the repo yet, so the current quality bar is compile-time correctness.

## Related docs

- Use [Geo SQL](/docs/packages/geo-sql) for the query-spec endpoint classes that could map to these budgets most directly.
- Use [Release Checklist](/docs/contributing/release-checklist) for the current docs-side verification process while budget enforcement remains manual.
- Use [Parcel And Tile Workflows](/docs/operations/parcel-and-tile-workflows) when evaluating tile-serving performance against the tile-specific budget class.
