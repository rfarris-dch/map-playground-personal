## Section 1: Final Technical Recommendation

### 1.1 One best stack recommendation

**Primary map runtime choice: MapLibre-first (MapLibre GL JS 5.19.x) because it matches your current migration foundation, supports the required GL JS feature set (feature-state, custom layers, vector+raster), and keeps the critical “data services” surface under your control without turning MapLibre tokens into an availability dependency.** ([GitHub][1])

**Target stack (implementation-grade)**

**Frontend**

* **Vue 3 + Tailwind** (fixed).
* **Map engine:** `maplibre-gl@5.19.x` pinned (current latest shown is **v5.19.0, Feb 23 2026**) with a thin adapter layer so engine swapping is a *compile-time* exercise, not a rewrite. ([GitHub][1])
* **Parcel + heavy overlays delivery:** **vector tiles via PMTiles** (HTTP Range + CDN), mounted through MapLibre **custom protocol** (`addProtocol`) and an explicit “parcel stress governor” (see Section 6). ([GitHub][2])
* **3D/model overlays:** MapLibre **CustomLayerInterface** for three.js model overlays + **fill-extrusion** for footprint extrusions; 3D is **zoom-gated** and contract-tested. ([MapLibre][3])

**Backend**

* **API runtime:** keep **Hono** (already in `apps/api`), keep **Effect** composition, but formalize endpoint classes (interactive-query / feature-collection / county-state-country-aggregation / proximity-enrichment / tile-serving / static-export / diagnostics) into code boundaries and budget tags.
* **Contract stack:** **Zod** for transport boundary validation + shared schemas in `packages/contracts` (frontend + backend) and Hono OpenAPI wiring where it reduces drift (see Section 4). (Rationale: Hono has first-class Zod/OpenAPI patterns; use Effect for orchestration, not as your schema system unless you already have it everywhere.) ([hono.dev][4])

**Canonical data platform (map-facing)**

* **Mandatory baseline:** full-copy **MySQL → PostgreSQL** (schema + data) *first*, into a `legacy` schema, before any serving redesign. (Verification playbook in Section 5.)
* **Operational DB:** **PostgreSQL + PostGIS** (PostGIS required; keep your `geom`/`geom_3857`/`geog` dual-representation pattern).
* **Serving architecture:** move from “two tables problem” to **canonical serving tables/materializations** in a dedicated `serve` schema; all map endpoints read *only* from `serve.*` and `analytics.*` (never from mixed raw tables).
* **Tile architecture: “mixed mode” with a hard rule:**

  * **Parcels + static infrastructure**: **pregenerated vector tiles** → **PMTiles** on object storage + CDN. ([GitHub][2])
  * **Boundaries**: GeoJSON endpoints (multi-LOD simplifications) + long-lived caching; optional vector tile boundaries only if you need label density control at low zoom.
  * **Facilities/hyperscale/enterprise**: feature-collection endpoints (viewport-bounded) **plus** optional “MVT tiles for draw” if you outgrow API delivery (but don’t start there unless you need it).
  * **Environmental rasters**: keep as raster tile proxy endpoints with SWR caching and explicit degraded-mode metadata.

**Tile build + serving**

* **Tile build:** deterministic tile pipeline jobs (in monorepo) that output **PMTiles** archives. PMTiles is explicitly designed as a **single-file tile archive** with a header+directories+tile data; the spec requires the root directory to be in the first **16 KiB** to allow latency-optimized clients. ([GitHub][2])
* **Tile serving:** CDN with Range request support; optional origin service for auth-gated tiles.

**Search**

* Use PostgreSQL-native search for navigation intent:

  * `pg_trgm` for fuzzy similarity and `unaccent` for normalization. ([PostgreSQL][5])
  * A materialized `search.search_index` table keyed by canonical IDs and normalized names (market/county/state/facility/provider) with deterministic ranking.

**Observability**

* “Budget-as-code” stays: endpoint class budgets + explain-plan guardrails + frontend runtime budgets.
* Add correlation IDs from UI → API → DB logs.

---

### 1.2 One alternative stack recommendation

**Alternative: MapLibre-first managed stack (MapLibre GL JS 3.19.x + MapLibre tilesets + MapLibre export services)**

* **Runtime:** MapLibre GL JS **v3.19.0 (Feb 25 2026)**. ([GitHub][6])
* **Pros for your workload:** best-in-class managed basemap/terrain/3D ecosystem; first-party static image/export APIs; mature debugging/inspector tooling; and new GL JS features land there first. (Example: MapLibre’s 3D buildings tutorial uses fill-extrusion over MapLibre Streets building layer; and MapLibre provides custom 3D model workflows via custom layers.) ([MapLibre][7])
* **Cons for your workload:** it converts your uptime into a token/service dependency, and pushes you toward MapLibre-hosted tilesets if you want the full convenience story. This is a strategic risk for **parcel-scale** and “many overlays” because vendor service coupling becomes the hardest-to-debug failure mode.

This alternative is viable if your org’s operational posture strongly prefers “managed map services” over “controlled data services”, and you accept the dependency surface as a product constraint.

---

### 1.3 Plain-language rationale for why the primary recommendation wins technically

Your rebuild’s hardest problems are **(a) parcels at tens of millions+**, **(b) county-first analytics with trustable aggregates**, and **(c) operating dozens of layers without regressions**.

MapLibre vs MapLibre is not the core bottleneck; **your map correctness and performance will be dominated by your geodata serving architecture**. The MapLibre-first recommendation wins because:

* It aligns with your migration repo reality (already MapLibre-integrated) and avoids engine churn.
* It lets you standardize on **PMTiles for parcels and other heavy/static datasets**, which is the single strongest lever for parcel-scale responsiveness (tile caching + bounded requests). ([GitHub][2])
* It reduces vendor coupling while still allowing optional MapLibre basemaps when a token exists (your existing “token/fallback mode” pattern remains valid).
* It forces the rebuild to resolve the **two tables problem** via canonical serving layers instead of “papering over” inconsistencies with map-time joins.

---

### 1.4 Forced Decision Output Format (no ambiguity)

1. **“Primary map runtime choice: MapLibre GL JS 5.19.x because it satisfies required GL JS behaviors (feature-state, custom layers, vector+raster), matches current repo integration, and keeps data-service control in-house.”** ([GitHub][1])
2. **“Primary parcel serving choice: hybrid tile-first draw + API detail because vector tiles are the only sustainable draw strategy at tens of millions of polygons, while detail/enrichment stays bounded and auditable.”** ([GitHub][2])
3. **“Primary county aggregation serving choice: precomputed materialized rollups keyed by county FIPS because it guarantees cacheability, formula versioning, and coherence with map-facing features.”**
4. **“Primary canonical map-serving schema strategy: raw→normalized→serve→analytics layered schemas because it prevents the ‘two tables’ inconsistency from leaking into map APIs and enables publish-gated quality checks.”**
5. **“Primary monorepo orchestration choice: Turbo because it’s already in place, supports task-graph + caching, and avoids introducing Nx-level workspace semantics churn under a Bun-first policy.”** ([Turborepo][8])
6. **“Primary contract validation stack: Zod schemas shared across frontend/backend because it enforces stable payload shapes at runtime and integrates directly with Hono validation + OpenAPI generation.”** ([hono.dev][4])
7. **“Primary performance guardrail stack: budget-as-code (endpoint class budgets + payload caps) + explain-plan CI gates + deterministic benchmarks because it’s enforceable pre-deploy and scales with your existing governance culture.”**
8. **“Primary risk-control mechanism for source inconsistency: canonical serving tables with explicit conflict rules + lineage fields because it makes aggregates explainable and prevents cross-surface parity drift.”**

---

### 1.5 Implementation-Ready Starter Blueprint (required format)

#### 73.1 Runtime blueprint block

1. **Chosen map runtime:** `maplibre-gl@5.19.x` pinned (upgrade from 4.7.1 → 5.19.x after validation). ([GitHub][1])
2. **Runtime adapter interface shape (TypeScript, owned by `packages/map-engine`):**

   * `createMap(container, options): IMap`
   * `IMap.addSource(id, spec)`, `IMap.addLayer(layerSpec, beforeId?)`
   * `IMap.setFeatureState({source, sourceLayer?, id}, state)`
   * `IMap.queryRenderedFeatures(point|bbox, options)`
   * `IMap.on(event, handler)`, `IMap.off(...)`
   * `IMap.getStyle()/setStyle(styleJson)`
   * `IMap.setProjection()/setTerrain()` (optional gate)
   * `IMap.destroy()`
3. **Layer source registry pattern:**

   * `LayerCatalog` is the single source of truth:
     `layerId → { group, sourceId, sourceType, zoomMin/Max, defaultVisible, dependencies[], budgetWeight, styleHooks }`
   * `SourceRegistry` declares all sources with a deterministic load order:

     1. basemap, 2) county/state/country boundaries, 3) facilities/hyperscale/enterprise, 4) infrastructure, 5) environmental, 6) parcels, 7) 3D/model.
4. **Layer lifecycle order policy:**

   * `registerSources()` runs once on style load.
   * `registerLayers()` runs in a stable topological order derived from catalog dependencies.
   * `applyVisibility()` runs after registration and on filter toggles.
   * Any layer toggled on must pass `BudgetCheck` (visible layer count + tile source fanout + predicted tile request rate).
5. **Feature-state management policy:**

   * Hover/selection uses `feature-state` only.
   * State is keyed by **stable canonical IDs**; on source refresh, stale feature-state is cleared for the affected source.
   * Hover never survives a viewport query refresh; selection may survive if the canonical ID is still present.
   * (MapLibre has canonical “hover effect” examples built on feature-state.) ([MapLibre][9])
6. **Fallback mode policy:**

   * `sourceMode` is explicit per layer (e.g., `pmtiles`, `postgis`, `arcgis-proxy`, `external-xyz`) and surfaced in diagnostics and `meta.sourceMode` of API responses.
   * No silent fallback; any fallback flips a `meta.warnings[]` entry and emits a runtime diagnostic event.

#### 73.2 API blueprint block

1. **Endpoint-class taxonomy:**

   * interactive-query, feature-collection, county-state-country-aggregation, proximity-enrichment, tile-serving, static-export, diagnostics
