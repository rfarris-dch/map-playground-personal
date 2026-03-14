# Systematic Codebase Review Prompts

## Overview

14 review prompts covering DDD, SOLID, DRY, and best practices for the map-platform monorepo. Use each prompt with the listed context files in a repo context builder, then paste into GPT 5 Pro for recommendations.

## Suggested Execution Order

| Phase | Prompts | Focus |
|-------|---------|-------|
| **Architecture** | 1, 11, 5 | DDD, package boundaries, Effect patterns |
| **Backend** | 2, 7, 10 | SOLID, queries, error handling |
| **Frontend** | 3, 6, 8 | DRY, components, map integration |
| **Hygiene** | 4, 9, 12 | Type safety, dead code, tests |
| **Ops & Security** | 13, 14 | Pipeline, security |

---

## 1. Domain Model & Bounded Context Review

**Context to select:** `apps/web/src/features/*/`, `apps/api/src/geo/*/`, `packages/contracts/src/`

```
Review this code for Domain-Driven Design principles. Identify:

1. **Bounded contexts**: Are feature modules (parcels, facilities, boundaries, markets, flood, etc.) properly isolated? Do any leak domain concepts into each other?
2. **Ubiquitous language**: Are domain terms consistent across services, types, components, and contracts for each feature? Flag any naming mismatches.
3. **Aggregate boundaries**: Are entities grouped correctly? Are there cases where one feature directly mutates or deeply queries another feature's data?
4. **Value objects vs entities**: Are there plain objects that should be modeled as value objects (e.g., coordinates, addresses, measurement units)?
5. **Domain events**: Are there implicit workflows that should be explicit domain events instead of imperative procedure calls?
6. **Anti-corruption layers**: Where features interact, are there proper translation layers or do they share raw internal types?

For each issue found, state the file(s), the violation, and a concrete fix.
```

---

## 2. Backend Layered Architecture & SOLID Review

**Context to select:** `apps/api/src/` (all), `packages/core-runtime/src/`

```
Review this Hono + Effect backend for SOLID principles and clean layered architecture:

1. **Single Responsibility**: Do route handlers contain business logic that should be in services? Do services contain SQL or HTTP concerns?
2. **Open/Closed**: Can new geo domains be added without modifying existing code? Are there switch statements or if-chains that grow with each new feature?
3. **Liskov Substitution**: Are there service/repo interfaces that could be substituted (e.g., for testing)? Or is everything concrete?
4. **Interface Segregation**: Do consumers depend on large service objects when they only use a subset of methods?
5. **Dependency Inversion**: Do high-level modules (routes, services) depend on low-level modules (DB, HTTP) directly, or through abstractions? How is the Effect dependency injection used — is it consistent?

Also check the route → service → repo → mapper flow for:
- Consistent layering (no layer skipping)
- Proper error propagation through Effect
- Whether mappers are pulling their weight or just passing data through

For each violation, cite the file, line range, the principle violated, and a refactoring suggestion.
```

---

## 3. Frontend Feature Module DRY & Duplication Audit

**Context to select:** `apps/web/src/features/*/`, `apps/web/src/composables/`, `apps/web/src/lib/`, `packages/map-engine/src/`

```
Audit these Vue 3 feature modules for DRY violations and code duplication:

1. **Cross-feature duplication**: Compare the service, layer, and component files across features (parcels, facilities, boundaries, flood, fiber-locator, etc.). Identify repeated patterns that should be abstracted into shared composables or utilities.
2. **Query pattern duplication**: Are Vue Query hooks (useQuery, useMutation) written with repeated boilerplate across features? Could a factory or generic wrapper reduce this?
3. **Map layer boilerplate**: Each feature has layer management code. How much is copy-pasted vs shared through map-engine? What could be extracted?
4. **Component duplication**: Are there similar UI patterns (detail panels, list views, filter controls) reimplemented per feature instead of shared?
5. **Type duplication**: Are types redefined locally when they exist in packages/contracts?

For each duplication found: list the files involved, the duplicated code pattern, estimated lines saved by deduplication, and a concrete extraction strategy.
```

