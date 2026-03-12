# Data Packages And Operational Libraries

## Goal

Review the shared packages closest to SQL, tiles, request diagnostics, and operational support. The key question is whether these packages are the right long-term seams, or whether they are carrying accidental complexity that belongs either inside an app or inside scripts.

## Area snapshot

- `packages/geo-sql`: about 3 files and ~900 lines
- `packages/geo-tiles`: about 4 files and ~500 lines
- `packages/ops`: about 7 files and ~500 lines
- `packages/bench`: about 2 files and ~30 lines
- `packages/fixtures`: about 1 file and ~40 lines

## Start here

- `packages/geo-sql/src`
- `packages/geo-tiles/src`
- `packages/ops/src`
- `packages/bench/src`
- `packages/fixtures/src`
- `apps/docs/src/content/packages/geo-sql.md`
- `apps/docs/src/content/packages/geo-tiles.md`
- `apps/docs/src/content/packages/ops.md`
- `apps/docs/src/content/packages/bench.md`
- `apps/docs/src/content/packages/fixtures.md`
- `apps/docs/src/content/packages/data-and-operations.md`

## Main questions

- Should `geo-sql` remain a package, or should some query code move back into owning API slices?
- Is `geo-tiles` a stable tile-manifest domain, or mostly a wrapper around current parcel publication details?
- Is `ops` small and sharp, or is it starting to become a catch-all home for operational concerns?
- Do `bench` and `fixtures` earn package status today, or are they closer to docs/test/reference assets?
- Are these packages stable enough to justify versioned exports inside the workspace?

## SQL and data-shape prompts

- Review whether query specs in `geo-sql` are still generic enough to be shared.
- Check whether sharing SQL builders is clarifying query intent or hiding it.
- Check whether API slices still have to know too much about SQL details even after using `geo-sql`.
- Check whether package APIs are naming domain concepts, not implementation mechanics.

## Tile and operational prompts

- Review whether tile manifest parsing, publish invariants, and rollback rules live in one obvious place.
- Check whether filesystem conventions, manifest conventions, and publish conventions are duplicated between scripts, API sync code, and frontend parcel logic.
- Check whether `ops` contains true cross-cutting policy such as request IDs, or if it is absorbing app-local code that never found an owner.

## Simplicity prompts

- Look for tiny packages whose public surface is smaller than the packaging overhead.
- Look for helpers that have only one real caller.
- Look for operational conventions expressed as string literals in more than one place.
- Look for library code that exists only because scripts and apps were not allowed to share a more focused module.

## DDD prompts

- Which concepts are domain-level enough to deserve a package?
- Which concepts are merely infrastructure details of the current migration path?
- Are we preserving stable policy and pushing volatile details outward, or doing the reverse?

## Deliverables for this pass

- a package-by-package recommendation
- a list of shared data and ops concepts that should stay centralized
- a list of concepts that should move closer to the owning runtime
- a verdict on whether `bench` and `fixtures` should remain first-class packages

## What not to do

- Do not turn SQL code into generic repository abstractions that hide intent.
- Do not centralize operational details just because multiple places currently touch them.
- Do not keep placeholder packages alive out of optimism.
