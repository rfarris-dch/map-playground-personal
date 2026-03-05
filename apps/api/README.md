# @map-migration/api

Hono API service for geo endpoints.

Current slice:

- `GET /api/geo/facilities` with `bbox` + `perspective` + `limit`.
- `GET /api/geo/facilities/:facility-id` with `perspective` for detail fetch.
- `GET /api/geo/boundaries/power?level=county|state|country` for commissioned-MW boundary choropleths.
- `GET /api/geo/fiber-locator/layers` for FiberLocator catalog entries filtered to configured line ids.
- `GET /api/geo/fiber-locator/tile/:layerName/:z/:x/:y.png` tile proxy for FiberLocator raster tiles.
- `GET /api/geo/fiber-locator/vector-tile/:layerName/:z/:x/:y.pbf` tile proxy for FiberLocator vector tiles.
- `GET /api/geo/parcels/:parcel-id` with optional `includeGeometry` + `profile`.
- `POST /api/geo/parcels/lookup` for parcel ID batch enrichment.
- `POST /api/geo/parcels/enrich` for AOI-based parcel enrichment (`bbox|polygon|county|tileSet`).
- Facilities and parcels routes are Postgres-only (no fixtures or fallback source mode).
- Route + repository + mapper split is used per geo slice.
- Sync loops run in a separate worker entrypoint (`src/sync-worker.ts`) instead of the HTTP server runtime.
- Bun-native Postgres access via `Bun.sql` with graceful shutdown cleanup.
