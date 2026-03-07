# Map Context Transfer Plan

## Goal

Allow users to move from the global discovery map into market, company, and dashboard map surfaces while preserving the relevant map context.

## Product Reason For This Work

The strongest product signal from Obsidian is not “add another map page.” It is “stop dropping context.”

Notes from `app-site walkthrough` and `Matt's app-site walkthrough notes` describe the current linking gap clearly:

- the map is the discovery entry point
- users explore a market, measure distances, and mark up areas
- they then want to move into a market view
- dashboard-to-map linking does not currently carry market context
- company pages have the same problem, and it is worse because company context is not region-scoped the same way as markets

## Current State In This Repo

This repo has no map-context transfer system today.

### What exists

- a single `/map` route in `apps/web/src/app-router.ts`
- a global default map center and zoom in `apps/web/src/features/app/lifecycle/app-shell-map.service.ts`
- table routes for markets, providers, and facilities

### What does not exist

- route-query parsing for map state
- a serializable map-launch context
- market-specific map routes
- company-specific map routes
- navigation helpers for cross-surface map handoff

The existing navigation feature only defines labels and route metadata. It does not move contextual state between surfaces.

## What The Live App Adds To This Picture

The live app already has the destination surfaces that this repo is missing:

- global map: `/map`
- market dashboard: `/markets/:market-slug/dashboard`
- market map: `/markets/:market-slug/map`
- company dashboard: `/companies/:company-kind/:company-slug/dashboard`
- company map: `/companies/:company-kind/:company-slug/map`

So the real product problem is not “do we need market and company maps.” The product already has them. The missing behavior is reliable context transfer into those surfaces from global discovery workflows and dashboard entry points.

## Recommended Architecture

### 1. Define a shared context contract

Create a serializable `MapContextTransfer` contract that can travel between routes and applications.

Suggested fields:

- source surface
- target surface
- market ids
- company ids
- provider ids if needed
- facility ids if needed
- active perspectives
- selected boundary ids
- viewport center and zoom or bounds
- optional selection geometry token
- optional highlight target

### 2. Split short context from large context

Do not try to put everything into raw query params.

Use two levels:

- short context in URL query for market ids, company ids, perspective, and viewport
- stored context token for large payloads such as drawn geometry, facility sets, or markup state

That avoids unreadable URLs and makes the contract safe to evolve.

### 3. Add import and export seams around the map shell

The map shell needs two capabilities:

- export current context into a transfer payload
- initialize itself from a transfer payload

That initialization should happen before the facilities and boundary runtimes settle so the first rendered state already reflects the transferred context.

### 4. Centralize the behavior in navigation services

The route metadata feature is too small for this today. Expand navigation responsibility with:

- context builders
- context parsers
- navigation helpers for `view market`, `view company`, and `open in dashboard`

### 5. Make destination surfaces consume the same contract

This repo can implement the shared contract and map bootstrap behavior, but full delivery will also require the downstream app-site surfaces that own:

- market dashboards
- company pages
- embedded dashboard maps

The live app route structure means this contract should be usable across at least three destination families:

- dashboard pages
- standalone market or company map pages
- embedded or in-dashboard map modules

## Suggested Repo Changes

### Frontend

- Add a new feature such as `features/map-context-transfer`.
- Add typed helpers for:
  - serializing short query context
  - reading query context from routes
  - resolving stored context tokens
  - applying context to the map shell
- Update the map shell bootstrap to accept initial context rather than always starting from the hardcoded national center.

### Router

- Extend `/map` to read query or tokenized context.
- If market or company map routes are added here later, make them all consume the same contract rather than inventing route-local state formats.

### API or storage

- Add a lightweight persistence seam for large context payloads if drawn geometry or markup state must survive route changes.
- This can be a short-lived backend token or a local-storage backed token depending on cross-app requirements.

## Delivery Phases

### Phase 1: Same-app transfer

Implement same-app context handoff into `/map` using route query plus optional local token.

This is the minimum needed to prove:

- global map can be launched in a market-specific state
- map can preserve selected perspectives and viewport
- market and company map routes can deserialize the same context object format

### Phase 2: Cross-surface transfer

Add explicit actions from map results into market and company surfaces:

- `View Market`
- `View Company`
- `Open Dashboard Map`

### Phase 3: Cross-application or embedded-map transfer

If dashboard maps live outside this repo, align on the shared contract and token storage so all surfaces deserialize the same context object.

## Open Questions

- Which context is essential on first launch: market id only, or viewport plus overlays plus active layers?
- Does “transfer map” mean opening a full standalone map view, or seeding an embedded dashboard map?
- Must selection geometry and markups survive the transfer, or is market and company filtering enough for v1?
- Are company pages expected to resolve to a company-scoped facility subset, or to a company page with a market-aware default viewport?

## Risks

- If each destination surface invents its own context format, this will become another brittle linking layer.
- If large geometry payloads are forced into URLs, links will be fragile.
- If the map shell still initializes to the hardcoded national state before applying context, users will see a distracting reset flash.

## Dependencies

- Depends on a shared contract that may need to be consumed outside this repo.
- Becomes much more valuable once the separate selection tool can provide market ids and optional geometry tokens.

## Acceptance Criteria

- A user can launch the map in a market-specific or company-specific state without manually re-filtering.
- The map shell can bootstrap from serialized context instead of only from hardcoded national defaults.
- Destination surfaces use one shared transfer contract for incoming map context.
- The first visible map state reflects the transferred context rather than resetting to the global default and then catching up.
- The transfer design matches the existing live route families instead of inventing a second navigation model.
