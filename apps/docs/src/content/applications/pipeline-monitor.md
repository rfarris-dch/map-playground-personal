---
title: Pipeline Monitor
description: The separate Vue dashboard that visualizes parcel pipeline progress and publish state.
---

`apps/pipeline-monitor` is a dedicated Vue 3 + Vite surface for parcel pipeline monitoring. It is intentionally separate from the web app so operational visibility does not depend on the map runtime.

## Entrypoints

- `apps/pipeline-monitor/src/main.ts` mounts the Vue application and imports the shared app stylesheet.
- `apps/pipeline-monitor/src/app.vue` renders the dashboard page shell and mounts `PipelineDashboard`.

## App structure

The app shell is intentionally small:

- title and operator-facing context
- one dashboard feature mount
- no routing or cross-app reuse from `apps/web`

That keeps the monitor focused on ingestion state instead of becoming a second product surface.

## What the monitor represents

Based on the repo README and the runbook material, the monitor exists to visualize parcel pipeline phases such as:

- extraction
- canonical load and swap
- PMTiles build
- manifest publish

## Relationship to the broader repo

- It reads parcel pipeline state that the API and scripts also care about.
- It is closely related to the parcel sync worker and the parcel operations scripts.
- It should be cross-read with the runbook page and the parcel/tile workflow page when debugging ingestion failures.

## Operational value

The monitor is the fastest surface for answering:

- Is the current run moving?
- Which phase is stalled?
- Did the publish step finish?
- Is a runbook intervention likely needed?
