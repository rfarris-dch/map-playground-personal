---
title: Geo Tiles
description: Shared tile dataset parsing and manifest helpers used by parcel PMTiles publication and frontend tile lineage.
sources:
  - packages/geo-tiles/package.json
  - packages/geo-tiles/src/index.ts
  - packages/geo-tiles/src/index.types.ts
  - packages/geo-tiles/test/tile-manifest.test.ts
  - apps/web/src/features/parcels/parcels.service.ts
  - apps/web/src/features/parcels/parcels.layer.ts
  - scripts/publish-parcels-manifest.ts
  - scripts/rollback-parcels-manifest.ts
---

`packages/geo-tiles` is the shared tile-manifest contract for this repo. It defines which dataset names are valid, how publish manifests are parsed and validated, and how PMTiles versions and paths are derived so the scripts and frontend runtime talk about the same artifact structure.

## Purpose and package boundary

- `packages/geo-tiles/src/index.types.ts` defines the core tile contracts: `TileDataset`, `TileManifestEntry`, `TilePublishManifest`, and `VectorTilesetSchemaContract`.
- `packages/geo-tiles/src/index.ts` implements the runtime helpers that parse and validate those contracts.
- The package does not build PMTiles on its own. Scripts own file I/O and publish sequencing, while the web app owns manifest fetches and map-source mounting.

This is a narrow but important package because tile-path and manifest drift would otherwise break both publication and frontend reads.

## Key exported responsibilities

### Dataset validation

`parseTileDataset()` is the package's first gate. It only accepts the dataset IDs the repo currently supports:

- `parcels`
- `parcels-draw-v1`
- `parcels-analysis-v1`
- `infrastructure`
- `power`
- `telecom`

That ensures scripts and clients reject unknown dataset strings early instead of publishing or loading broken artifact paths.

### Manifest parsing and invariants

The main runtime surface is manifest validation:

- `parseTileManifestEntry()` validates one current or previous manifest entry.
- `parseTilePublishManifest()` validates the full publish payload.
- `assertTileManifestMatchesDataset()` enforces the invariant that the manifest dataset, current entry dataset, and previous entry dataset all match.

This is the core protection against mixed-dataset manifests or malformed JSON being treated as valid tile metadata.

### Version and path creation

The package also standardizes how the repo names live tile artifacts:

- `createTileVersion()` generates the date-plus-checksum version string
- `buildPmtilesPath()` builds the `/tiles/<dataset>/<version>.pmtiles` path
- `buildTileLatestManifestPath()` builds the canonical `/tiles/<dataset>/latest.json` location
- `createManifestEntry()` and `createPublishManifest()` compose those helpers into a validated next manifest

That gives the publish scripts and the web runtime one shared file-layout contract.

## Current consumers

| Consumer | Runtime purpose |
| --- | --- |
| `apps/web/src/features/parcels/parcels.service.ts` | Fetches the manifest JSON, validates it with `parseTilePublishManifest()`, and turns the current asset URL into a `pmtiles://` source URL. |
| `apps/web/src/features/parcels/parcels.layer.ts` | Reuses the tile dataset types and manifest-derived source identity when mounting parcel overlays. |
| `scripts/publish-parcels-manifest.ts` | Validates dataset flags, creates versioned manifest entries, copies the PMTiles artifact, and writes `latest.json`. |
| `scripts/rollback-parcels-manifest.ts` | Reads and validates `latest.json`, verifies the rollback target exists, and swaps current versus previous entries by writing a new publish manifest. |

This package is therefore on both sides of the parcel tile path: script-time publication and browser-time manifest consumption.

## Tile concerns in this repo

- The package owns dataset naming, manifest shape, and artifact-path rules.
- the publish scripts own checksum calculation, file copies, temp-file writes, and rollback orchestration.
- the web parcel runtime owns when manifests are fetched and how PMTiles sources are mounted into the map.

That split keeps the tile metadata contract stable while letting scripts and UI stay focused on their own operational concerns.

## Tests and build behavior

`packages/geo-tiles/package.json` defines:

- `build`: `tsc -p tsconfig.json && tsc-alias -p tsconfig.json`
- `typecheck`: `tsc --noEmit -p tsconfig.json`
- `lint`: `biome check .`
- `test`: `bun test`

`test/tile-manifest.test.ts` currently covers the most important invariant: the package rejects manifests whose `current` or `previous` entries do not match the requested dataset. That is a small test surface, but it targets the highest-value failure mode for the publish flow.

## Related docs

- Use [Parcel And Tile Workflows](/docs/operations/parcel-and-tile-workflows) for the end-to-end scripts that call this package.
- Use [Web Runtime Foundations](/docs/applications/web-runtime) for the parcel frontend runtime that consumes the live manifest.
- Use [Sync Architecture](/docs/data-and-sync/sync-architecture) for the broader parcel artifact lifecycle around build and publish.
- Use [Fixtures](/docs/packages/fixtures) if dataset-tier framing starts driving tile stress scenarios more directly.
