# map-platform

Monorepo for the mapping stack used in this workspace.

## Workspace layout

- `apps/web`: Vue 3 + Vite map application built on MapLibre.
- `apps/api`: Hono API for facilities, parcels, boundaries, providers, markets, and sync status.
- `apps/pipeline-monitor`: Vue dashboard for parcel pipeline monitoring.
- `packages/contracts`: shared Zod schemas, API contracts, and route builders.
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
bun run dev:pipeline-monitor
bun run build
bun run test
bun run typecheck
bun x ultracite fix
bun x ultracite check
```

## Project conventions

- TypeScript-first workspace with shared contracts in `packages/contracts`.
- Frontend feature modules are organized by feature area under `apps/web/src/features`.
- API slices follow route + service/repo + mapper boundaries under `apps/api/src/geo`.
- Formatting and linting are enforced through Biome and Ultracite.

## Notes

- The web app and pipeline monitor both use Vite.
- The API and several packages use Bun-native scripts and test execution.
- Parcel sync runs through the dedicated worker entrypoint in `apps/api/src/sync-worker.ts`.
