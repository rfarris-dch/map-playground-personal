---
title: Data And Operations Packages
description: Shared SQL, tile, ops, benchmark, and fixture packages used across serving and operational workflows.
---

The remaining shared packages are less visible in the UI, but they define critical operational and data-facing behavior.

## Package map

| Package | Purpose | Concrete surfaces |
| --- | --- | --- |
| `packages/geo-sql` | SQL query specs for geospatial reads. | Facilities bbox/polygon/detail queries, county metrics query, parcel query helpers. |
| `packages/geo-tiles` | Tile dataset and publish manifest helpers. | Dataset parsing, manifest validation, version creation, PMTiles path builders. |
| `packages/ops` | Shared operational helpers. | `createRequestId`, `createDiagnosticEvent`, shared diagnostic types. |
| `packages/bench` | Runtime budget definitions. | `DEFAULT_ENDPOINT_BUDGETS`, budget classes, latency checks. |
| `packages/fixtures` | Dataset scale framing. | Fixture tiers `A` through `D` with parcel count ranges and scale notes. |

## `geo-sql`

`packages/geo-sql/src/index.ts` contains named query specs instead of generic repo abstractions. That makes the endpoint class, row cap, and SQL intent visible in one place.

## `geo-tiles`

`packages/geo-tiles/src/index.ts` defines the canonical tile dataset names and validates publish manifests. The parcel PMTiles publish flow depends on these helpers for version and manifest correctness.

## `ops`

`packages/ops/src/index.ts` is small but important because request IDs and diagnostic event shapes need to stay consistent across apps.

## `bench` and `fixtures`

These support packages are not product runtimes by themselves, but they capture two important repo concerns:

- endpoint budget targets
- dataset scale tiers used to reason about parcel performance and stress

## Cross-links

- Use [Parcel And Tile Workflows](/docs/operations/parcel-and-tile-workflows) for the scripts that operate on the tile and parcel packages.
- Use [Contracts And API Surfaces](/docs/references/contracts-and-api-surfaces) when a package change affects transport shapes.