---

## 4. Contracts & Type Safety Review

**Context to select:** `packages/contracts/src/`, `apps/api/src/geo/*/route.ts`, `apps/api/src/geo/*/mapper.ts`, `apps/web/src/features/*/types.ts`, `apps/web/src/features/*/service.ts`

```
Review the shared contracts package and its usage across the monorepo for type safety and consistency:

1. **Contract coverage**: Are all API endpoints covered by Zod schemas in packages/contracts? Are there any API routes in apps/api that bypass contract validation?
2. **Runtime validation**: Are contracts actually used for runtime validation at API boundaries, or just for TypeScript types? Where is validation missing?
3. **Schema duplication**: Are there Zod schemas or TypeScript types defined in apps/web or apps/api that duplicate what's in packages/contracts?
4. **Contract drift**: Are there cases where the API implementation diverges from the contract schema (extra fields, missing fields, different types)?
5. **Shared vs local types**: Are feature-specific types properly scoped? Are shared types properly in the contracts package?

For each issue: cite the files, the specific inconsistency, and whether the fix should be in contracts, the API, or the frontend.
```

---

## 5. Effect System Usage Consistency Review

**Context to select:** `packages/core-runtime/src/`, `apps/api/src/effect/`, `apps/web/src/lib/`, `apps/api/src/geo/*/service.ts`, `apps/web/src/features/*/service.ts`

```
Review the usage of the Effect library across this codebase for consistency and best practices:

1. **Error modeling**: Are errors defined as tagged unions with Effect.Tag? Are they consistent across features or ad-hoc?
2. **Service pattern**: Is the Effect service/layer pattern used consistently? Are there places using raw Effect where a proper service would be better?
3. **Runtime boundaries**: Are Effect programs properly converted at the boundaries (Vue components, Hono route handlers)? Are there dangling unhandled effects?
4. **Composition**: Are Effect pipelines composed idiomatically (pipe, flatMap, gen) or are there anti-patterns like nested runPromise calls?
5. **Redundancy**: Is Effect adding value everywhere it's used, or are there places where a simple async/await would be clearer and shorter?
6. **core-runtime package**: Is it well-designed? Does it provide the right abstractions or is it a grab-bag?

For each finding: file, the pattern, whether it's good/bad, and the recommended change.
```

---

## 6. Component Architecture & UI Pattern Review

**Context to select:** `apps/web/src/features/*/components/`, `apps/web/src/components/`, `apps/web/src/pages/`

```
Review the Vue 3 component architecture for best practices:

1. **Component size**: Flag any components over 200 lines. Should they be decomposed?
2. **Composition API usage**: Are all components using <script setup>? Any Options API remnants?
3. **Prop drilling vs provide/inject**: Are there cases of excessive prop drilling that should use provide/inject or composables?
4. **Composable extraction**: Are there components with complex reactive logic inline that should be extracted into composables?
5. **Template logic**: Are there complex expressions or business logic in templates that should be computed properties or methods?
6. **Event handling**: Is the emit pattern used consistently? Are there components that mutate parent state directly?
7. **Reka UI usage**: Is the component library used consistently or are there hand-rolled versions of components Reka already provides?

For each issue: file, line range, the problem, and the refactored approach.
```

---

## 7. API Route & Query Optimization Review

**Context to select:** `apps/api/src/geo/*/route.ts`, `apps/api/src/geo/*/repo.ts`, `apps/api/src/geo/*/service.ts`, `apps/api/src/db/`, `packages/geo-sql/src/`