2. **Route-to-service mapping principles:**

   * Route handler: parse/validate (Zod) → domain request type
   * Domain service: apply policies (limits, semantics, conflict rules)
   * Repository: parameterized SQL only
   * Mapper: DB rows → contract payload
3. **Response envelope standards (map endpoints):**

   * GeoJSON FeatureCollections use `meta` object (see templates in prompt), always includes:

     * `sourceMode`, `dataVersion`, `generatedAt`, `recordCount`, `truncated`, `warnings[]`, plus `ingestionRunId` when relevant.
4. **Error envelope standards:**

   * `{ error: { code, message, retryable, details? }, meta: { requestId, sourceMode } }`
5. **Cache policy standards:**

   * boundaries: `public, max-age=86400, stale-while-revalidate=604800`
   * metrics: `public, max-age=300..3600` depending on refresh cadence + include `dataVersion`
   * interactive-query: `private, max-age=0` (or very short) + server-side cache
   * tiles: `public, max-age=31536000, immutable` for versioned PMTiles
6. **Performance budget standards:**

   * budgets are attached by endpoint class (Section 6) and emitted as metrics tags.

#### 73.3 Data model blueprint block

1. **Raw ingest tables:** `raw.*` capture source rows + source metadata (source_name, source_version_date, source_row_hash, ingest_run_id, ingested_at).
2. **Normalization tables/views:** `norm.*` apply:

   * canonical IDs/slugs, status enum normalization, unit normalization, FIPS normalization, geometry validity repair.
3. **Canonical serving tables:** `serve.*` are the *only* read path for map APIs.

   * `serve.facility_site`, `serve.hyperscale_site`, `serve.enterprise_site`
   * `serve.county_geom_{lod}`, `serve.state_geom_{lod}`, `serve.country_geom_{lod}`
4. **Derived aggregate tables:** `analytics.*`

   * `analytics.county_metrics_v{n}`, `analytics.county_scores_v{n}`, `analytics.state_metrics_v{n}`, `analytics.country_metrics_v{n}`
5. **Key index groups:**

   * spatial: GiST on `geom_3857` for bbox; GiST on `geog` for distance (when needed)
   * joins: btree on canonical IDs and normalized FIPS/state keys
   * search: GIN trigram on normalized text fields
6. **Quality gate checkpoints:**

   * geometry validity, key completeness, semantic consistency, duplicate ID detection, null drift checks
   * publish gate blocks promotion of `serve`/`analytics` data version if thresholds fail.

#### 73.4 Parcel blueprint block

1. **Chosen draw strategy:** **vector tiles (PMTiles)** for parcel polygons; no GeoJSON bulk parcel draw.
2. **Chosen detail strategy:** `/api/geo/parcels/:parcelId` (bounded) + `/api/geo/parcels/enrich` (bounded nearest-N).
3. **Visibility gates:**

   * min zoom: 13 (default)
   * max viewport span: hard cap in meters at current zoom (reject with actionable error)
   * max tiles in view: soft warning then hard disable if exceeded (Section 6 numbers)
4. **Query limits:**

   * draw: tiles only (bounded by tile count)
   * detail: 1 parcel ID; enrichment: max N=20 per category + radius cap
5. **Simplification strategy:**

   * server-side simplification baked into tile pyramid
   * separate zoom tiers for geometry complexity; never simplify client-side for parcels
6. **Cancellation and memory strategy:**

   * abort tile fetches and detail API requests on viewport changes (AbortController)
   * hard cap on selected-parcel geometry retained in memory
7. **Fallback strategy:**

   * if PMTiles unavailable: disable parcel layer + show diagnostics + optional ArcGIS proxy fallback for *small* bbox only (explicit mode flip).

#### 73.5 County blueprint block

1. **County key policy:** FIPS is canonical; left-pad + validate; `county_fips` is the join key across boundaries, facilities, parcels, and aggregates.
2. **Metric computation policy:** materialize `analytics.county_metrics_vN` from `serve.*` sources only; never aggregate directly from `legacy` or `raw`.
3. **Confidence and provenance policy:** every county record includes:

   * `computedAt`, `inputDataVersion`, `formulaVersion`, and per-pillar confidence tiers
4. **Choropleth interaction policy:**

   * geometry endpoint returns stable feature IDs matching FIPS
   * metrics endpoint returns values + bin thresholds; frontend sets feature-state for hover/select
5. **County-to-parcel transition policy:**

   * selecting county sets parcel mode constraints: only parcels within selected county are interactive; detail queries validate county match.

#### 73.6 Verification blueprint block

1. **MySQL → PostgreSQL parity test suites:** row counts, checksums/samples, null-rate, domain parity, FK parity, business query parity.
2. **API contract test suites:** response validation against shared schemas; payload cap and truncation behavior tests.
3. **Explain-plan guardrail suites:** endpoint-tagged plan budgets in CI; block merges on plan regressions.
4. **Runtime benchmark suites:** deterministic interaction scripts + dataset tiers A–D; pass/fail thresholds.
5. **Visual/interaction regression suites:** Playwright + fixed map seeds + screenshot diffs + interaction traces.

---

## Section 2: Map Engine Verdict (MapLibre vs MapLibre vs Hybrid)

### 2.1 Runtime engine tradeoff table (required)

| Capability                                                       | Strength in this project                                                                                               | Weakness in this project                                                                                                                                                    | Mitigation                                                                                | Final stance                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------- |
| GL JS core rendering (vector+raster, symbol layers, expressions) | MapLibre is fully capable for your layer mix and already integrated. ([MapLibre][10])                                  | MapLibre tends to land newest style features first (e.g., new style properties in 3.19.0). ([GitHub][6])                                                                      | Pin MapLibre and backport only what’s needed; avoid relying on MapLibre-only style types.   | **MapLibre-first**              |
| Feature-state hover/select                                       | MapLibre examples explicitly use feature-state for hover; matches your selection/hover contract needs. ([MapLibre][9]) | None unique                                                                                                                                                                 | Budget + lifecycle cleanup rules                                                          | **MapLibre-first**              |
| Custom 3D/model overlays                                         | MapLibre supports CustomLayerInterface (render into map GL context). ([MapLibre][3])                                   | MapLibre has more first-party model ecosystem + model source improvements. ([GitHub][6])                                                                                      | Use CustomLayerInterface + three.js; define strict zoom gates and fallback                | **MapLibre-first (with tests)** |
| 3D buildings via fill-extrusion                                  | MapLibre supports fill-extrusion layers; globe+fill-extrusion is demonstrated. ([MapLibre][10])                        | MapLibre 3D building tutorial uses MapLibre Streets and notes “classic styles no longer maintained,” so building footprint sourcing and style governance differs. ([MapLibre][7]) | Own footprint source for “model overlays”; don’t depend on MapLibre classic building layers | **MapLibre-first**              |
| Token dependency                                                 | MapLibre can operate without vendor tokens (your current fallback pattern).                                            | MapLibre-first makes token and service availability a hard dependency.                                                                                                        | Keep optional MapLibre basemap mode only                                                    | **MapLibre-first**              |
| Operational debugging of vendor styles                           | MapLibre ecosystem strong                                                                                                | MapLibre relies on OSS tooling                                                                                                                                              | Vendor-neutral style lint + deterministic artifact pipeline (Section 8)                   | **Neutral**                     |
| Static export                                                    | MapLibre has first-party Static APIs; MapLibre requires SSR/headless or custom renderer                                  | Self-hosted screenshot pipeline (Playwright) or keep MapLibre static export as optional provider                                                                              | **Hybrid for export only**                                                                |                                 |

### 2.2 Explicit 3D buildings verdict with measurable acceptance criteria

**Define “equivalent 3D” for this product (measurable, not marketing):**

1. **Footprint alignment tolerance:** extruded footprint centroid must be within **≤ 2.5 m** of the corresponding 2D footprint centroid in the same tileset at zoom ≥ 16 for sampled test areas (to prevent “floating buildings” mistrust).
2. **Activation zoom:** 3D extrusions/models are **OFF by default** and may only enable at **zoom ≥ 14** (models) / **zoom ≥ 15** (extrusions) with explicit “3D mode enabled” diagnostics.
3. **Frame-time budget:** With (a) facilities + hyperscale + county choropleth + one infrastructure line layer enabled, enabling 3D must keep:

   * **p95 frame time ≤ 20 ms** on a “baseline dev laptop” and
   * **p95 frame time ≤ 33 ms** on a “mid-tier device profile” (bench harness defines hardware classes).
4. **Fallback behavior:** If footprints missing/low quality in a tile:

   * show a **2D symbol** (facility marker) or a **low-poly proxy** (billboard) rather than a broken extrusion.
   * diagnostics must record `3dFallbackReason` in runtime telemetry.

**Can MapLibre deliver this?**
Yes—because the core needs are (a) fill-extrusion and (b) custom layers for models. MapLibre GL JS supports both fill-extrusion styling and custom layers (direct rendering into GL context). ([MapLibre][10])

**3D workflow recommendation (buildable)**

* **Two 3D modes (do not overload one):**

  1. **Extrusion mode**: `fill-extrusion` layer over building footprints (source owned by you or a known basemap source).
  2. **Model mode**: custom layer (three.js) for facility/substation models; only for *selected* entities or within a small radius of selection.
* **3D join strategy:**

  * Store a `serve.footprint` table keyed by `footprint_id`.
  * Store `serve.facility_site.footprint_id` (nullable).
  * At render time:

    * extrusion uses footprint tiles;
    * models use facility point + optional footprint for orientation.
* **Export strategy:** do not promise “3D export” unless validated; export defaults to 2D unless the static renderer stack can reproduce 3D deterministically.

### 2.3 Final choice and non-generic justification

**Final map engine choice: MapLibre-first, hybrid only for optional basemap + (optionally) static export.**

Non-generic justification tied to your dossier:

* You already have MapLibre integration and a token/fallback basemap model; MapLibre-first minimizes churn and preserves your current operational flexibility.
* Your real scale pain is parcels; MapLibre + PMTiles addresses parcel draw at extreme scale with bounded requests and aggressive caching, which is *orthogonal* to MapLibre vs MapLibre. ([GitHub][2])
* You have a performance-governance culture (budgets, explain guards). A vendor-managed stack can hide performance regressions behind opaque layers; a controlled tile + PostGIS approach makes regressions measurable in CI.

