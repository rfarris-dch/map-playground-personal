# API Runtime And Geo Slices

## Goal

Review the API as a set of explicit serving slices rather than as one generic service layer. The main question is whether the runtime keeps transport, query, mapping, and slice-specific policy separate enough to stay legible while still avoiding ceremony.

## Area snapshot

- `apps/api/src/http`: about 12 files and ~1000 lines
- `apps/api/src/effect`: about 4 files and ~700 lines
- geo slices:
  - `analysis-summary`: ~1503 lines
  - `county-scores`: ~1459 lines
  - `facilities`: ~1460 lines
  - `parcels`: ~1286 lines
  - `fiber-locator`: ~1119 lines
  - `markets`: ~781 lines
  - `providers`: ~422 lines
  - `boundaries`: ~342 lines
  - `flood`: ~329 lines

## Start here

- `apps/api/src/index.ts`
- `apps/api/src/app.ts`
- `apps/api/src/http`
- `apps/api/src/config`
- `apps/api/src/db`
- `apps/api/src/effect`
- `apps/api/src/geo`
- `apps/docs/src/content/applications/api-runtime.md`
- `apps/docs/src/content/applications/api-geo-slices.md`
- `apps/docs/src/content/applications/api-boundaries-and-facilities.md`
- `apps/docs/src/content/applications/api-fiber-markets-and-providers.md`
- `apps/docs/src/content/applications/api-parcels-and-sync.md`

## Main questions

- Do routes stay transport-focused?
- Do repositories stay query-focused?
- Do mappers only map, or do they also encode policy?
- Are service and query-service layers introduced only when they earn their keep?
- Are there slices where the route-service-repo-mapper breakdown is now more expensive than the complexity it manages?
- Are there slices where logic is still too concentrated in routes or services?
- Is there a second architectural style emerging through the `effect` runtime that competes with the main slice shape?

## Slice-specific prompts

- Compare compact slices like `boundaries` with heavier slices like `facilities`, `parcels`, and `analysis-summary`.
- Ask whether each slice's internal shape matches the real complexity of the slice.
- Check whether similar route helper files exist because the route really has multiple subconcerns, or because the slice was fragmented too early.
- Check whether pagination, policy, query metadata, and response metadata are duplicated across slices.
- Check whether `analysis-summary`, `county-scores`, and `flood` are integrated into the same design language as the older documented slices.

## Transport and contract prompts

- Verify that shared headers, envelope logic, and route constants still come from shared contracts.
- Check whether runtime-config enforces one real production path or whether fallback behavior is creeping in.
- Check whether slice-local types duplicate package-contract types.
- Check whether route builders and contract schemas are driving the API design, or merely documenting it after the fact.

## DDD and simplicity prompts

- Which slice boundaries match real business concepts and which reflect endpoint history?
- Are some slices becoming "miscellaneous data access" modules?
- Are there services that are imperative step lists rather than domain-level operations?
- Are there functions that mix multiple abstraction layers in one flow?

## Legacy-context prompts

- The legacy HawkSuite API was broad and monolithic. This repo should not drift back toward endpoint accumulation without ownership.
- Reviewers should preserve slice identity where the business concepts are distinct.
- Reviewers should remove generic transport and service ceremony where it is only imitating enterprise architecture.

## Deliverables for this pass

- a slice-by-slice boundary assessment
- the main places where layers should collapse
- the main places where layers should be made more explicit
- duplicated transport and policy logic to centralize or delete
- the clearest signs of monolith-by-accretion risk

## What not to do

- Do not force every slice into the same number of files.
- Do not move SQL intent behind generic repositories.
- Do not recommend a global service layer that all slices must pass through.
