---
title: Workspace And Commands
description: The monorepo layout, shared commands, and repo rules that shape how work is done here.
---

The root workspace uses Bun workspaces plus Turbo orchestration. The current root `package.json` declares `apps/*` and `packages/*` as workspaces and exposes shared developer commands.

## Workspace layout

| Path | Role |
| --- | --- |
| `apps/web` | Vue 3 + Vite map application built on MapLibre and shared map packages. |
| `apps/api` | Hono API for boundaries, facilities, parcels, providers, markets, and sync status. |
| `apps/pipeline-monitor` | Vue dashboard for parcel pipeline progress and publish state. |
| `apps/docs` | Vue docs app that documents the repo without changing product behavior. |
| `packages/contracts` | Shared Zod schemas, route builders, and transport contracts. |
| `packages/map-engine` | MapLibre adapter and engine-facing interfaces. |
| `packages/map-layer-catalog` | Layer IDs, defaults, visibility budgets, and catalog validation. |
| `packages/map-style` | Base style helpers and layer ordering constraints. |
| `packages/geo-sql` | SQL query specs for geospatial reads. |
| `packages/geo-tiles` | Tile manifest parsing, versioning, and publish helpers. |
| `packages/ops` | Shared operational helpers like request IDs and diagnostics. |
| `packages/bench` | Endpoint budget definitions. |
| `packages/fixtures` | Dataset tier definitions for benchmark and scale framing. |
| `scripts` | Operational shell and TypeScript entrypoints for sync, load, tile publish, and rollback. |

## Common root commands

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

## Docs app quality gates

```bash
bun --cwd apps/docs lint
bun --cwd apps/docs typecheck
bun --cwd apps/docs build
bun x ultracite fix apps/docs docs
bun x ultracite check apps/docs docs
```

## Repository conventions that matter here

### Vue conventions

- Vue work uses Composition API with `<script setup lang="ts">`.
- Route views should stay thin and delegate stateful behavior to focused composables and services.
- Feature-specific contracts should live in `*.types.ts`.
- Reusable pure helpers should live in `*.service.ts`.

### Naming and export rules

- File and directory names are kebab-case.
- Do not add pass-through export wrappers that only re-export another file.
- Prefer meaningful domain barrels or direct imports from the real module.

### Production-path rules

- The repo defaults to one real implementation path.
- Runtime fallbacks, legacy branches, and source-mode toggles are not added unless there is an explicit migration request.
- Required infrastructure should fail fast with clear errors.

## Where contributors usually start

1. `README.md` for the repo frame.
2. `AGENTS.md` for repo rules and workflow constraints.
3. This docs app for app, package, and operational coverage.
4. The migrated artifacts pages when a task touches an existing architecture or runbook document.
