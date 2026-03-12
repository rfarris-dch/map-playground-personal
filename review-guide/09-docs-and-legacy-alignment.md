# Docs And Legacy Alignment

## Goal

Review the documentation surfaces as part of the architecture, not as afterthoughts. The main question is whether the docs, plans, and knowledge artifacts reinforce simpler boundaries and shared understanding, or whether they preserve stale migration language and duplicate truth.

## Area snapshot

- `apps/docs/src/content`: about 41 files and ~4806 lines
- `apps/docs/src/features`: about 28 files and ~3201 lines
- root `README.md`
- `plans/`
- QMD-backed DatacenterHawk notes outside the repo

## Start here

- `README.md`
- `apps/docs/src/content/repository`
- `apps/docs/src/content/applications`
- `apps/docs/src/content/packages`
- `apps/docs/src/content/operations`
- `apps/docs/src/content/references`
- `plans`
- `qmd://projects/datacenterhawk/datacenterhawk/developer-notes/architectural-study-guide.md`
- `qmd://projects/datacenterhawk/datacenterhawk/app-site-walkthrough.md`
- `qmd://projects/datacenterhawk/datacenterhawk/general-notes.md`
- `qmd://projects/datacenterhawk/datacenterhawk/power-product/power-project-overview.md`

## Main questions

- Do the docs describe the current runtime boundaries accurately?
- Are docs pages explaining the code, or compensating for code that is too hard to follow?
- Are there multiple documents describing the same seam with slightly different names?
- Are legacy DatacenterHawk concepts captured once and referenced, or repeatedly paraphrased?
- Are plans, docs, and runtime files clearly separated by role?
- Does the docs app itself stay small and utilitarian, or is it creating its own architecture burden?

## Alignment prompts

- Compare repo terminology against the legacy notes:
  - facilities and providers
  - markets and county rollups
  - parcel and power product workflows
  - operator workflows vs product workflows
  - current data vs historical data
- Check whether the docs keep those distinctions crisp.
- Check whether any doc recommends a structure the code no longer follows.

## Simplicity prompts

- Look for docs that could be merged because they explain the same boundary from two angles.
- Look for docs that should be generated, linked, or reduced instead of rewritten repeatedly.
- Look for knowledge that belongs in code comments or tests rather than long docs prose.
- Look for plans that have become stale but still shape decisions.

## DDD prompts

- Does the documentation make bounded contexts easier to recognize?
- Does it reinforce one reason to change per area?
- Does it help reviewers distinguish essential complexity from accidental complexity?
- Does it preserve domain language without bloating the repo with repeated explanations?

## Deliverables for this pass

- a list of docs that are architecture-critical
- a list of docs that should be merged, archived, or reduced
- naming mismatches between code, docs, and legacy notes
- the top places where better documentation would reduce future code complexity

## What not to do

- Do not try to make docs the source of truth when runtime files already own the behavior.
- Do not archive legacy knowledge that is still operationally relevant.
- Do not keep verbose documentation that merely compensates for avoidable code sprawl.
