# Review Guide

This folder breaks the repo into review passes that are explicitly aimed at:

- lowering LOC and cognitive load
- removing accidental complexity
- tightening bounded contexts
- applying DDD where it clarifies ownership, not where it adds ceremony
- reducing duplication without inventing generic utility buckets
- checking SOLID and single-layer-of-abstraction discipline
- validating that Bun workspaces and Turbo boundaries are being used intentionally

## Context baked into this guide

This guide was shaped from two sources:

- the current repo itself, especially `README.md`, `AGENTS.md`, `package.json`, `turbo.json`, and the architecture pages under `apps/docs/src/content`
- DatacenterHawk notes pulled through `qmd`, especially:
  - `qmd://projects/datacenterhawk/datacenterhawk/developer-notes/architectural-study-guide.md`
  - `qmd://projects/datacenterhawk/datacenterhawk/developer-notes/developer-walkthrough/project-overviews.md`
  - `qmd://projects/datacenterhawk/datacenterhawk/app-site-walkthrough.md`
  - `qmd://projects/datacenterhawk/datacenterhawk/general-notes.md`
  - `qmd://projects/datacenterhawk/datacenterhawk/power-product/power-project-overview.md`
  - `qmd://projects/datacenterhawk/datacenterhawk/developer-notes/power-project/county-mapping-for-facilities-backend-implementation-plan.md`
  - `qmd://projects/datacenterhawk/datacenterhawk/developer-notes/power-project/environment-details.md`
  - the DDD and design note set under `qmd://projects/datacenterhawk/datacenterhawk/developer-notes/ddd/khalilstemmler-com/`

## Legacy truths to keep in mind while reviewing

- This repo is not greenfield. It sits in the shadow of a production system with multiple legacy repos, a Broadleaf/Tomcat monolith, and ArcGIS-era map workflows.
- Some complexity is essential because the business domain is real, not because the code is good. Do not confuse domain nuance with accidental complexity.
- Some domain distinctions must stay crisp even if the code gets smaller. Examples from the notes include:
  - current snapshot data vs historical capacity data
  - commissioned vs owned semantics
  - market-level analytics vs county-level rollups
  - product user flows vs operator/admin flows
  - interactive map runtime vs sync/publish runtime
- The goal is not to make everything look uniform. The goal is to make ownership obvious and remove structure that does not earn its keep.

## What a good review should produce

For each area file in this folder, the reviewer should leave with:

- a short boundary statement for the area
- the main accidental-complexity hotspots
- the best merge, delete, or move candidates
- the places where DDD language is helping and where it is becoming ceremony
- the places where Bun workspace boundaries are helping and where they are hiding awkward package splits
- a shortlist of changes that would simplify the area without breaking domain semantics

## Review order

1. `01-workspace-and-bounded-contexts.md`
2. `02-contracts-and-runtime-packages.md`
3. `03-data-packages-and-operational-libraries.md`
4. `04-web-map-shell-and-runtime.md`
5. `05-web-map-domains.md`
6. `06-web-reporting-and-analysis.md`
7. `07-api-runtime-and-geo-slices.md`
8. `08-sync-pipeline-and-operator-surfaces.md`
9. `09-docs-and-legacy-alignment.md`

## Global rules for the reviewer

- Prefer deletion, merge, or relocation before adding new abstractions.
- Treat every new layer as guilty until it proves it reduces coupling or duplication.
- Preserve domain language that maps to real business or operational behavior.
- Keep one real production path. Hidden fallbacks, alternate source modes, and migration leftovers should be treated as complexity debt unless they are still operationally required.
- Review by rate of change and ownership pressure, not by folder aesthetics alone.
- Check whether a package or feature is shared because it is truly shared, or because ownership was never decided.
- When two modules look similar, ask both questions:
  - should they be unified?
  - are they similar only because the business concepts have not been named precisely enough yet?
- Use evidence, not taste. Count files, count entrypoints, inspect imports, and identify who changes the code when requirements change.

## Recommended reviewer workflow

1. Read the relevant guide file.
2. Read the listed code paths before scanning deeper.
3. Compare the code shape against the repo docs and the DatacenterHawk legacy notes.
4. Separate essential complexity from accidental complexity.
5. Only then propose merges, deletions, or boundary changes.

## Useful commands

```bash
rg --files apps packages scripts review-guide
qmd get qmd://projects/datacenterhawk/datacenterhawk/developer-notes/architectural-study-guide.md
qmd get qmd://projects/datacenterhawk/datacenterhawk/app-site-walkthrough.md
qmd get qmd://projects/datacenterhawk/datacenterhawk/general-notes.md
```
