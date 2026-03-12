# Web Map Domains

## Goal

Review the map-facing feature domains as vertical slices. The main question is whether each feature owns one real business concept and one map behavior seam, or whether the features are leaking shell concerns and duplicating each other.

## Area snapshot

- `boundaries`: ~8 files and ~1277 lines
- `facilities`: ~15 files and ~1417 lines
- `fiber-locator`: ~8 files and ~1117 lines
- `parcels`: ~12 files and ~1390 lines
- `power`: ~9 files and ~954 lines
- `selection-tool`: ~6 files and ~767 lines
- `county-scores`, `flood`, `hydro-basins`, and `water`: smaller but still domain-specific map slices

## Start here

- `apps/web/src/features/boundaries`
- `apps/web/src/features/facilities`
- `apps/web/src/features/fiber-locator`
- `apps/web/src/features/parcels`
- `apps/web/src/features/power`
- `apps/web/src/features/selection-tool`
- `apps/web/src/features/county-scores`
- `apps/web/src/features/flood`
- `apps/web/src/features/hydro-basins`
- `apps/web/src/features/water`
- `apps/docs/src/content/applications/web-map-data-domains.md`
- `apps/docs/src/content/applications/web-feature-domains.md`

## Main questions

- Does each feature folder represent one user-facing or domain-facing concept?
- Are fetch logic, normalization logic, layer mounting, hover behavior, and detail behavior separated cleanly inside each feature?
- Are the same patterns being reimplemented across features in slightly different shapes?
- Are there similarities that should become shared map-domain primitives?
- Are there similarities that should stay separate because the underlying domain semantics differ?
- Are any features carrying cross-feature rules that really belong in the app shell, contracts package, or API?

## Domain prompts

- Verify that names match business meaning:
  - facilities vs parcels vs boundaries vs power infrastructure
  - market-facing layers vs county-facing layers
  - user interaction flows vs raw layer plumbing
- Check whether each feature hides its own map-specific details or leaks them to callers.
- Check whether some features are really read models over other domains rather than domains of their own.

## DRY and simplification prompts

- Compare hover implementations across facilities, fiber, boundaries, power, and parcels.
- Compare API modules and service modules across features.
- Compare layer-controller shapes across all map features.
- Compare `*.types.ts` surfaces for repeated transport or view-state concepts.
- Look for shared helpers that would remove duplication without creating a generic "map utils" graveyard.

## Legacy-context prompts

- The DatacenterHawk notes make clear that map layers carry real business semantics. Examples include power infrastructure, facilities, county rollups, and layer-visibility rules.
- Keep distinctions that matter to operators and customers.
- Do not collapse facility and parcel logic together only because they both render on the map.
- Do not erase county-vs-market distinctions just because both are polygons.

## Deliverables for this pass

- a short boundary statement for each feature family
- a list of duplicated patterns worth consolidating
- a list of features that should remain separate despite surface similarity
- the clearest merge, move, or delete candidates
- the top places where map domain logic is leaking into shell or component code

## What not to do

- Do not force every feature into an identical internal layout.
- Do not create a generic layer base class or universal feature controller unless the shared behavior is demonstrably real.
- Do not simplify by removing domain language.
