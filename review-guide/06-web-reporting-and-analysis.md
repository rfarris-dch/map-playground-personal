# Web Reporting And Analysis

## Goal

Review the non-shell web features that turn map selections, tables, and derived analysis into user-facing workflows. The main question is whether the reporting and analysis surface has clear ownership, or whether the same analytical concepts are spread across too many modules.

## Area snapshot

- `spatial-analysis`: about 27 files and ~3577 lines
- `measure`: about 11 files and ~1804 lines
- `map-context-transfer`: about 2 files and ~1323 lines
- `sketch-measure`: about 5 files and ~999 lines
- `scanner`: about 3 files and ~500 lines
- `quick-view`: about 4 files and ~258 lines
- `selection`: about 2 files and ~189 lines
- `markets`, `providers`, and `table`: small but important route-support surfaces

## Start here

- `apps/web/src/pages/markets-page.vue`
- `apps/web/src/pages/providers-page.vue`
- `apps/web/src/pages/facilities-page.vue`
- `apps/web/src/pages/facilities-hyperscale-page.vue`
- `apps/web/src/pages/facilities-colocation-page.vue`
- `apps/web/src/features/spatial-analysis`
- `apps/web/src/features/measure`
- `apps/web/src/features/map-context-transfer`
- `apps/web/src/features/sketch-measure`
- `apps/web/src/features/scanner`
- `apps/web/src/features/quick-view`
- `apps/web/src/features/selection`
- `apps/web/src/features/markets`
- `apps/web/src/features/providers`
- `apps/web/src/features/table`
- `apps/docs/src/content/applications/web-reporting-and-analysis-domains.md`

## Main questions

- Is there one clear analysis bounded context, or are multiple feature folders implementing overlapping analysis concepts?
- Do table routes stay focused on table concerns, or do they contain business logic that should be elsewhere?
- Are measure, sketch-measure, selection-tool, scanner, quick-view, and spatial-analysis arranged around user tasks or around implementation history?
- Is analytical normalization pure and centralized enough to be trusted?
- Are there multiple ways to compute or present the same summary?
- Are `map-context-transfer` and related selection flows their own bounded context, or a transport detail of the map shell?

## Domain prompts from DatacenterHawk notes

- Preserve distinctions that map to the business:
  - current state vs historical or rolled-up analysis
  - commissioned vs owned or physical-state metrics
  - market-level analytics vs county-level scoring
  - interactive selection workflows vs report-like summary workflows
- Use the notes about the "two tables problem" as a warning. A simplification that blurs current snapshot data and historical analytics is not a simplification.

## DRY and simplification prompts

- Compare summary and normalization logic across `spatial-analysis`, `measure`, `selection`, `scanner`, and `quick-view`.
- Check whether API modules in reporting features are too thin to justify separate files.
- Check whether any workflow is split across so many files that the reviewer cannot reconstruct it without tracing five modules.
- Look for view-model logic trapped inside Vue components that should be pulled into typed services.
- Look for service files that are only pass-through wrappers and should be folded back into the owning module.

## SOLID and abstraction prompts

- Are modules changing for one stakeholder reason, or multiple unrelated reasons?
- Are components at one abstraction layer, or mixing transport, normalization, UI, and export logic in one place?
- Are analysis services intention-revealing, or are they just long imperative transformation chains?

## Deliverables for this pass

- a map of the current analysis and reporting subcontexts
- a list of overlapping features that may need consolidation
- a list of features that are overloaded and should be split more cleanly
- the strongest delete or merge candidates
- the top places where business semantics are being blurred by implementation structure

## What not to do

- Do not collapse reporting, analysis, and map interaction into one "insights" bucket.
- Do not standardize every analysis flow if their inputs and outputs are genuinely different.
- Do not simplify by removing domain distinctions customers actually pay for.