---

### 2.4 Mandatory deep-dive analysis 25.1: Map engine architecture under dense operational load

**Style-spec compatibility realities**

* MapLibre GL JS targets the MapLibre Style Spec v8 family and renders vector tiles in the browser. ([MapLibre][10])
* MapLibre’s style spec reference now includes additional layer types (e.g., `building`, `model`, `slot`, etc.). ([MapLibre][11])
  **Implication:** If you want portability, you must treat the style spec as “**v8 subset + explicitly supported extensions**.” Any MapLibre-only layer types are allowed only behind a vendor-gated style build (export-only mode).

**Mixed vector+raster workloads**

* Both engines handle mixed vector+raster sources; your main risk is not engine capability but tile source fanout and raster cache behavior.
  **Architectural decision:** unify all raster overlays behind `/api/tiles/*` proxies with consistent cache semantics and explicit degraded-mode metadata.

**Symbol placement stability under density**

* The collision system is ultimately style-driven. Your current approach (facilities > markets > infrastructure) is correct as a policy; you must formalize it as a **label hierarchy contract**:

  * Facility labels: `text-allow-overlap=false`, high `symbol-sort-key`
  * Market labels: medium priority, suppressed at mid zoom when facilities are dense
  * Infrastructure labels: low priority, zoom-gated and suppressed when parcels active
* **Determinism risk:** insertion order drift. Solution: style build step enforces layer ordering invariants (Section 8).

**Feature-state usage**

* You already rely on feature-state workflows; MapLibre supports feature-state hover interactions. ([MapLibre][9])
  **Policy:** feature-state is the only allowed approach for hover/selection styling (no “temporary layers” hack), and it must be lifecycle-managed to avoid “hover ghosts” on refresh.

**Event lifecycle correctness under layer toggling**

* Your map module is already state-machine-ish. Keep that: every async operation (tile load, API fetch, style mutation) must be cancellable and scoped to the current map revision (monotonic `mapRevision` integer).

**Custom source protocols**

* MapLibre supports plugins/protocols (e.g., using `addProtocol`), enabling PMTiles client-side range requests with an explicit protocol handler. ([GitHub][12])
  This is the architectural unlock for parcel scale.

---

### 2.5 Mandatory deep-dive analysis 25.2: 3D rendering and model overlay decision criteria

**Footprint sourcing and joining**

* **Do not** rely on MapLibre “classic building layer” semantics for your long-term 3D story; MapLibre’s own 3D building example notes classic styles are no longer maintained. ([MapLibre][7])
* Instead:

  * Ingest footprints into your DB and tile them; or
  * Use a basemap provider footprints only as a *visual hint*, but keep facility models independent.

**Missing footprint handling**

* Missing footprints is normal in rural counties. Your fallback must be: model billboard or 2D marker (never a broken extrusion).

**Performance impact**

* Extrusions cost GPU fill and overdraw. Therefore: activate only at high zoom; and suppress low-value overlays (dense infrastructure labels) when 3D active.

**Layer ordering interactions**

* Codify: `3D` below facility labels but above basemap; choropleth fills below 3D; parcel outlines above choropleth but below facility markers.

**Acceptance thresholds**

* Defined earlier; encode into benchmark harness and visual regression tests.

---

### 2.6 Mandatory deep-dive analysis 25.8: Map state architecture in Vue

Keep your existing “mature state machine” model, but enforce domain boundaries as contracts:

**Viewport domain**

* Canonical model:

  * `{ center: [lng,lat], zoom, bearing, pitch, bounds? }`
* URL sync:

  * serialize with fixed precision (lng/lat 5 decimals, zoom 2 decimals)
  * reject invalid values (NaN, out-of-range) and fall back to defaults
* Transition policy:

  * `jump` for search results
  * `ease` for filter-driven viewport changes
  * `fly` only for explicit user action

**Layer state**

* Registry-driven; layer ID is stable.
* Visibility = `userToggle && zoomGate && dependencyGate && accessGate && stressGate`.
* Each layer has `stressWeight` and `sourceCountWeight`.

**Selection/hover**

* Hover ephemeral; selection persistent.
* Selection stored as `{ layerId, featureId, canonicalId }`
* “Cleanup on refresh” rule: if `sourceRevision` changes and selected feature no longer present, selection becomes “stale” and triggers a detail lookup by canonical ID (bounded).

**Filters**

* Filter key registry (enum of allowed keys).
* Cancellation: every filter change increments `queryRevision` and cancels in-flight requests not matching it.

**Worker/off-main-thread**

* Heavy transforms (GeoJSON simplification, union, area calcs for drawings) must go to a Worker.
* Parcels never go through client-side simplification (tile pipeline handles that).

---

### 2.7 Mandatory deep-dive analysis 25.9: Style governance architecture

**Style source control**

* `packages/map-style/src/style.json` is canonical.
* `packages/map-style/src/manifests/*.json` define layer ordering invariants and label priority rules.

**CI checks**

* JSON schema validate against style spec subset.
* “Layer invariant” checks:

  * label hierarchy order
  * choropleth below facility markers
  * parcel outlines above choropleth
  * 3D layers gated to min zoom
* “Diff enforcement”:

  * any style change must generate a before/after render artifact set (Section 8).

**Vendor independence**

* Maintain two build targets:

  * `style.core.json` (MapLibre safe subset)
  * `style.export.maplibre.json` (optional MapLibre-only enhancements)

---

### 2.8 Layer Governance Worksheets (52.x) — keep/change/remove decisions

Below, “Primary source” assumes your new controlled stack; “Fallback source” can remain ArcGIS/third-party where explicitly marked.

#### 52.1 Facilities worksheet

1. **Layer family ID:** `facilities.colo`
2. **Primary source + fallback:** `/api/geo/facilities` (serve table) + none
3. **Default visibility:** ON (in facility mode), OFF in county-only mode
4. **Zoom min/max:** min 4 (clusters), point detail from 8+, labels from 10+
5. **Label/symbol policy:** facilities > markets > infrastructure; symbol-sort-key enforced
6. **Interaction policy:** hover highlight + click selects; popup uses detail endpoint
7. **Performance risk notes:** bbox query + join pressure; mitigate with serving table and reduced draw payload
8. **Data quality risks:** commissioned semantics ambiguity; must expose `commissionedSemantic`
9. **Recommended actions:** implement draw/detail split; enforce per-request cap; add truncation meta
10. **Required tests:** bbox retrieval parity; popup schema validation; cluster/point transition benchmark

#### 52.2 Hyperscale worksheet

1. **Layer family ID:** `facilities.hyperscale`
2. **Primary source + fallback:** `/api/geo/hyperscale` + none
3. **Default visibility:** ON in hyperscale mode; OFF by default in colo mode
4. **Zoom min/max:** similar to colo but separate thresholds to reduce overlap
5. **Label/symbol policy:** separate visual identity; avoid color collision with colo
6. **Interaction policy:** popup includes `leaseOrOwn`, `commissionedSemantic`
7. **Performance risk notes:** none beyond facilities
8. **Data quality risks:** commissioned semantics differ; must not share metrics blindly
9. **Recommended actions:** dedicated serving table; dedicated metric formulas
10. **Required tests:** county rollup consistency vs hyperscale overlay

#### 52.3 Enterprise worksheet

1. **Layer family ID:** `enterprise.points`
2. **Primary source + fallback:** `/api/geo/enterprise`
3. **Default visibility:** OFF
4. **Zoom min/max:** min 6; labels ≥ 12
5. **Label/symbol policy:** lowest priority symbols; no labels by default
6. **Interaction policy:** click only; hover optional
7. **Performance risk notes:** broad extent; keep payload minimal
8. **Data quality risks:** stale/provenance must be surfaced
9. **Recommended actions:** keep separate endpoint; do not merge with facilities
10. **Required tests:** enabling enterprise does not exceed tile/source budget

#### 52.4 Leased overlay worksheet

1. **Layer family ID:** `hyperscale.leasedMarkets`
2. **Primary source + fallback:** `analytics.leased_market_tiles` (vector tiles) + none
3. **Default visibility:** OFF (or gated by permission)
4. **Zoom min/max:** min 4; max 9 (aggregate only)
5. **Label/symbol policy:** aggregate polygons/centroids; explicit tooltip disclaimer
6. **Interaction policy:** hover shows aggregate; click drills to county list
7. **Performance risk notes:** none if tiled
8. **Data quality risks:** interpretation risk; must label clearly
9. **Recommended actions:** treat as *aggregate-only* data product
10. **Required tests:** access gate test; tooltip disclaimer snapshot test

#### 52.5 Power overlays worksheet

1. **Layer family ID:** `power.transmission`, `power.substations`, `power.plants`
2. **Primary source + fallback:** vector tiles (PMTiles) + optional external tiles
3. **Default visibility:** OFF
4. **Zoom min/max:** lines min 5, substations min 8, plant labels min 7
5. **Label/symbol policy:** label suppression at low zoom; disable labels when parcels active
6. **Interaction policy:** click → enrichment endpoint (nearest facilities optional)
7. **Performance risk notes:** line density can spike; tile caching mandatory
8. **Data quality risks:** status domain drift
9. **Recommended actions:** normalize status enums at ingest; include provenance
10. **Required tests:** tile schema contract; status domain regression tests

#### 52.6 Telecom overlays worksheet

1. **Layer family ID:** `telecom.ix`, `telecom.fiber`, `telecom.reach`
2. **Primary source + fallback:** vector tiles for lines; feature endpoint for reach metrics
3. **Default visibility:** OFF
4. **Zoom min/max:** fiber min 6; ix min 8; labels min 10
5. **Label/symbol policy:** strict label gating
6. **Interaction policy:** reach overlay is metric-driven; popups use enrichment endpoint
7. **Performance risk notes:** line + symbol density
8. **Data quality risks:** silent empty map due to source-layer mismatch
9. **Recommended actions:** enforce source-layer mapping tests in CI
10. **Required tests:** “no empty tiles” smoke tests for key metros

#### 52.7 Energy pipeline worksheet