```
Review the API layer for performance, query efficiency, and REST best practices:

1. **N+1 queries**: Are there routes that make multiple sequential DB calls that could be joined?
2. **Missing pagination**: Are there endpoints returning unbounded result sets?
3. **SQL injection risk**: Are there raw string interpolations in SQL queries instead of parameterized queries?
4. **Response shaping**: Are endpoints returning more data than clients need? Should any support field selection or sparse fieldsets?
5. **Caching**: Are there expensive queries that could benefit from caching headers or in-memory caching?
6. **Error responses**: Are errors returned with consistent structure and appropriate HTTP status codes?
7. **Route organization**: Are routes RESTful? Are there RPC-style endpoints that should be restructured?
8. **geo-sql package**: Is shared SQL well-parameterized and reusable, or do API modules duplicate spatial query patterns?

For each finding: the route/file, the issue, estimated impact, and the fix.
```

---

## 8. Map Engine & Geospatial Layer Review

**Context to select:** `packages/map-engine/src/`, `packages/map-layer-catalog/src/`, `packages/map-style/src/`, `apps/web/src/features/*/layer.ts`

```
Review the map engine package and how features integrate with it:

1. **Abstraction quality**: Does map-engine provide clean abstractions over MapLibre GL, or do features reach through to raw MapLibre APIs?
2. **Layer lifecycle**: Is layer add/remove/update handled consistently? Are there memory leaks from layers not being cleaned up?
3. **Tile management**: Is PMTiles/vector tile handling centralized or scattered across features?
4. **Style management**: How does map-style interact with map-engine? Is there duplication?
5. **Event handling**: Are map events (click, hover, etc.) managed centrally or does each feature add its own listeners?
6. **Layer catalog**: Is map-layer-catalog the single source of truth for layer definitions? Do features bypass it?
7. **Performance**: Are there unnecessary re-renders or style recalculations? Are layers properly using source sharing?

For each finding: files involved, the architectural issue, and the recommended improvement.
```

---

## 9. Dead Code, Unused Exports & File Bloat Audit

**Context to select:** `apps/web/src/lib/`, `apps/web/src/composables/`, `packages/*/src/`, `scripts/`, root and app-level `package.json` files

```
Audit this codebase for dead code and unnecessary bloat:

1. **Unused exports**: Identify exported functions, types, or constants that are never imported elsewhere in the monorepo.
2. **Unused files**: Are there entire files that are no longer imported or referenced?
3. **Unused dependencies**: Check package.json files for dependencies not imported in source code.
4. **Commented-out code**: Flag significant blocks of commented-out code that should be deleted (it's in git history).
5. **Deprecated patterns**: Are there old implementations kept alongside new ones?
6. **Oversized utility files**: Are there utility/helper files that have grown into dumping grounds?
7. **Script bloat**: In the scripts/ directory, are there scripts that are no longer used or that duplicate each other?

For each item: the file/export, evidence it's unused, and whether to delete or archive.
```

---

## 10. Error Handling & Resilience Review

**Context to select:** `apps/api/src/effect/`, `apps/api/src/http/`, `apps/api/src/geo/*/route.ts`, `apps/web/src/features/*/service.ts`, `apps/web/src/lib/`

```
Review error handling patterns across the full stack:

1. **Unhandled promise rejections**: Are there async calls without catch/error handling?
2. **Effect error channels**: Are Effect error types properly typed and narrowed, or are there broad "unknown" error types?
3. **User-facing errors**: Does the frontend gracefully handle API failures with user-friendly messages, or do errors silently fail or show raw messages?
4. **Retry logic**: Are transient failures (network, DB connection) retried appropriately?
5. **Validation errors**: Are Zod parse errors at API boundaries caught and returned as 400s with useful messages?
6. **Map errors**: Are tile loading failures, WebGL context losses, and geospatial calculation errors handled?
7. **Boundary consistency**: Is error handling consistent between features, or does each feature handle errors differently?

For each gap: file, the unhandled scenario, severity (data loss / bad UX / silent failure), and the fix.
```

---

## 11. Monorepo Package Boundaries & Dependency Review

**Context to select:** All `package.json` files, all `tsconfig.json` files, `turbo.json`, `biome.json`, all `packages/*/src/index.ts`

