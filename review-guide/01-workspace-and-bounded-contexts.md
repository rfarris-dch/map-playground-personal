# Workspace And Bounded Contexts

## Goal

Review the top-level repo shape first. The question is whether the monorepo reflects real runtime and domain boundaries, or whether it has already started to accumulate packaging and script noise.

## Area snapshot

- 4 apps
- 10 packages
- Bun workspaces plus Turbo at the root
- explicit repo docs that already claim the main bounded contexts are `geo-serving`, `map-web`, `operator UI`, and `shared-contracts`

## Start here

- `package.json`
- `turbo.json`
- `README.md`
- `AGENTS.md`
- `tsconfig.json`
- `tsconfig.base.json`
- `apps/*/package.json`
- `packages/*/package.json`
- `apps/docs/src/content/repository/architecture.md`
- `apps/docs/src/content/repository/design-principles.md`
- `apps/docs/src/content/references/workspace-source-map.md`
- `apps/docs/src/content/getting-started/workspace-and-commands.md`

## Main questions

- Does each app have one clear runtime responsibility?
- Does each package expose one coherent seam, or are some packages just displaced app code?
- Are any packages effectively unowned because more than one bounded context changes them for unrelated reasons?
- Are there packages that exist because sharing was anticipated rather than earned?
- Are there root scripts that are orchestrators, or have some become a second application layer?
- Does the Bun workspace split reduce coupling, or does it create import and build indirection without enough payoff?
- Are the current contexts the right ones:
  - `apps/web` as map-web
  - `apps/api` as geo-serving
  - `apps/pipeline-monitor` as operator UI
  - `packages/contracts` as shared-contracts
- Are any areas trying to become a hidden monolith again through cross-package helpers and root-level scripts?

## Bun and Turbo review prompts

- Verify that workspace dependencies exist only where source imports actually justify them.
- Check whether any package should be app-local instead of workspace-shared.
- Check whether any workspace package should be merged because its public API is too small to justify package overhead.
- Check whether script names and build conventions are consistent enough to be guessed.
- Check whether Turbo is orchestrating clean package boundaries, or simply papering over an overly chatty graph.
- Check whether any package exports are broader than the real stable surface.

## Simplicity prompts

- Look for packages with no meaningful live consumers and ask whether they should stay packages.
- Look for multiple scripts that do the same operational job with slightly different argument shapes.
- Look for root-level commands that encode app-specific assumptions and could move closer to the owning app.
- Look for boundary names that do not match how the team actually talks about the system.
- Look for contexts that are too broad and contexts that are too granular.

## DDD and bounded-context prompts

- Which folders would the same stakeholder ask to change together?
- Which folders change for map rendering concerns, which for transport concerns, and which for operator concerns?
- Does any package force one context to learn another context's implementation language?
- Does the package graph encourage declarative domain naming, or does it pull reviewers back into REST-first or file-first thinking?

## Deliverables for this pass

- a current boundary map in one paragraph
- a list of packages to keep as-is
- a list of packages to merge, demote, or delete
- a list of root scripts to consolidate or relocate
- the top 3 places where workspace structure is adding accidental complexity

## What not to do

- Do not recommend flattening the entire repo into a single app just because it is easier to navigate.
- Do not recommend a package-per-concept architecture.
- Do not treat every small package as automatically bad. Small packages are acceptable when they protect a real seam.
