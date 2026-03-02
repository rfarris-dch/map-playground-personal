# @map-migration/api

Hono API service for geo endpoints.

Current slice:

- `GET /api/geo/facilities` with `bbox` + `perspective` + `limit`.
- `GET /api/geo/facilities/:facility-id` with `perspective` for detail fetch.
- Facilities route is Postgres-only (no fixtures or fallback source mode).
- Route + repository + mapper split for facilities DB-read flow.
- Bun-native Postgres access via `Bun.sql` with graceful shutdown cleanup.
