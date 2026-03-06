---
title: Start Here
description: A short path through the monorepo, the docs app, and the runtime surfaces that matter first.
sources:
  - README.md
  - package.json
  - apps/docs/src/features/docs/docs-navigation.service.ts
---

This docs app is the repository-facing entrypoint for `map-platform`. It is meant to replace repo spelunking with a stable map of the runtime, package, and operational surfaces that actually exist today.

## What this app documents

- The three runnable applications in `apps/web`, `apps/api`, and `apps/pipeline-monitor`.
- The shared runtime and contract packages in `packages/*`.
- The parcel sync, tile publish, and rollback workflows in `scripts/*`.
- The existing architecture, research, review, and runbook artifacts already stored in `docs/*`.

## Suggested reading order

1. Read [Workspace And Commands](/docs/getting-started/workspace-and-commands) for the monorepo layout and root commands.
2. Read [Repository Architecture](/docs/repository/architecture) for the current bounded contexts and production-path rules.
3. Read the application foundations pages before drilling into package or operations details.
4. Use the search modal for exact route, package, or script names when you already know the term you need.

## New contributor path

If you are starting cold, use this exact sequence:

1. [Workspace And Commands](/docs/getting-started/workspace-and-commands)
2. [Repository Architecture](/docs/repository/architecture)
3. The runtime page for the app you are changing
4. The package page for any shared dependency you touch
5. [Architecture Artifacts](/docs/artifacts/architecture-artifacts) if the task mentions prior architecture, research, review, or runbook material

## Fast orientation

### Frontend runtime

The web application is a Vue 3 + Vite surface centered on `apps/web/src/pages/map-page.vue` and the composition-root runtime in `apps/web/src/features/app/use-app-shell.ts`.

### API runtime

The API is a Hono service started by `apps/api/src/index.ts`, with HTTP middleware and route registration in `apps/api/src/app.ts`, Bun SQL access in `apps/api/src/db/postgres.ts`, and long-running sync loops in `apps/api/src/sync-worker.ts`.

### Pipeline monitor

The monitor is a separate Vue app in `apps/pipeline-monitor` that visualizes parcel pipeline state without sharing the web app runtime.

## How to use the source references

Every page in this app points back to authoritative file paths. The docs explain behavior. The source files remain the source of truth for exact runtime semantics.

:::note Docs Scope
This docs app is intentionally isolated to docs surfaces and minimal workspace wiring. It does not pull runtime code from the product apps into the docs bundle.
:::