1. **Layer family ID:** `energy.gas`, `energy.petroleum`
2. **Primary source + fallback:** vector tiles (PMTiles) + external fallback
3. **Default visibility:** OFF
4. **Zoom min/max:** min 6; labels min 9
5. **Label/symbol policy:** status coloring; labels heavily suppressed
6. **Interaction policy:** click shows status + provenance only (avoid false precision)
7. **Performance risk notes:** long lines; ensure simplification in tiles
8. **Data quality risks:** misleading continuity from simplification
9. **Recommended actions:** simplify with topology-aware thresholds; validate visually
10. **Required tests:** line continuity sanity checks; status enum drift tests

#### 52.8 Environmental overlays worksheet

1. **Layer family ID:** `env.flood.*`, `env.water`
2. **Primary source + fallback:** raster tiles via `/api/tiles/*` proxy; fallback to alternate provider
3. **Default visibility:** OFF
4. **Zoom min/max:** depends on overlay; default min 5
5. **Label/symbol policy:** no labels; transparency enforced
6. **Interaction policy:** disable click hit-testing on raster (or route through map event policy)
7. **Performance risk notes:** tile storms; must cache aggressively
8. **Data quality risks:** upstream outages
9. **Recommended actions:** SWR caching + explicit degraded mode messages
10. **Required tests:** upstream failure simulation tests

#### 52.9 County/State/Country boundary overlays worksheet

1. **Layer family ID:** `county.boundary`, `state.boundary`, `country.boundary`
2. **Primary source + fallback:** `/api/geo/*-boundaries` + none
3. **Default visibility:** county ON in “Market Analysis” mode
4. **Zoom min/max:** county min 3; state/country for low zoom transitions
5. **Label/symbol policy:** label density controlled by zoom; no collision surprises
6. **Interaction policy:** feature-state hover/select keyed by FIPS
7. **Performance risk notes:** geometry weight; must serve LOD simplifications
8. **Data quality risks:** key mismatch between geometry and metrics
9. **Recommended actions:** geometry+metrics key alignment tests; cache geometry heavily
10. **Required tests:** join-key parity tests; simplification correctness tests

#### 52.10 Friction overlay worksheet

1. **Layer family ID:** `analytics.friction`
2. **Primary source + fallback:** `analytics.county_scores_vN` + none
3. **Default visibility:** OFF until metric selected
4. **Zoom min/max:** county-only; no parcel mode
5. **Label/symbol policy:** discrete tiers; deterministic
6. **Interaction policy:** tooltip shows explanation factors + confidence
7. **Performance risk notes:** none if precomputed
8. **Data quality risks:** formula drift
9. **Recommended actions:** formula versioning + regression tests
10. **Required tests:** tier mapping snapshot tests

#### 52.11 Parcel worksheet

1. **Layer family ID:** `property.parcels`
2. **Primary source + fallback:** PMTiles parcels + ArcGIS proxy fallback (explicit)
3. **Default visibility:** OFF
4. **Zoom min/max:** min 13; max 22
5. **Label/symbol policy:** no labels; outline + fill controlled by stress governor
6. **Interaction policy:** click selects; detail fetched on-demand
7. **Performance risk notes:** highest risk; tile-only draw
8. **Data quality risks:** invalid geometries, duplicate IDs, county assignment
9. **Recommended actions:** hybrid strategy; strict caps; publish-gated quality checks
10. **Required tests:** parcel stress benchmarks; selection persistence tests

#### 52.12 Model overlays worksheet

1. **Layer family ID:** `models.facilities`, `models.substations`
2. **Primary source + fallback:** custom layer + billboard fallback
3. **Default visibility:** OFF
4. **Zoom min/max:** min 14; auto-disable under stress
5. **Label/symbol policy:** never block facility labels
6. **Interaction policy:** only render models near selection (bounded)
7. **Performance risk notes:** GPU + memory; must cap
8. **Data quality risks:** misalignment reduces trust
9. **Recommended actions:** acceptance criteria tests + fallback
10. **Required tests:** 3D alignment tests; frame-time regression tests

---

## Section 3: Database And Geospatial Architecture Blueprint

### 3.1 PostgreSQL/PostGIS canonical model after full-copy baseline

**High-level topology (text diagram)**

```text
(MySQL) ──full-copy──> (Postgres)
                        ├─ legacy.*        # exact copied tables (parity target)
                        ├─ raw.*           # raw ingest captures + lineage
                        ├─ norm.*          # normalized, cleaned, keyed
                        ├─ serve.*         # canonical map-serving truth (ONLY map reads)
                        ├─ analytics.*     # county/state/country rollups + scores
                        ├─ tiles.*         # tile build staging / manifests
                        └─ ops.*           # ingestion runs, quality gates, diagnostics
```

**Canonical identity policy (must be enforced)**

* **Facilities:** `facility_id` (canonical UUID/ULID) + `facility_slug` (kebab-case) + `source_ids` (JSONB map).
* **Hyperscale:** `hyperscale_id` + `facility_code` + `lease_or_own` + `source_ids`.
* **Providers/companies:** `provider_id` + normalized name + slug.
* **County:** `county_fips` (5-char string, left padded) is primary key across county/state/country geometry, serving, analytics.
* **Parcel:** `parcel_id` (canonical) + `source_parcel_id` + `county_fips` + `state_abbrev`.

**Geometry policy**

* Store **4326 geometry** (`geom`) for interchange and GeoJSON output.
* Store **3857 geometry** (`geom_3857`) for bbox clipping and tile work (avoid query-time transforms).
* Store **geography** (`geog`) for accurate distance operations (KNN, ST_DWithin) where needed.
* Enforce SRID and validity at ingest:

  * `ST_SRID(geom) = 4326`, `ST_SRID(geom_3857)=3857`
  * `ST_IsValid(geom)` must be true after repair attempts (`ST_MakeValid`), else quarantine row.

---

### 3.2 Serving schema, index strategy, partition strategy

#### 3.2.1 Serving schemas and tables (buildable blueprint)

**`serve.facility_site` (canonical for colo)**

* Keys:

  * `facility_id PK`
  * `provider_id`, `county_fips`, `state_abbrev`
* Metrics (explicit semantics):

  * `commissioned_power_mw`
  * `planned_power_mw`
  * `under_construction_power_mw`
  * `available_power_mw`
  * `commissioned_semantic ENUM('leased','operational','unknown')`
    (colo default = `leased` unless source says otherwise)
* Geometry:

  * `geom POINT(4326)`
  * `geom_3857 POINT(3857)`
  * `geog geography(Point,4326)`
* Lineage:

  * `source_system`, `source_dataset_date`, `ingest_run_id`, `transform_version`, `freshness_ts`
* Quality flags:

  * `quality_flags JSONB` (e.g., `missing_capacity_record`, `duplicate_candidate`, `county_inferred`)

**`serve.hyperscale_site`**

* Similar, but with:

  * `lease_or_own ENUM('lease','own','unknown')`
  * `commissioned_semantic` often = `operational`

**`serve.enterprise_site`**

* Minimal draw payload:

  * id, name, county_fips, state_abbrev, geom, provenance

**County/state/country geometry**

* `serve.county_geom_lod0..lod3`

  * lod0: full resolution
  * lod1: simplified for mid zoom
  * lod2: simplified for low zoom (statewide)
  * lod3: very coarse (national view)
* Each row: `county_fips`, `geom` (polygon), `bbox_3857` (precomputed), `area_sqkm`, `geom_hash`

**Parcels (serving for detail)**

* `serve.parcel` is **NOT** for draw; it is for **detail/enrichment** only.
* Partition strategy:

  * Partition by `state_abbrev` (LIST partitioning) or `state_fips` to keep partitions coarse and manageable.
  * For extreme states, sub-partition by `county_fips` only if needed.

#### 3.2.2 Index strategy (explicit GiST vs BRIN vs btree vs SP-GiST)

**Spatial**

* Use **GiST** on `geom_3857` for viewport bbox queries (fast bbox intersection).
* Use **GiST** on `geog` for distance (with `ST_DWithin` / KNN) where appropriate.

**Join/filter**

* Use **btree** on:

  * `county_fips`, `provider_id`, `state_abbrev`, `status`, `commissioned_semantic`
* Use **composite indexes** matching hot filters:

  * `(county_fips, provider_id)`
  * `(provider_id, status)`
  * `(state_abbrev, county_fips)`

**Search**

* Use `pg_trgm` similarity with **GIN** index on normalized search text (e.g., `name_norm`), plus `unaccent` for normalization. ([PostgreSQL][5])

**BRIN**

* Use **BRIN** on large append-heavy tables where access is range-based (e.g., `ingested_at` in `raw.*`), not for interactive map lookups.

**Partitioning**

* Use PostgreSQL declarative partitioning for `serve.parcel` (LIST by state) so vacuum/analyze and indexes remain tractable. ([PostgreSQL][13])

#### 3.2.3 Parcel tile build staging

* `tiles.parcel_features_z{min..max}` staging tables (optional) if you want DB-driven tile generation.
* Or tile build reads directly from `serve.parcel` partitions and writes PMTiles.

---

### 3.3 Query patterns and materialization rules (mandatory 25.6)

#### 3.3.1 Viewport clipping queries (bbox)

**Policy:** clip on `geom_3857` and never transform per-row.

Example pattern for facilities draw mode (GeoJSON):

```sql
WITH bbox AS (
  SELECT ST_Envelope(ST_Transform(ST_MakeEnvelope($1,$2,$3,$4,4326), 3857)) AS g
)
SELECT
  facility_id,
  provider_id,
  county_fips,
  commissioned_power_mw,
  planned_power_mw,
  under_construction_power_mw,
  available_power_mw,
  ST_AsGeoJSON(geom)::jsonb AS geom_json
FROM serve.facility_site f, bbox
WHERE f.geom_3857 && bbox.g
  AND ST_Intersects(f.geom_3857, bbox.g)
  AND ($5::uuid IS NULL OR provider_id = $5)
LIMIT $6;
```

#### 3.3.2 Nearest-neighbor enrichment (KNN + radius bound)

**Policy:** always bound by max radius and max N; never unbounded KNN on huge tables.

Example (nearest substations):

```sql
SELECT
  s.substation_id,
  s.name,
  ST_Distance(s.geog, $1::geography) AS dist_m
FROM serve.substation s
WHERE ST_DWithin(s.geog, $1::geography, $2)  -- radius meters
ORDER BY s.geog <-> $1::geography
LIMIT $3;
```

