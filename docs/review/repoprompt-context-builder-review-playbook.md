# RepoPrompt Staged Review Playbook

## Goal

Use RepoPrompt `context_builder` to prepare clean, stage-specific context packets for external review in GPT-5 Pro.
This playbook is discovery-only.
Do not perform code review or propose fixes during context-building runs.

## RepoPrompt Operating Notes (for this workflow)

- Prefer `context_builder` for complex discovery and context curation.
- Use `response_type: "clarify"` to get context + rewritten prompt without starting review output.
- After building context, export with `workspace_context` so you can paste prompt + code context into GPT-5 Pro.

## Standard Per-Stage Workflow

Run these in a fresh RepoPrompt session/tab for each stage.

1. Build stage context.

```json
{
  "tool": "context_builder",
  "response_type": "clarify",
  "instructions": "<stage prompt from this document>"
}
```

2. Inspect selected files.

```json
{
  "tool": "manage_selection",
  "op": "get",
  "view": "files"
}
```

3. Export context bundle for GPT-5 Pro paste.

```json
{
  "tool": "workspace_context",
  "include": ["prompt", "selection", "files", "tokens"]
}
```

4. If token size is too high, rerun stage with tighter discovery hints or split into sub-stage A/B.

## Global Prompt Rules For All Stages

Add these constraints in every stage prompt:

- Build context only; do not perform review, do not suggest fixes.
- Return a rewritten review prompt targeted at GPT-5 Pro.
- Optimize for high-signal files, not max file count.
- Follow imports/dependencies only when they materially affect behavior.
- Exclude generated/build artifacts (`dist`, `node_modules`, `.turbo`, `var`, `.cache`).

## Stage 1: System Frame And Contracts

Focus: architecture baseline, bounded contexts, contract surfaces, cross-app coupling.

```xml
<task>Build context for Stage 1: system framing and shared contracts. Do not review code.</task>
<context>
Goal: produce a context packet and rewritten prompt for external GPT-5 Pro review.
Scope priority:
- README.md
- PROGRESS.md
- docs/architecture/ddd.qmd
- package.json, turbo.json, tsconfig.base.json
- packages/contracts/src/index.ts
- packages/geo-sql/src/index.ts
- packages/map-layer-catalog/src/index.ts
Output requirements:
1) Curated file selection for architecture/contracts understanding.
2) Copy-ready rewritten review prompt focused on boundaries and contract integrity.
3) Suggested split if context is too large.
</context>
<discovery_agent-guidelines>
Start from root docs/config, then follow only imports needed to explain contract flow into apps/api and apps/web.
</discovery_agent-guidelines>
```

## Stage 2: API Serving Surface

Focus: request handling, validation, mapping, repository behavior, route boundaries.

```xml
<task>Build context for Stage 2: API serving layer in apps/api. Do not review code.</task>
<context>
Goal: prepare external review context for API correctness and maintainability.
Scope priority:
- apps/api/src/index.ts
- apps/api/src/db/postgres.ts
- apps/api/src/geo/facilities/*
- apps/api/src/geo/parcels/*
- apps/api/test/geo/facilities/*
- apps/api/test/geo/parcels/*
- packages/contracts/src/index.ts
- packages/geo-sql/src/index.ts
Output requirements:
1) Curated API file set with reasons.
2) Rewritten GPT-5 Pro review prompt focused on route/repo/mapper quality and transport boundaries.
3) Optional split suggestion by facilities vs parcels if needed.
</context>
<discovery_agent-guidelines>
Prefer route->repo->mapper flow and include only dependencies that affect runtime behavior or schema validation.
</discovery_agent-guidelines>
```

## Stage 3: API Sync Runtime And Data Refresh Services

Focus: sync orchestration inside API runtime and service boundaries.

