 Targeted migration surface across these packs:
  51,403 LOC

  1. API app — 12,823 LOC — RepoPrompt tab 614B547B-
     FAC4-480F-AEE9-10A0B0F71EE7
     Instruction:
     “Prepare an incremental implementation plan, not
     code changes, for migrating apps/api from
     Promise-heavy control flow to Effect.ts while
     preserving external HTTP behavior and existing
     contracts. Prioritize replacing async
     orchestration, retries, cancellation/timeouts,
     resource lifecycle management, subprocess
     handling, DB access wrappers, and route error
     plumbing. Keep pure type/model mappers mostly
     unchanged unless needed. Bias toward net LOC
     reduction by collapsing repetitive boilerplate
     into reusable Effect layers/combinators.”
  2. Scripts and ETL — 4,048 LOC — RepoPrompt tab
     7D28E8EC-926F-47BA-B510-E35056072CF3
     Instruction:
     “Produce an implementation plan, no code changes,
     for incrementally migrating this repository’s
     scripts and ETL orchestration to Effect.ts while
     preserving current CLI behavior, shell
     entrypoints, run directories, marker/status
     files, manifest contracts, and published artifact
     paths. Focus on replacing ad hoc Promise/process
     orchestration, retries, fetch/file IO, external
     command execution, long-running ETL control flow,
     and status-marker lifecycle with reusable Effect
     services. The plan should explicitly target LOC
     reduction by collapsing repeated script
     boilerplate and error handling.”
  3. Web map runtime — 15,693 LOC — RepoPrompt tab
     DA95D009-1AAC-42D8-8066-9EF9092EA69B
     Instruction:
     “Produce an implementation plan, no code changes,
     for incrementally migrating the apps/web map
     runtime to Effect.ts. Preserve map contracts,
     current routes and map-context behavior, PMTiles
     manifest loading, visibility and stress-governor
     semantics, and existing UI behavior. Prioritize
     deleting boilerplate and duplicated async/runtime
     state plumbing rather than rewriting Vue
     presentation components.”
  4. Web analysis and interaction workflows — 8,076
     LOC — RepoPrompt tab 57413CED-2BF7-4588-96A6-
     1F8260E4C09E
     Instruction:
     “Prepare an implementation plan, not code
     changes, for incrementally migrating async-heavy
     web analysis and interaction workflows to
     Effect.ts in apps/web, while preserving current
     UX, route behavior, scanner and quick-view
     density guardrails, selection and sketch
     semantics, export behavior, and integration with
     the existing app-shell runtime. Favor plans that
     delete duplicated ad hoc Promise,
     AbortController, and request-sequencing
     coordination code.”
  5. Shared runtime packages — 1,663 LOC — RepoPrompt
     tab 003D87C4-6ADB-48E0-9116-228550D560AA
     Instruction:
     “Prepare an implementation plan, not code
     changes, for incrementally migrating shared
     runtime packages to Effect.ts: packages/map-
     engine, packages/geo-tiles, packages/geo-sql, and
     packages/ops. Preserve existing public APIs
     unless the plan explicitly stages safe adapters.
     Prioritize reducing duplicated resource lifecycle
     handling, parsing/error propagation, and
     imperative wrappers across package consumers in
     apps/* and scripts/*, while avoiding churn in
     tiny pure helpers and reducing total LOC over
     time.”
  6. Shared pure definition packages — 2,462 LOC —
     RepoPrompt tab E6B2DD38-D022-4D0A-BC2D-
     FB8AB750A393
     Instruction:
     “Produce an implementation plan, not code
     changes, for Effect.ts migration decisions in the
     shared pure-definition packages: packages/
     contracts, packages/map-style, packages/map-
     layer-catalog, and packages/fixtures. Preserve
     existing public contracts, route builders, schema
     names, map-facing layer IDs, and style-layer path
     conventions. Decide what should remain plain
     TypeScript plus Zod plus static data, what only
     needs thin adapters, and what, if anything,
     should become Effect-aware. Optimize for total
     LOC reduction across the repo and explicitly
     challenge any migration step that increases code
     size without strong payoff.”
  7. Auxiliary apps — 6,638 LOC — RepoPrompt tab
     EA48AA4D-4C55-4C32-98C1-6DEDE8CF5390
     Instruction:
     “Prepare an implementation plan, no code changes,
     for incrementally migrating auxiliary Vue apps to
     Effect.ts, focused on apps/pipeline-monitor and
     apps/docs. Preserve current UI behavior. The plan
     must explicitly decide where Effect meaningfully
     reduces duplicated async and error-handling logic
     versus where it would add ceremony. Optimize for
     net LOC reduction; it is acceptable to keep parts
     in plain Vue and TypeScript when that is smaller
     and clearer.”

  Notes:

  - These are the high-value conversion slices. I did
    not make separate packs for tiny leaf modules like
    markets, providers, navigation, or other trivial/
    presentational files because they should either
    stay plain TS/Vue or be absorbed by the adjacent
    pack.
  - If you want, I can next dump the full raw
    RepoPrompt “Final Prompt” text for any one of
    these tabs verbatim so you can paste it directly
    into the other model.