#### 3.3.3 Tile generation support queries (PostGIS MVT)

PostGIS provides `ST_AsMVT` and `ST_AsMVTGeom` for emitting MapLibre Vector Tiles from SQL. ([guide.cloudnativegeo.org][14])

Example on-demand tile (useful for smaller dynamic layers, not parcels):

```sql
WITH tile AS (
  SELECT ST_TileEnvelope($1, $2, $3) AS env
),
mvtgeom AS (
  SELECT
    id,
    ST_AsMVTGeom(geom_3857, tile.env, 4096, 64, true) AS geom
  FROM serve.facility_site, tile
  WHERE geom_3857 && tile.env
)
SELECT ST_AsMVT(mvtgeom, 'facilities', 4096, 'geom') FROM mvtgeom;
```

#### 3.3.4 County aggregate materialization rules

**Rule:** no map endpoint aggregates from raw tables. Aggregates are materialized from `serve.*` and versioned.

Materialization:

* `analytics.county_metrics_vN` is rebuilt on ingest success (or scheduled), with:

  * `input_data_version`, `computed_at`, `formula_version`, `dependency_run_ids[]`

---

### 3.4 County and parcel integration model (mandatory 25.4)

**County boundary source of truth**

* Store counties once as `serve.county_geom_*` with stable `county_fips`.
* Every facility/hyperscale/parcel must have `county_fips`. If missing, infer via spatial join at normalization time; mark `quality_flags.county_inferred=true`.

**Metric source fusion strategy**

* Inputs:

  * `serve.facility_site` (colo)
  * `serve.hyperscale_site`
  * infrastructure summary tables (optional)
  * policy text summaries (normalized into scored fields)
  * interconnection queue tables (normalized statuses + timelines)
* Outputs:

  * `analytics.county_metrics_vN` (raw metrics)
  * `analytics.county_scores_vN` (pillar scores + composite + explanation JSON)

**Three pillar representation**

* **Demand constraints:** e.g., fiber reach index, proximity to IX, market demand proxies
* **Generation constraints:** grid generation mix, interconnection queue pipeline health, constraints signals
* **Policy/public sentiment:** encoded as:

  * `policy_sentiment_score` (0–1)
  * `policy_risk_flags[]`
  * `policy_summary` (short text)
  * `policy_sources[]` (lineage refs)

**County-to-parcel workflow coherence**

* County selection produces:

  * `countyContext = { county_fips, metric_version, score_version, filters }`
* Parcel mode requires:

  * `activeCountyFips` set
  * parcel detail endpoints validate `parcel.county_fips == activeCountyFips` unless user explicitly overrides

---

### 3.5 Data consistency architecture to resolve the “two tables problem” (mandatory 25.5)

**Problem:** `facilities` and `capacityManagement` inconsistent → users lose trust.

**Canonical serving layer policy**

* `serve.facility_site` is the **single truth** for map-facing facility metrics.
* It is built by a deterministic resolver job:

  * Inputs: `legacy.facilities`, `legacy.capacity_management`, plus any provider override tables.
  * Output: one row per canonical facility.

**Conflict resolution rules (explicit)**

1. **Identity reconciliation**

   * If both tables share a stable facility key: join directly.
   * Else: join via normalized facility code + provider + near-equality in coordinates (within 50m) → candidate match; if multiple, quarantine.
2. **Metric precedence**

   * If `capacityManagement` present and not stale: use it for power fields.
   * If missing: use facilities fields; mark `quality_flags.missing_capacity=true`.
3. **Commissioned semantics**

   * For colo: default `commissioned_semantic='leased'`
   * For hyperscale: default `commissioned_semantic='operational'`
   * If source explicitly says otherwise, override.
4. **Null behavior**

   * Never silently treat null as zero in aggregates.
   * Aggregations must record both `sum_mw` and `coverage_ratio` (fraction of records with non-null values).
5. **Auditability**

   * Store `source_row_ids` (JSON) and `resolution_reason` in `serve.*`.

**Snapshots vs current**

* `serve.*` tables are versioned by `data_version` (logical version string), not time-travelled row-by-row.
* Historical snapshots can live in `serve_history.*` if needed, but map runtime reads only current.

---

### 3.6 Endpoint worksheets (51.1–51.20)

Below, each worksheet includes: (1) source-of-truth data path, (2) canonical response schema summary, (3) latency risk, (4) cacheability, (5) query/index strategy, (6) failure/fallback, (7) correctness tests.

#### 51.1 Facilities feature endpoint worksheet

1. **Source-of-truth path:** `serve.facility_site` (plus small join to `serve.provider_dim`)
2. **Schema:** GeoJSON FeatureCollection; draw mode uses minimal properties; popup uses detail endpoint
3. **Latency risk:** medium (bbox + filters + join)
4. **Cacheability:** low (viewport-bounded), but allow short server-side cache keyed by bbox+filters
5. **Query/index:** GiST `geom_3857`; btree `(provider_id)`, `(county_fips)`. Hard LIMIT (default 5000)
6. **Failure/fallback:** return `truncated=true` with warning if cap exceeded; never try to stream more
7. **Tests:** bbox parity tests; provider join completeness; truncation meta correctness; explain-plan budget

#### 51.2 Hyperscale feature endpoint worksheet

1. **Source-of-truth:** `serve.hyperscale_site`
2. **Schema:** GeoJSON FeatureCollection; includes `leaseOrOwn`, `commissionedSemantic`
3. **Latency risk:** medium
4. **Cacheability:** low; short server-side cache
5. **Query/index:** GiST `geom_3857`; btree `(lease_or_own)`, `(county_fips)`
6. **Failure/fallback:** if lease/own missing → `unknown` + quality flag
7. **Tests:** semantic separation tests from facilities; county rollup consistency tests

#### 51.3 Enterprise endpoint worksheet

1. **Source-of-truth:** `serve.enterprise_site`
2. **Schema:** GeoJSON FeatureCollection; minimal properties
3. **Latency risk:** low-medium (sparser)
4. **Cacheability:** low
5. **Query/index:** GiST `geom_3857`; btree `(state_abbrev)`
6. **Failure/fallback:** missing geometry → drop row at publish gate
7. **Tests:** enabling enterprise does not exceed source-count budgets; schema validation

#### 51.4 County boundaries endpoint worksheet

1. **Source-of-truth:** `serve.county_geom_lod{0..3}`
2. **Schema:** GeoJSON FeatureCollection; each feature has `countyFips` stable id; includes `lod`
3. **Latency risk:** low (cached)
4. **Cacheability:** high; long TTL + SWR
5. **Query/index:** btree on `county_fips`; optional bbox filter using `bbox_3857` + GiST
6. **Failure/fallback:** if lod table missing → fallback to next coarser LOD with warning
7. **Tests:** geometry-key alignment vs metrics keys; ST_IsValid check; payload size budgets

#### 51.5 State boundaries endpoint worksheet

1. **Source-of-truth:** `serve.state_geom_lod*`
2. **Schema:** GeoJSON FeatureCollection keyed by `state_abbrev` + `state_fips`
3. **Latency risk:** low
4. **Cacheability:** high
5. **Query/index:** btree keys; no heavy spatial ops
6. **Failure/fallback:** coarser geometry fallback
7. **Tests:** key normalization tests; bbox sanity

#### 51.6 Country boundaries endpoint worksheet

1. **Source-of-truth:** `serve.country_geom_lod*`
2. **Schema:** GeoJSON FeatureCollection keyed by `country_iso2/iso3`
3. **Latency risk:** low
4. **Cacheability:** high
5. **Query/index:** btree keys
6. **Failure/fallback:** coarse fallback
7. **Tests:** key compatibility with country metrics; missing region confidence flags

#### 51.7 County metrics endpoint worksheet

1. **Source-of-truth:** `analytics.county_metrics_vN` + `analytics.county_scores_vN`
2. **Schema:** JSON array of county records (no geometry) + `meta` includes formulaVersion + bins
3. **Latency risk:** low if precomputed
4. **Cacheability:** very high; TTL 5–60 min depending on ingestion cadence
5. **Query/index:** btree `county_fips`; precomputed bins stored in meta
6. **Failure/fallback:** if analytics stale → return last known with warning + freshness lag
7. **Tests:** rollup correctness vs serving tables; coverage ratio tests; formula regression tests

#### 51.8 State metrics endpoint worksheet

1. **Source-of-truth:** derived from `analytics.county_metrics_vN` (preferred for consistency)
2. **Schema:** JSON by state
3. **Latency risk:** low
4. **Cacheability:** high
5. **Query/index:** group-by on precomputed county table; or materialize `analytics.state_metrics_vN`
6. **Failure/fallback:** if state aggregates drift → fail publish gate
7. **Tests:** sums vs county totals; drift thresholds

#### 51.9 Country metrics endpoint worksheet

1. **Source-of-truth:** derived from `analytics.state_metrics_vN`
2. **Schema:** JSON by country
3. **Latency risk:** low
4. **Cacheability:** high
5. **Query/index:** materialized
6. **Failure/fallback:** partial coverage → confidence tier lowered
7. **Tests:** rollup consistency; sparse region confidence policy tests

#### 51.10 Search endpoint worksheet

1. **Source-of-truth:** `search.search_index` materialized from `serve.*` + county/state/country dims
2. **Schema:** array of search results with `jump` + `route` + `sourceMode`
3. **Latency risk:** high (typing concurrency)
4. **Cacheability:** low on CDN; medium via server-side cache
5. **Query/index:** trigram GIN + btree type filters; deterministic tie-break
6. **Failure/fallback:** return empty with warning if search index stale
7. **Tests:** abbreviation/full-name parity; ranking regression tests; p95 latency tests

#### 51.11 Parcel proxy endpoint worksheet

1. **Source-of-truth:** if still used: ArcGIS upstream; long-term: deprecate
2. **Schema:** GeoJSON/JSON normalized; retains guardrails
3. **Latency risk:** very high (upstream variability)
4. **Cacheability:** low
5. **Query/index:** input validation + strict caps; no internal DB
6. **Failure/fallback:** if upstream fails → disable parcel overlay; optionally fallback to PMTiles
7. **Tests:** guardrail tests (viewport cap, offset cap); upstream timeout handling tests

