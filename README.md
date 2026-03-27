# map-platform

Monorepo for the mapping stack used in this workspace.

## Workspace layout

- `apps/web`: Vue 3 + Vite map application built on MapLibre.
- `apps/api`: Hono API for facilities, parcels, boundaries, providers, markets, and sync status.
- `packages/http-contracts`: shared Zod schemas, API contracts, and route builders.
- `packages/geo-kernel`: core geometry, facility, and domain types.
- `packages/map-engine`: MapLibre adapter and shared map runtime interfaces.
- `packages/map-layer-catalog`: layer catalog definitions and validation helpers.
- `packages/geo-sql`: shared SQL query specs for geospatial access patterns.
- `packages/geo-tiles`: tile manifest and publish helpers.
- `packages/map-style`: shared style configuration and map styling helpers.
- `packages/ops`: operational helpers shared across services.

## Common commands

```bash
bun install
bun run dev
bun run dev:web
bun run dev:api
bun run build
bun run test
bun run typecheck
bun run init:market-source-schema
bun run sync:market-source
bun run init:market-canonical-schema
bun run load:market-canonical
bun x ultracite fix
bun x ultracite check
```

## Project conventions

- TypeScript-first workspace with shared contracts in `packages/http-contracts`.
- Frontend feature modules are organized by feature area under `apps/web/src/features`.
- API slices follow route + service/repo + mapper boundaries under `apps/api/src/geo`.
- Formatting and linting are enforced through Biome and Ultracite.

## Notes

- The web app uses Vite.
- The API and several packages use Bun-native scripts and test execution.
- Parcel sync runs through the dedicated worker entrypoint in `apps/api/src/sync-worker.ts`.
- Market source landing lives in `market_source.*`; canonical market modeling for the hybrid
  relational core now lives in `canon.*` with `serve.*` read models.