```
Review the monorepo package architecture for proper boundaries and dependency hygiene:

1. **Circular dependencies**: Are there circular imports between packages, or between packages and apps?
2. **Package cohesion**: Does each package have a clear, single purpose? Are there packages that try to do too much?
3. **Unnecessary packages**: Are there packages that are so thin they should be merged into another?
4. **App-to-package boundaries**: Do apps import from package internals (deep imports) instead of public APIs?
5. **Package public APIs**: Does each package have a clean index.ts that exports only what consumers need?
6. **Build order**: Is turbo.json correctly configured for the dependency graph? Are there missing or unnecessary task dependencies?
7. **Shared vs duplicated config**: Are TypeScript, Biome, and Tailwind configs properly shared or duplicated across workspaces?

For each issue: the packages involved, the boundary violation, and the fix.
```

---

## 12. Testing Strategy & Coverage Gaps

**Context to select:** All `*.test.ts` and `*.spec.ts` files, `packages/fixtures/`, test config files, `apps/api/src/geo/*/`, `apps/web/src/features/*/`

```
Review the testing strategy for gaps and improvement opportunities:

1. **Test coverage distribution**: Which features/packages have tests and which don't? Where are the biggest gaps?
2. **Test types**: Is there an appropriate mix of unit, integration, and e2e tests? Or is it all one type?
3. **Test quality**: Are tests testing behavior or implementation details? Are there brittle tests coupled to internals?
4. **API testing**: Are API routes tested with realistic request/response cycles?
5. **Geospatial testing**: Are spatial queries and map interactions tested? How?
6. **Contract testing**: Are the Zod contracts tested for round-trip serialization?
7. **Test utilities**: Is there shared test infrastructure in packages/fixtures, or does each app reinvent helpers?
8. **Missing critical paths**: Given the domain (geospatial data, tile serving, spatial analysis), what are the highest-risk untested paths?

For each gap: what should be tested, the risk of not testing it, and a suggested test approach.
```

---

## 13. Data Pipeline & Scripts Review

**Context to select:** `scripts/`, `apps/dagster/`, `tools/`, `data/`

```
Review the data pipeline (Dagster) and build scripts for quality and maintainability:

1. **Script duplication**: Are there shell scripts in scripts/ that share significant logic and should be consolidated?
2. **Error handling in scripts**: Do shell scripts use set -e, handle failures, and provide useful error messages?
3. **Hardcoded values**: Are there hardcoded paths, URLs, credentials, or environment-specific values that should be configurable?
4. **Dagster asset organization**: Are Dagster assets and jobs well-organized with clear dependencies?
5. **Pipeline idempotency**: Can pipeline steps be safely re-run without side effects?
6. **Documentation**: Are complex data transformation steps documented?
7. **Script/pipeline overlap**: Is there logic in shell scripts that duplicates what Dagster should orchestrate?

For each issue: file, the problem, and the improvement.
```

---

## 14. Security & Configuration Review

**Context to select:** `apps/api/src/config/`, `apps/api/src/http/`, `apps/api/src/app.ts`, `.env.example` files, `apps/web/src/lib/api*`, `apps/api/src/geo/*/repo.ts`

```
Review the codebase for security best practices and configuration hygiene:

1. **Secret management**: Are there any hardcoded secrets, API keys, or credentials in source code?
2. **Input validation**: Are all user inputs (query params, path params, request bodies) validated before use?
3. **SQL injection**: Are all database queries parameterized? Any string concatenation in SQL?
4. **CORS configuration**: Is CORS properly restricted or wide open?
5. **Authentication/Authorization**: How are API endpoints protected? Are there unprotected endpoints that should be?
6. **Environment variables**: Are all env vars validated at startup? Are there missing .env.example files?
7. **Dependency vulnerabilities**: Are there known vulnerable dependencies?
8. **XSS in frontend**: Are there any v-html usages or other XSS vectors?

For each finding: file, severity (critical/high/medium/low), and the remediation.
```