#### 51.12 Network reach endpoint worksheet

1. **Source-of-truth:** `analytics.network_reach_vN` derived from telecom layers + facility proximity
2. **Schema:** JSON records keyed by county_fips + explanation fields
3. **Latency risk:** low if precomputed
4. **Cacheability:** high
5. **Query/index:** btree keys; no ad-hoc spatial in request path
6. **Failure/fallback:** stale analytics warning
7. **Tests:** explainability payload completeness; drift vs previous version

#### 51.13 Friction endpoint worksheet

1. **Source-of-truth:** `analytics.county_scores_vN` (friction tiers)
2. **Schema:** tiered scores + explanation JSON
3. **Latency risk:** low
4. **Cacheability:** high
5. **Query/index:** btree keys
6. **Failure/fallback:** stale warning
7. **Tests:** tier mapping snapshot; consistency with choropleth bins

#### 51.14 Terrain suitability endpoint worksheet

1. **Source-of-truth:** raster/DEM-derived analytics tables + cached raster tiles
2. **Schema:** tile endpoints or precomputed suitability index by county/parcel
3. **Latency risk:** medium-high if computed on-demand → avoid
4. **Cacheability:** high if tiled/precomputed
5. **Query/index:** precompute; no on-demand raster math in API path
6. **Failure/fallback:** if external DEM outage → degrade with warning
7. **Tests:** tile availability tests; explain-plan guardrails for any DB queries

#### 51.15 Gas pipeline endpoint worksheet

1. **Source-of-truth:** PMTiles vector tiles built from normalized source
2. **Schema:** tile-serving; minimal attributes in tiles; detail optional
3. **Latency risk:** low (CDN)
4. **Cacheability:** very high (immutable tiles)
5. **Query/index:** tile pipeline; no DB in request path
6. **Failure/fallback:** alternate source tiles; explicit degraded mode
7. **Tests:** status domain tests; tile schema checks

#### 51.16 Telecom/petroleum endpoint worksheet

1. **Source-of-truth:** PMTiles tiles + normalized dim tables
2. **Schema:** tile-serving + optional detail endpoints
3. **Latency risk:** low
4. **Cacheability:** high
5. **Query/index:** tile pipeline; enforce source-layer mapping in style
6. **Failure/fallback:** fallback to alternate tiles
7. **Tests:** style source-layer mapping test; “not empty in key metros” test

#### 51.17 Flood/water tile endpoint worksheet

1. **Source-of-truth:** `/api/tiles/flood/*` proxy to upstream
2. **Schema:** standard XYZ tile responses
3. **Latency risk:** medium (upstream)
4. **Cacheability:** high with SWR
5. **Query/index:** cache keys by z/x/y + variant; no DB
6. **Failure/fallback:** serve stale; or switch provider; explicit warnings
7. **Tests:** outage simulation; cache hit ratio tests

#### 51.18 Static map report endpoint worksheet

1. **Source-of-truth:** deterministic “map state” payload + style version + tile versions
2. **Schema:** export request includes viewport + layers + style hash + source modes
3. **Latency risk:** medium-high (render time)
4. **Cacheability:** medium (same export state can be cached)
5. **Query/index:** minimal; avoid heavy DB in render path
6. **Failure/fallback:** if tokenized basemap fails → fallback basemap + stamp export metadata
7. **Tests:** reproducibility tests (same input → same output hash); export mode disclosure test

#### 51.19 Diagnostics endpoints worksheet

1. **Source-of-truth:** `ops.*` (ingestion runs, quality gates, version table)
2. **Schema:** machine-readable status for dependencies + freshness lag + budget status
3. **Latency risk:** low
4. **Cacheability:** low (should be fresh)
5. **Query/index:** btree on run ids + timestamps
6. **Failure/fallback:** always return partial status with explicit failures
7. **Tests:** schema validation; dependency failure classification tests

#### 51.20 County/state/country bbox lookup endpoint worksheet

1. **Source-of-truth:** `serve.*_geom_*` + precomputed bbox columns
2. **Schema:** `{ key, bbox, center, zoomHint }`
3. **Latency risk:** low
4. **Cacheability:** high
5. **Query/index:** btree lookup by key; no full geometry fetch required
6. **Failure/fallback:** 404 with typed error envelope
7. **Tests:** key normalization tests; bbox plausibility tests

---

## Section 4: Monorepo And Code Architecture

### 4.1 Chosen monorepo tool and rationale

**Primary choice: Turbo (keep it).**
You already have Turbo + Bun workspace shape. Turbo’s value here is the task graph + caching model for:

* SQL migrations + seed fixtures,
* tile build artifacts,
* benchmark artifacts,
* style validation artifacts. ([Turborepo][8])

**Alternative: Nx** has powerful task caching and “affected” workflows, but it introduces workspace semantics and configuration weight that is not justified given your “high speed + minimal churn” constraint. ([Nx][15])

### 4.2 Package boundaries and ownership boundaries (concrete)

Keep `apps/web`, `apps/api`, then add explicit geo platform packages:

**Packages**

* `packages/contracts`

  * Zod schemas for all map endpoints + shared enums (status, semantic tags, confidence tiers)
  * Generated types from schemas (TS inference) used by both web and api
* `packages/map-layer-catalog`

  * Layer manifest (groups, zoom gates, budgets, dependencies)
  * Layer ordering invariants + test helpers
* `packages/map-style`

  * canonical style JSON, style build scripts, style lint/validation, contrast checks
* `packages/geo-sql`

  * migrations, views/materializations, repository SQL strings (parameterized)
  * “explain plan guard” harness
* `packages/geo-tiles`

  * tile build scripts (parcel + infrastructure) outputting versioned PMTiles
  * tile manifest generator (tile version → URL/path mapping)
* `packages/bench`

  * deterministic benchmark harness (API perf + map UI perf)
* `packages/fixtures`

  * synthetic dataset tiers A–D (small → worst-case)
* `packages/ops`

  * diagnostics schemas, ingestion run schemas, quality gate framework

**Ownership**

* `apps/web`: map runtime, state machine, UX tools
* `apps/api`: endpoint handlers and domain services
* `packages/*`: shared contracts, data tooling, quality gates, benchmarks (owned by “map platform” group)

### 4.3 Contract and schema synchronization strategy

**Transport contracts**

* Zod schema per endpoint response (FeatureCollection + meta or JSON + meta).
* Backend validates on output in tests (not in production hot path) to avoid runtime overhead.
* Frontend consumes typed client based on schemas.

**SQL ↔ TS synchronization**

* Treat `serve.*` as “API-facing schema”.
* Every map endpoint must have:

  * a `SELECT` list defined in `packages/geo-sql` (named query)
  * a contract test that asserts:

    * required fields present
    * enums within allowed domain
    * `meta.dataVersion` matches current published version
* Use “payload snapshots” in CI: store representative responses and diff on schema changes.

### 4.4 Endpoint-class architecture blueprint (routes → classes)

**interactive-query**

* `/api/search`
* `/api/geo/boundaries/bbox`

**feature-collection**

* `/api/geo/facilities`
* `/api/geo/hyperscale`
* `/api/geo/enterprise`
* `/api/geo/internet-exchange` (if present)
* `/api/geo/network-reach` (if returning feature-like overlays)
* `/api/geo/friction` (if returning per-county overlay values; otherwise county-state-country-aggregation)

**county-state-country-aggregation**

* `/api/geo/county-metrics`
* `/api/geo/state-metrics`
* `/api/geo/country-metrics`

**tile-serving**

* `/api/tiles/*` (raster proxy + vector tile proxy if used)
* (new) `/tiles/parcels/{version}.pmtiles` (served from CDN/origin)
* (new) `/tiles/infrastructure/{version}.pmtiles`

**proximity-enrichment**

* `/api/geo/tilequery-enrich` (nearest infra)
* (new) `/api/geo/facilities/:id`
* (new) `/api/geo/hyperscale/:id`
* (new) `/api/geo/parcels/:parcelId`
* (new) `/api/geo/parcels/:parcelId/enrich`

**static-export**

* `/api/reports/*`

**diagnostics**

* `/api/diagnostics/*`
* `/api/geo/freshness` (if present)

**ArcGIS bridge**

* `/api/arcgis/token`
* `/api/arcgis/parcels/query`
  Classify these as “dependency-proxy” endpoints with strict allowlists and explicit degraded-mode metadata; long-term parcel draw should not depend on them.

### 4.5 Backend service boundary blueprint (how to keep route handlers thin)

* **Request parsing boundary**

  * `parseFacilitiesRequest(req): FacilitiesQuery`
  * enforce bbox span caps, zoom param validity, filter domains
* **Domain service boundary**

  * `FacilitiesService.getFeatures(query): FeatureCollection`
  * enforces limits, chooses query plan variant by zoom tier
  * applies source inconsistency rules (should never join raw directly)
* **Repository boundary**

  * `FacilitiesRepo.listByBBox(query): rows[]`
  * only SQL and mapping to primitives
* **Mapper boundary**

  * `mapFacilitiesRowsToGeoJSON(rows): FeatureCollection`
  * ensures numeric units, null policy, provenance fields
* **Error model boundary**

  * typed errors: `BadRequest`, `UpstreamUnavailable`, `QueryBudgetExceeded`, `DataStale`
* **Observability boundary**

  * attaches `requestId`, `endpointClass`, `budgetClass`, `dataVersion`
  * records DB query timings + rows + buffers for guardrailed endpoints

---

## Section 5: MySQL -> PostgreSQL Full-Copy Verification Playbook

### 5.1 End-to-end parity checklist

**Gate 0: Copy completeness**

* All MySQL tables present in Postgres `legacy.*`.
* Row counts match exactly for all non-volatile tables.

**Gate 1: Domain parity**

* Null-rate parity for critical columns (facility ids, provider ids, county keys, status).
* Enum/domain parity (status strings, commissioning labels).
* Min/max parity for numeric fields (MW, square footage, dates).

**Gate 2: Key/constraint parity**

* Primary key uniqueness parity (no duplicates introduced).
* Foreign key orphan checks: count of orphans must match (ideally zero).
* Collation/normalization checks for case-sensitive fields.

