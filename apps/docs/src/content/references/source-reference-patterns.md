---
title: Source Reference Patterns
description: The docs-to-source linking model used in this docs app to keep explanations anchored to real files.
---

This docs app uses a simple rule: every major page should name the real source files that define the behavior it explains.

## Authoritative vs explanatory content

| Content type | What it is | Where it lives |
| --- | --- | --- |
| Authoritative runtime source | Executable code, schemas, scripts, or operational artifacts. | `apps/*`, `packages/*`, `scripts/*`, selected `docs/*` artifacts. |
| Explanatory docs | Human-readable summaries, boundaries, and workflow explanations. | `apps/docs/src/content/*` |

## Reference pattern used here

Each docs page should include:

1. concrete file paths
2. a sentence on why those files matter
3. internal cross-links to related docs pages

This keeps readers from having to search the repo manually when they already know the topic they are on.

## When to create a dedicated reference page

Create a separate page when:

- a package is used by multiple apps
- an operational workflow spans scripts, API, and UI
- an existing architecture artifact already exists in `docs/*`

## Current reference anchors

- `packages/contracts` for transport schemas
- `apps/api/src/app.ts` for registered HTTP surface
- `apps/web/src/features/app/use-app-shell.ts` for frontend composition ownership
- `scripts/*` for the operational parcel path
- `docs/architecture/*`, `docs/research/*`, `docs/review/*`, and `docs/runbooks/*` for migrated artifacts
