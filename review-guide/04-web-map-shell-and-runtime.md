# Web Map Shell And Runtime

## Goal

Review the composition root of the web app. This is the highest-risk area for accidental complexity because it coordinates map lifecycle, overlays, selection, visibility, basemap rules, URL state, and feature mounting.

## Area snapshot

- `features/app`: about 84 files and ~7100 lines
- `features/basemap`: about 4 files and ~1100 lines
- `features/layers`: about 3 files and ~260 lines
- `features/navigation`: about 2 files and ~150 lines

## Start here

- `apps/web/src/main.ts`
- `apps/web/src/app.vue`
- `apps/web/src/app-router.ts`
- `apps/web/src/pages/map-page.vue`
- `apps/web/src/features/app`
- `apps/web/src/features/basemap`
- `apps/web/src/features/layers`
- `apps/web/src/features/navigation`
- `apps/docs/src/content/applications/web-runtime.md`
- `apps/docs/src/content/applications/web-feature-domains.md`
- `apps/docs/src/content/applications/web-map-shell-domains.md`

## Main questions

- Is `features/app` still a composition root, or has it become a god module?
- Are the `use-*` composables dividing work by actual change pressure, or by incidental implementation steps?
- Is state minimal and derived where possible, or is the shell accumulating parallel state models?
- Does the shell orchestrate domain features, or does it own domain logic that should live elsewhere?
- Are map lifecycle, URL state, overlays, selection, and measure concerns separated cleanly enough to read independently?
- Does the current file split reduce complexity, or does it create choreography overhead across too many tiny files?

## Vue-specific prompts

- Keep route views thin. Confirm `map-page.vue` stays a composition surface rather than a feature dump.
- Check that stateful logic lives in composables and services, not in large template components.
- Check that components under `features/app/components` remain presentational and intent-revealing.
- Check that props and emits are explicit and that shell state is not being tunneled through too many component layers.

## Map-runtime prompts

- Check whether feature mounting and teardown are obvious from the lifecycle services.
- Check whether layer runtime, basemap policy, and feature runtime boundaries are clear.
- Check whether the app shell knows too much about individual feature internals.
- Check whether controller interfaces are coherent enough that the shell could shrink instead of continually growing.

## Simplicity prompts

- Look for duplicated state transformations across URL state, overlay state, measure state, and selection state.
- Look for services that exist only to shuttle arguments through one layer.
- Look for composables that are too coupled to one another to justify separate files.
- Look for files whose names describe framework mechanics but not business intent.
- Look for opportunities to collapse coordination code after clearer domain ownership is established.

## Legacy-context prompts

- The legacy DatacenterHawk app-site map had ArcGIS-driven workflows and many layered map concerns.
- This new shell must remain readable enough to absorb real map product behavior without becoming the new monolith.
- Simplification here should preserve the distinction between shell orchestration and feature ownership.

## Deliverables for this pass

- a shell boundary statement
- a list of coordination concerns that should stay in the shell
- a list of concerns that should move out of the shell
- the best file merges or subtree collapses to reduce orchestration sprawl
- the most suspicious places where state is duplicated or drifting

## What not to do

- Do not recommend moving all map logic into one composable.
- Do not flatten feature runtimes directly into Vue components.
- Do not keep a complex shell split just because it looks modular on paper.