**Gate 3: Business query parity (map-critical)**

* Facility counts by county
* Provider counts by county
* Commissioned/planned/UC rollups by county
* Search behavior for known county/state terms

**Gate 4: Spatial sanity after SRID introduction**

* Coordinate range validation for any lat/lon fields
* Geometry validity checks after converting to PostGIS geometry
* Containment sanity: facility points within county polygons
* Nearest neighbor sanity: plausible distances

**Acceptance gate (“copy verified”)**

* 100% pass for keys/constraints and map-critical queries.
* For huge tables, allow ≤ 0.01% checksum sampling mismatch only if explained and explicitly waived with an expiry.

### 5.2 SQL/data validation strategy (reproducible)

**Row counts**

* `SELECT table_name, reltuples::bigint FROM pg_class...` is not enough; use exact `COUNT(*)` for smaller tables, and approximate + sampling only for massive tables.

**Checksums**

* For tables with stable PK:

  * bucketed checksums by PK range:

    * `md5(string_agg(md5(row_to_json(t)::text), '' ORDER BY pk))`
  * For very large tables: sample deterministic PK buckets (e.g., `pk % 1000 in (0..9)`).
* For text-heavy: normalize whitespace/case if MySQL collation differed.

**Null/default parity**

* `SELECT count(*) FILTER (WHERE col IS NULL) / count(*)` per critical column.

**Value-domain parity**

* `SELECT col, count(*) FROM table GROUP BY col`.

**FK parity**

* `SELECT count(*) FROM child c LEFT JOIN parent p ON ... WHERE p.pk IS NULL`.

### 5.3 Functional validation against map-critical endpoints

Run the same request suites against:

* legacy-backed endpoints (temporary) and
* serve-backed endpoints (after serving tables exist)

Compare:

* record counts (within caps)
* key fields present
* aggregate totals
* ordering behavior (if ordering matters for UI)

### 5.4 Known failure modes and how to detect them

* **Datetime/timezone drift**

  * detect by min/max + sampled row comparisons on timestamp columns
* **Decimal precision drift**

  * detect by range parity and rounding checks
* **Collation drift affecting search**

  * detect by search regression suite (state abbreviations, county names)
* **Implicit NULL→0 bugs in rollups**

  * detect by coverage ratio checks in analytics tables
* **SRID/axis swap**

  * detect by coordinate range + containment checks (points outside expected bounds)

---

## Section 6: Performance Architecture For Extreme Parcel Scale

### 6.1 Loading/tiling/LOD design

#### Parcel scale architecture decision (mandatory 25.3)

Compare three patterns:

| Approach                             | Draw performance                                      | Interaction quality                                      | Backend complexity          | Correctness risk                              | Final stance |
| ------------------------------------ | ----------------------------------------------------- | -------------------------------------------------------- | --------------------------- | --------------------------------------------- | ------------ |
| API-first viewport pagination        | Poor at 10M+ polygons; payload and main-thread stalls | Good per-feature attributes, but freezes under density   | Medium (bbox paging)        | High (caps distort UX, offset limits)         | **Reject**   |
| Vector-tile-first                    | Excellent; bounded tile requests + caching            | Needs separate detail API; selection requires stable IDs | High upfront tile pipeline  | Low for draw; detail correctness is auditable | **Strong**   |
| Hybrid tile draw + API detail/enrich | Excellent draw + controlled detail                    | Best overall; keeps draw fast and detail accurate        | Medium-high (two contracts) | Lowest overall                                | **Chosen**   |

**Chosen canonical pattern:** **Hybrid**.

#### Parcel LOD rules (concrete)

**Visibility gates**

* Default **min zoom = 13** (configurable per device class).
* Hard cap: if viewport width at zoom corresponds to > **8 km** across, disable parcels (error: “Zoom in to load parcels”).
* Tile cap: if predicted visible tiles > **120 tiles** at current zoom, disable parcel draw (stress gate).

**LOD tiers (server-side, tile build)**

* z ≤ 12: no parcel polygons; optionally show a density grid/hex (H3) if needed.
* z 13–14: simplified parcel polygons (retain topology; drop tiny holes)
* z 15–16: medium detail
* z ≥ 17: high detail (but still not full resolution if it explodes tile size)

**Attribute tiers**

* Draw tiles include only:

  * `parcelId`, `acreage`, `countyFips`, `stateAbbrev`, plus 1–2 categorical flags
* Detail endpoint returns the rest (owner/address only if policy allows).

**Why PMTiles for parcels**

* PMTiles is explicitly a **single-file archive format for tiled data** and defines a structure optimized for clients retrieving directory info up front. ([GitHub][2])
  This is exactly what you want for “parcels at extreme scale”: CDN caching + Range reads instead of millions of HTTP tile files.

### 6.2 API and cache design

**Cache by endpoint class**

* **Tiles (PMTiles):** immutable, versioned paths:

  * `/tiles/parcels/v{YYYYMMDD}.{hash}.pmtiles`
  * Cache-Control: `public, max-age=31536000, immutable`
* **Boundaries:** long TTL + SWR
* **Metrics:** TTL 5–60 min; keyed by `metricVersion` and filters (if metrics are filter-sensitive)
* **Feature-collection:** short server-side cache only (bbox+filters+zoom), not CDN
* **Enrichment/detail:** small TTL (e.g., 60s) if safe; otherwise no-cache but keep DB hot path optimized

**Defensive controls (must not regress current parcel guardrails)**

* Parcel detail endpoints:

  * rate-limited
  * max geometry size (reject huge multipolygons for export without simplification)
  * enforce county context if present
* Parcel overlay:

  * never returns raw GeoJSON lists of thousands of parcels

### 6.3 Runtime interaction safeguards

**Parcel stress governor (client)**

* Monitors:

  * visible parcel tile count
  * render frame-time (rolling p95)
  * memory estimate (selected parcel geometries)
* Actions:

  1. warn at threshold (show “Parcel mode heavy” indicator)
  2. auto-disable parcel outlines but keep selection
  3. force user zoom-in if still over budget

**Layer budget defaults (sane starting values)**

* Visible layer warning: **> 12**
* Visible layer hard cap: **> 18** (auto disable lowest-priority overlays)
* Tile source fanout warning: **> 8**
* Tile source hard cap: **> 12**
* Map refresh duration warning: **> 250 ms**
* Viewport transition warning: **> 350 ms**
* Source update cadence minimum: **500 ms** between successive source updates (debounce filter changes)

### 6.4 Benchmark test plan with clear pass/fail thresholds

#### Dataset tiers (mandatory 33.1)

* **Tier A (dev):** 100k parcels
* **Tier B (prod-like):** 10–30M parcels
* **Tier C (stress):** 80–120M parcels
* **Tier D (worst-case burst):** Tier C + max overlays + rapid interactions

#### Interaction scenarios (mandatory 33.3)

* rapid pan with facilities + telecom + choropleth
* zoom in/out across thresholds
* metric switching (county choropleth) x 20
* parcel toggle on/off with filter updates
* selection/popup under density
* style mode switch during active overlays

#### Endpoint stress (mandatory 33.4)

* concurrent bbox feature queries (N=50)
* county metrics bursts (N=200)
* search typing concurrency (N=100)
* enrichment bursts (N=200)
* tile bursts (simulate CDN cold/warm separately)

#### Pass/fail (examples you should adopt as CI gates)

* **Search:** p95 ≤ 250 ms, p99 ≤ 600 ms
* **Feature-collection:** p95 ≤ 500 ms (bounded + truncated)
* **County/state/country aggregation:** p95 ≤ 250 ms (cached)
* **Tile-serving:** p95 ≤ 150 ms at edge warm cache; cold ≤ 400 ms
* **UI:** p95 frame time ≤ 33 ms in Tier B scenarios; ≤ 50 ms in Tier C worst-case

---

## Section 7: Technical Risks And Failure Modes

### 7.1 Major architecture risks

1. **Parcel tiles become too heavy**

   * Root cause: too many attributes, insufficient simplification, high zoom inclusion
   * Mitigation: strict attribute tiers + tile-size budgets + prepublish checks
2. **County metrics drift from overlays**

   * Root cause: aggregating from different source tables or mismatched filters
   * Mitigation: enforce “analytics only from serve.*” + filter-context versioning
3. **Two tables problem leaks back in**

   * Root cause: map endpoints join legacy tables directly under pressure
   * Mitigation: code ownership boundaries + endpoint contract tests that assert `dataVersion` lineage
4. **Style/layer contract drift**

   * Root cause: unmanaged layer insertion order and style edits
   * Mitigation: style invariants CI + visual regression suite
5. **Explain-plan regressions**

   * Root cause: index changes, stats drift, new filters
   * Mitigation: plan guardrails in CI + threshold versioning

### 7.2 What can break correctness

* mismatched county keys (FIPS normalization issues)
* silent null-to-zero conversions in aggregates
* parcel-to-county misassignment from invalid geometry
* commissioned semantics conflation between colo and hyperscale

### 7.3 What can break performance

* on-demand parcel geometry API (too many features)
* wide viewport polygon queries
* too many concurrent layer toggles causing source thrash
* raster overlay tile storms without caching

### 7.4 What can break maintainability

* endpoint contracts not shared/validated
* SQL fields drifting from TS payload expectations
* vendor-specific style constructs creeping into core style

### 7.5 Hard failure conditions for proposed architecture (required)

1. **Failure:** Parcel interaction exceeds budgets in Tier B

   * **Detection:** benchmark harness reports p95 frame time > 33 ms or tile count > threshold; CI fails
2. **Failure:** County metrics inconsistent with facility overlays

   * **Detection:** contract test compares county totals vs recomputed totals from `serve.facility_site` on fixture dataset; fails on delta > 0.5%
3. **Failure:** Style and layer contracts become non-deterministic

   * **Detection:** style invariant test detects layer order drift; visual regression diffs exceed tolerance
4. **Failure:** Query plan guardrails cannot be enforced

   * **Detection:** EXPLAIN snapshot diff exceeds thresholds; merge blocked
5. **Failure:** Verification artifacts not reproducible

   * **Detection:** parity suite outputs differ for same fixture version; CI fails