```xml
<task>Build context for Stage 3: API sync services and runtime scheduling hooks. Do not review code.</task>
<context>
Goal: prepare context for external review of sync lifecycle and failure modes.
Scope priority:
- apps/api/src/index.ts
- apps/api/src/sync/hyperscale-sync.service.ts
- apps/api/src/sync/hyperscale-sync.types.ts
- apps/api/src/sync/parcels-sync.service.ts
- apps/api/src/sync/parcels-sync.types.ts
- apps/api/src/db/postgres.ts
- packages/ops/src/index.ts
- relevant contract/sql package files only if referenced
Output requirements:
1) Curated sync-runtime file set.
2) Rewritten GPT-5 Pro review prompt focused on scheduler behavior, startup guarantees, and error handling paths.
3) Split suggestion if hyperscale and parcels sync should be reviewed separately.
</context>
<discovery_agent-guidelines>
Follow runtime wiring from api entrypoint into sync services and shared ops helpers.
</discovery_agent-guidelines>
```

## Stage 4: Web App Shell, Runtime, And Shared UI Plumbing

Focus: app startup, map runtime wiring, shared utilities, diagnostics/measure/layer runtime.

```xml
<task>Build context for Stage 4: web app runtime foundation in apps/web. Do not review code.</task>
<context>
Goal: create context packet for external review of frontend runtime architecture.
Scope priority:
- apps/web/src/main.ts
- apps/web/src/app.vue
- apps/web/src/lib/*
- apps/web/src/features/basemap/*
- apps/web/src/features/layers/*
- apps/web/src/features/diagnostics/*
- apps/web/src/features/measure/*
- packages/map-engine/src/index.ts
- packages/map-style/src/index.ts
Output requirements:
1) Curated web-foundation file set.
2) Rewritten GPT-5 Pro review prompt focused on runtime ownership, state flow, and map integration boundaries.
3) Split recommendation if needed for diagnostics vs map runtime.
</context>
<discovery_agent-guidelines>
Keep feature-level depth shallow here; deep facilities/parcels review is handled in later stages.
</discovery_agent-guidelines>
```

## Stage 5: Facilities Vertical Slice (Web + API + Contracts)

Focus: end-to-end facilities behavior from API contracts to map interactions and detail UI.

```xml
<task>Build context for Stage 5: facilities end-to-end slice. Do not review code.</task>
<context>
Goal: prepare external review context for the full facilities flow.
Scope priority:
- apps/web/src/features/facilities/*
- apps/web/src/features/facilities/facility-detail/*
- apps/web/src/app.vue (only relevant sections)
- apps/api/src/geo/facilities/*
- apps/api/test/geo/facilities/*
- packages/contracts/src/index.ts
- packages/geo-sql/src/index.ts
Output requirements:
1) Curated facilities E2E file set.
2) Rewritten GPT-5 Pro review prompt focused on interaction correctness, API/web contract alignment, and map feature-state handling.
3) Optional split suggestion for list/hover vs detail flow.
</context>
<discovery_agent-guidelines>
Trace facilities flow: viewport fetch -> map layer state -> click/hover -> detail fetch/render.
</discovery_agent-guidelines>
```

## Stage 6: Parcels Vertical Slice (Web + API + Contracts + Tiles)

Focus: parcel E2E behavior, PMTiles integration, parcel detail/enrich paths.

```xml
<task>Build context for Stage 6: parcels end-to-end slice. Do not review code.</task>
<context>
Goal: prepare external review context for parcel runtime + API + tile contracts.
Scope priority:
- apps/web/src/features/parcels/*
- apps/web/src/features/parcels/parcel-detail/*
- apps/web/src/app.vue (parcel-related sections)
- apps/api/src/geo/parcels/*
- apps/api/test/geo/parcels/*
- packages/contracts/src/index.ts
- packages/geo-tiles/src/index.ts
- packages/map-layer-catalog/src/index.ts
- packages/map-engine/src/index.ts
Output requirements:
1) Curated parcels E2E file set.
2) Rewritten GPT-5 Pro review prompt focused on guardrails, tile/runtime behavior, and API query semantics.
3) Suggested split for render path vs detail/enrich path when tokens are high.
</context>
<discovery_agent-guidelines>
Follow parcel flow from layer runtime controls and PMTiles source wiring to detail/enrich API calls.
</discovery_agent-guidelines>
```

