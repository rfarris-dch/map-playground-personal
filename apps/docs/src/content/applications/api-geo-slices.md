---
title: API Geo Slices
description: The geo-serving route groups under apps/api/src/geo and the route, repo, mapper, service, and policy seams they use.
---

The `apps/api/src/geo` tree follows a pragmatic slice model. Not every slice has every layer, but the boundaries are consistent enough to document.

## Boundaries

`geo/boundaries` is a compact slice:

- `boundaries.route.ts` parses the `level` query param, runs the read, maps rows, and returns a `BoundaryPowerFeatureCollection`.
- `boundaries.repo.ts` performs the PostGIS-backed read.
- `boundaries.mapper.ts` maps rows into the contract payload.

This slice is the clearest example of a small route -> repo -> mapper shape.

## Facilities

`geo/facilities` uses a broader route set because facilities expose multiple interaction modes:

- bbox map fetch
- selection fetch
- table fetch
- detail fetch

The route folder contains focused transport helpers for params, errors, policy, meta, and query orchestration. This keeps the slice transport-heavy without collapsing everything into one file.

## Fiber locator

`geo/fiber-locator` is an integration slice rather than a pure SQL slice:

- config loading
- upstream request shaping
- tile proxy behavior
- catalog and layers-in-view endpoints

Its route helpers are specialized around proxy policy and path decoding instead of repo access.

## Markets and providers

`geo/markets` and `geo/providers` both use the paginated table shape:

- route parses pagination and sort args
- query service orchestrates the read
- repo executes SQL
- mapper converts rows

These slices are closer to table/reporting surfaces than map tile surfaces.

## Parcels

`geo/parcels` is the most operationally sensitive slice. It currently exposes:

- sync status
- lookup
- enrich
- detail

The route subfolder also includes AOI query helpers, enrich services, error/meta helpers, and policy services. This is where parcel coherency checks and sync-facing behavior intersect with geo-serving.

## Sync intersections

Parcel serving intersects with the sync worker and operational scripts more directly than the other slices. Use this page together with:

- [API Runtime Foundations](/docs/applications/api-runtime)
- [Parcel And Tile Workflows](/docs/operations/parcel-and-tile-workflows)
- [Runbooks And Troubleshooting](/docs/operations/runbooks-and-troubleshooting)