6. **Failure:** Canonical IDs/key integrity not preserved

   * **Detection:** duplicate ID checks or FK orphan checks exceed thresholds; publish gate blocks

### 7.6 Incident triage runbooks (required patterns)

**Incident: major layer appears empty**

1. check diagnostics: source mode + freshness lag
2. check endpoint response schema + recordCount
3. validate style source-layer mapping
4. validate zoom gate + filters
5. validate key normalization assumptions

**Incident: parcel interactions freeze UI**

1. inspect viewport span + tile count + feature density
2. inspect cancellation behavior on viewport change
3. inspect payload size (tile bytes)
4. inspect frame-time metrics
5. enforce parcel stress governor fallback

**Incident: county metrics disagree with overlays**

1. confirm both read same `dataVersion`
2. verify formulaVersion + filter context
3. verify cache staleness
4. validate county key normalization
5. inspect serve resolver conflict logs

**Incident: search inconsistent for state names**

1. inspect normalization pipeline
2. inspect alias dictionary
3. inspect search index freshness
4. inspect ranking tie-breakers
5. check case/unaccent behavior

**Incident: 3D overlays degrade clarity**

1. verify layer order invariants
2. verify zoom activation thresholds
3. verify label suppression policy in 3D
4. verify fallback behavior
5. review 3D-specific perf benchmark diffs

**Incident: external dependency outage**

1. detect outage via diagnostics
2. activate fallback source mode
3. surface degraded mode metadata
4. preserve core map usability
5. capture incident artifacts

---

## Section 8: Validation Suite Specification

### 8.1 Contract tests

**Backend**

* every endpoint validates response against Zod schema in tests
* schema snapshot tests for representative fixtures
* enum domain tests (status fields, commissioned semantics)

**Frontend**

* layer catalog integrity tests
* URL-state parse/serialize tests
* popup schema parse tests (per layer family)
* parcel loader cancellation tests (AbortController behavior)

### 8.2 Query-plan checks (explain-plan guardrails)

For each hotspot endpoint (facilities bbox, hyperscale bbox, parcel detail, enrichment, county metrics):

* store EXPLAIN (ANALYZE, BUFFERS) snapshots per dataset tier
* enforce:

  * no sequential scan on parcel partitions for interactive endpoints
  * bounded rows for bbox queries
  * cost thresholds per endpoint class
* allow exceptions only with explicit expiry

### 8.3 Load/perf tests

**API perf**

* k6 (or equivalent) scripts per endpoint class
* separate cold-cache and warm-cache runs
* capture p50/p95/p99 + DB timings + cache hit ratios

**Map UI perf**

* scripted interactions (Playwright)
* capture:

  * initial render time
  * pan/zoom latency
  * frame-time histogram
  * source load errors

### 8.4 Visual/regression tests

* Fixed map seeds (style version + tile versions)
* Scenario screenshots:

  * county choropleth with metric A/B/C
  * facilities dense metro
  * parcels at zoom 15 with infrastructure overlay
  * 3D mode at threshold
* Diff policy:

  * pixel diff tolerance + allowlist for expected diffs
* Artifact retention: store in CI artifacts with build metadata

### 8.5 Data quality control matrix (mandatory 53)

| Check type                                    | Where it runs      | Cadence          | Gate behavior                         |
| --------------------------------------------- | ------------------ | ---------------- | ------------------------------------- |
| Geometry validity (`ST_IsValid`)              | normalization job  | every ingest     | **block publish** if >0.1% invalid    |
| SRID correctness                              | normalization job  | every ingest     | **block publish** if any invalid SRID |
| Out-of-range coords                           | normalization job  | every ingest     | block publish                         |
| Degenerate geometry                           | normalization job  | every ingest     | warn then quarantine                  |
| Missing canonical ID                          | normalization job  | every ingest     | block publish                         |
| Duplicate canonical ID                        | normalization job  | every ingest     | block publish                         |
| FK mismatch (provider/county)                 | normalization job  | every ingest     | block publish above threshold         |
| County key normalization mismatch             | normalization job  | every ingest     | block publish                         |
| Negative/impossible metrics                   | analytics job      | every compute    | block publish                         |
| Null drift in required metrics                | analytics job      | every compute    | warn/block based on threshold         |
| Cross-table consistency (two tables resolver) | serve build job    | every compute    | block publish                         |
| Aggregate delta vs prior snapshot             | analytics job      | every compute    | warn + require review if large        |
| Source freshness lag thresholds               | ops diagnostics    | continuous       | warn + escalate                       |
| Endpoint schema validation                    | CI                 | every PR         | block merge                           |
| Empty layer detection                         | CI + staging smoke | nightly + deploy | warn/block depending on layer         |
| Style key mismatch detection                  | CI                 | every PR         | block merge                           |
| Query plan drift                              | CI                 | every PR         | block merge                           |

---

## Section 9: Source Appendix

### 9.1 Official/primary sources used for major claims (with date context)

> **Note:** URLs are provided in code blocks to comply with the “no raw URLs in prose” rule. Citations in the body link to the corresponding sources.

```text
MapLibre GL JS releases (version/date evidence)
- https://github.com/maplibre/maplibre-gl-js/releases
  - Used for: confirming latest MapLibre GL JS version v5.19.0 (Feb 23 2026)
  - Cited in: Section 1,2

MapLibre GL JS releases (version/date evidence)
- https://github.com/maplibre/maplibre-gl-js/releases
  - Used for: confirming latest MapLibre GL JS version v3.19.0 (Feb 25 2026) and feature notes
  - Cited in: Section 1,2

MapLibre GL JS docs (feature-state, globe, API surface)
- https://www.maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect/
- https://www.maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-a-fill-extrusion-layer/
- https://www.maplibre.org/maplibre-gl-js/docs/API/classes/Map/
  - Used for: feature-state and 3D/globe capability, Map class surface
  - Cited in: Section 1,2

MapLibre CustomLayerInterface docs
- https://www.maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/
  - Used for: custom 3D/model overlay feasibility
  - Cited in: Section 1,2

MapLibre GL JS 3D + custom model examples
- https://docs.maplibre.com/maplibre-gl-js/example/3d-buildings/
- https://docs.maplibre.com/maplibre-gl-js/example/add-3d-model/
  - Used for: MapLibre 3D building workflow and custom layer model workflow
  - Cited in: Section 2

MapLibre Style Spec layer types reference
- https://docs.maplibre.com/style-spec/reference/layers/
  - Used for: showing MapLibre style spec includes additional layer types
  - Cited in: Section 2

PostGIS MVT functions
- https://postgis.net/docs/ST_AsMVT.html
- https://postgis.net/docs/ST_AsMVTGeom.html
  - Used for: server-side MVT generation capabilities
  - Cited in: Section 3

PMTiles v3 specification (primary spec)
- https://raw.githubusercontent.com/protomaps/PMTiles/main/spec/v3/spec.md
  - Used for: single-file archive definition + root directory constraints
  - Cited in: Section 1,6

PostgreSQL docs (partitioning, indexes, extensions)
- https://www.postgresql.org/docs/current/ddl-partitioning.html
- https://www.postgresql.org/docs/current/indexes-types.html
- https://www.postgresql.org/docs/current/pgtrgm.html
- https://www.postgresql.org/docs/current/unaccent.html
  - Used for: partition/index strategy and search extensions
  - Cited in: Section 1,3

Bun workspaces
- https://bun.com/docs/guides/install/workspaces
  - Used for: Bun monorepo/workspace constraints
  - Cited in: Section 4

Turborepo tasks/caching
- https://turborepo.dev/docs/crafting-your-repository/configuring-tasks
  - Used for: task graph + caching rationale
  - Cited in: Section 4

Nx tasks/caching (alternative tooling reference)
- https://nx.dev/docs/guides/tasks--caching
  - Used for: alternative monorepo tool evaluation
  - Cited in: Section 4
```

---

### Final relevance audit statement (required)

* This dossier is restricted to **map runtime, map-facing APIs, geospatial data architecture, tile/query/index strategy, parcel and county workflows, and the developer/monorepo architecture required to operate map features at scale**.
* **Non-map page redesign** was intentionally excluded except for minimal map context handoff requirements.
* **Vue + Tailwind** constraints were honored as immutable.
* The **MySQL → PostgreSQL full-copy baseline** was treated as mandatory first action, with an explicit parity verification playbook before serving-path optimization.

[1]: https://github.com/maplibre/maplibre-gl-js/releases "https://github.com/maplibre/maplibre-gl-js/releases"
[2]: https://raw.githubusercontent.com/protomaps/PMTiles/main/spec/v3/spec.md "https://raw.githubusercontent.com/protomaps/PMTiles/main/spec/v3/spec.md"
[3]: https://www.maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/ "https://www.maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/"
[4]: https://hono.dev/examples/zod-openapi "https://hono.dev/examples/zod-openapi"
[5]: https://www.postgresql.org/docs/current/pgtrgm.html?utm_source=chatgpt.com "F.35. pg_trgm — support for similarity of text using trigram ..."
[6]: https://github.com/maplibre/maplibre-gl-js/releases "https://github.com/maplibre/maplibre-gl-js/releases"
[7]: https://docs.maplibre.com/maplibre-gl-js/example/3d-buildings/ "https://docs.maplibre.com/maplibre-gl-js/example/3d-buildings/"
[8]: https://turborepo.dev/docs/crafting-your-repository/configuring-tasks "https://turborepo.dev/docs/crafting-your-repository/configuring-tasks"
[9]: https://www.maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect/ "https://www.maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect/"
[10]: https://www.maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-a-fill-extrusion-layer/ "https://www.maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-a-fill-extrusion-layer/"
[11]: https://docs.maplibre.com/style-spec/reference/layers/ "https://docs.maplibre.com/style-spec/reference/layers/"
[12]: https://github.com/maplibre/martin "https://github.com/maplibre/martin"
[13]: https://www.postgresql.org/docs/current/indexes-types.html?utm_source=chatgpt.com "PostgreSQL: Documentation: 18: 11.2. Index Types"
[14]: https://guide.cloudnativegeo.org/pmtiles/intro.html "https://guide.cloudnativegeo.org/pmtiles/intro.html"
[15]: https://nx.dev/docs/guides/tasks--caching "https://nx.dev/docs/guides/tasks--caching"