## Stage 7: Pipeline-Monitor App

Focus: monitoring UI architecture and service/view split.

```xml
<task>Build context for Stage 7: pipeline-monitor app. Do not review code.</task>
<context>
Goal: prepare external review context for the pipeline-monitor app only.
Scope priority:
- apps/pipeline-monitor/src/main.ts
- apps/pipeline-monitor/src/app.vue
- apps/pipeline-monitor/src/features/pipeline/*
- packages/contracts/src/index.ts (only relevant contracts)
Output requirements:
1) Curated pipeline-monitor file set.
2) Rewritten GPT-5 Pro review prompt focused on view/service separation, data refresh semantics, and maintainability.
3) Split suggestion only if UI component depth requires it.
</context>
<discovery_agent-guidelines>
Limit dependencies to what directly shapes pipeline feature behavior.
</discovery_agent-guidelines>
```

## Stage 8: Data/Ops Scripts And Operational Safety

Focus: shell + TS scripts, schema/sql assets, publication/rollback workflows.

```xml
<task>Build context for Stage 8: data pipeline scripts and operational tooling. Do not review code.</task>
<context>
Goal: prepare external review context for operational reliability and script correctness.
Scope priority:
- scripts/refresh-hyperscale.sh
- scripts/refresh-parcels.sh
- scripts/refresh-parcels.ts
- scripts/load-parcels-canonical.sh
- scripts/build-parcels-draw-pmtiles.sh
- scripts/publish-parcels-manifest.ts
- scripts/rollback-parcels-manifest.ts
- scripts/init-parcels-schema.sh
- scripts/sql/parcels-canonical-schema.sql
- scripts/run-parcels-sync-launchd.sh
- related packages/ops or packages/geo-tiles files only if directly imported
Output requirements:
1) Curated ops/script file set.
2) Rewritten GPT-5 Pro review prompt focused on idempotency, rollback safety, failure handling, and path correctness.
3) Split suggestion for sync/load/build/publish phases if needed.
</context>
<discovery_agent-guidelines>
Follow execution chain order and include only dependencies needed to understand each step.
</discovery_agent-guidelines>
```

## Stage 9: Shared Packages Quality Pass

Focus: shared package APIs and cross-app ergonomics.

```xml
<task>Build context for Stage 9: shared packages quality pass. Do not review code.</task>
<context>
Goal: prepare external review context for shared library surfaces and consistency.
Scope priority:
- packages/map-engine/src/index.ts
- packages/map-style/src/index.ts
- packages/map-style/src/manifests/layer-order.ts
- packages/map-layer-catalog/src/index.ts
- packages/ops/src/index.ts
- packages/geo-tiles/src/index.ts
- packages/geo-sql/src/index.ts
- packages/contracts/src/index.ts
- package-level package.json files where exports/peer deps matter
Output requirements:
1) Curated shared-package file set.
2) Rewritten GPT-5 Pro review prompt focused on API design clarity, type contracts, and dependency boundaries.
3) Sub-stage split suggestion if package set exceeds token target.
</context>
<discovery_agent-guidelines>
Prioritize exported surfaces and direct consumers in apps/api and apps/web.
</discovery_agent-guidelines>
```

## Suggested Stage Order

1. Stage 1
2. Stage 2
3. Stage 3
4. Stage 4
5. Stage 5
6. Stage 6
7. Stage 7
8. Stage 8
9. Stage 9

## Handoff Checklist Per Stage

Before moving to next stage, make sure you have:

1. `workspace_context` output containing `prompt`, `selection`, `files`, and `tokens`.
2. Rewritten prompt explicitly targeted for GPT-5 Pro code review.
3. Stage name and date in your pasted handoff.
4. Any split recommendation if context exceeded your token budget.
