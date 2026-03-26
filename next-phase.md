# Building a Hard-to-Replicate Geospatial Intelligence System for Data Center Market Selection and Siting

## Executive Summary

A best-in-class data center siting product that stays truthful, and avoids unsupported "available MW" claims, will win by becoming the most decision-useful and auditably honest `screening -> narrowing -> parcel pre-diligence` system between market intelligence and real-world infrastructure constraints.

The moat is not one layer. The moat is the combination of:

- probabilistic grid and queue-friction modeling,
- seam- and corridor-aware infrastructure intelligence,
- proprietary demand signals,
- curated boundary and zone truth,
- connectivity topology,
- governance and policy friction intelligence,
- analyst workflows that compress time-to-answer,
- explicit provenance, freshness, and confidence.

The strongest pattern in the research is that the most credible grid-adjacent tools are screening tools with strong caveats. Operators themselves are moving toward heatmaps, screening views, and directional tools, but they consistently warn that those outputs are not substitutes for studies and do not imply deliverability. datacenterHawk should adopt that truthfulness bar and then outperform those tools by combining market pressure, competition, operator geography, corridor logic, parcel developability, and high-integrity explanation workflows.

## The Recommended End State In One Sentence

Build a county-first market pressure system that guides users into a corridor-aware infrastructure feasibility lens, then outputs a parcel-level pre-diligence packet with probability bands, provenance, and explicit "what this does not mean."

## Why This Direction Has The Highest Leverage

Three things are now true at once:

1. Data centers and large loads are a dominant reliability-planning issue, and forecast versus realized demand is uncertain enough that credible institutions explicitly haircut or adjust large-load requests.
2. Interconnection queues are indispensable but noisy, with low historical realization rates and long timelines, so any map that treats queue MW as supply without a probability model will mislead users.
3. Interconnection reform and operator tooling are pushing the market toward broader public screening and heatmap-style signals, but those signals still cannot be treated as deliverability.

This means datacenterHawk should not try to out-promise the grid operators. It should become the most useful and most honest system for market selection and early siting judgment.

## Product Principles

- County is the discovery unit, not the electrical feasibility unit.
- Corridor, utility, operator, and seam geography are the feasibility units.
- Hubs are first-class convergence entities within the corridor-feasibility system.
- Parcel is the pre-diligence and decision-support unit.
- Market pressure and feasibility remain separate surfaces with separate semantics.
- A variable can be primary on one surface and contextual on the others, but it should not be primary in multiple surfaces.
- No unsupported "available MW" claims at county or substation level.
- Generation-side queue data and load-side service requests remain distinct modeled objects.
- Every surfaced metric carries provenance, freshness, confidence, and caveats.
- Low-confidence outputs are downgraded or suppressed rather than silently over-asserted.
- Public and paid inputs are treated as versioned contributors, not canonical truth by default.
- Hard gates only for high-confidence legal/physical infeasibility or clear undersizing. Soft flags for costly, risky, or jurisdiction-dependent constraints. Missing/unknown values should reduce confidence or force review, not silently pass.

## The Core Product Thesis

The product should evolve from `county intelligence + story modes` into a three-surface decision system:

### 1. County Triage Surface

This surface should answer:

- Where should I look next?
- Why is this county heating up or cooling down?
- What changed in the last 30/60/90 days?
- What is the effective market pressure in the surrounding catchment?

Core outputs:

- market pressure,
- catchment-adjusted market pressure with delta and neighbor contributions,
- tier and archetype,
- confidence,
- top drivers,
- change windows,
- catchment delta,
- county story narrative.

Market pressure should be defined narrowly here as:

- demand pressure,
- competition intensity,
- absorption and spillover,
- near-term market momentum.

Feasibility signals should not be the primary meaning of the county surface. They belong on the corridor-feasibility surface and in parcel pre-diligence.

### 2. Corridor Feasibility Surface

This surface should answer:

- What hidden infrastructure or market-structure friction sits behind this county?
- Is this county inside a seam-sensitive or transfer-friction pocket?
- How do transmission, fiber, gas, congestion, and governance interact here?
- What corridors and hubs serve this geography?

Core outputs:

- corridor ribbons with infrastructure composition and confidence,
- hub anchors with convergence characteristics,
- corridor-to-hub connectivity context,
- probabilistic supply timeline with P10/P50/P90 bands,
- seam-aware transfer friction,
- transmission and congestion context,
- fiber resilience and route diversity context,
- optional gas and water context,
- operator and utility geography.

### 3. Parcel / Site Surface

This surface should answer:

- What does a credible first-pass pre-diligence package look like?
- What local constraints change the story?
- What can I export for internal review or client discussion?

Core outputs:

- three-tier parcel gating (hard exclude, strong review, soft flag) with pass/fail/review-required outcomes,
- archetype-specific acreage gates,
- net-developable area assessment,
- infrastructure access context (distance to nearest corridor, distance to nearest hub),
- parcel risk and exclusion layers,
- policy friction flags,
- power-timeline probability narrative,
- provenance and confidence appendix.

This surface should be described as pre-diligence or first-pass diligence, not engineering-grade feasibility or utility-confirmed diligence.

## Search-First Findings

### The Most Important Pattern: Screening Tools With Strong Caveats

The most credible grid-adjacent siting experiences are not overlay-heavy novelty experiences. They are screening tools that:

- offer bounded analysis,
- emphasize that the output is informational,
- make assumptions and limitations explicit,
- encourage directional use instead of false certainty.

Two important examples:

- PJM Queue Scope explicitly says it is informational only, not reflective of current system conditions, not a substitute for actual interconnection studies, and limited to screening logic that omits voltage, stability, and short-circuit constraints.
- CAISO has moved toward Points of Interconnection heatmap-style tooling tied to interconnection reform, but those displayed capacities are still informational rather than deliverability commitments.

This matters because datacenterHawk's truthfulness standard should meet or exceed the operator standard, not undercut it.

### Queues Are A Probabilistic Signal, Not A Supply Map

The Berkeley Lab queue synthesis is the strongest public evidence here:

- queue volumes are very large,
- many projects never reach COD,
- median request-to-COD timing is now more than four years,
- only a minority of requested capacity reaches COD,
- queue data is informative but not deliverability.

That supports a hard product rule: treat queue data probabilistically and never conflate "in queue" with "deliverable supply."

### Large-Load Demand Must Be Modeled As Behavior, Not Just Pipeline

Large-load and data center forecasts are uncertain enough that planners explicitly adjust or haircut them. That means the moat should include behavioral realism:

- requested MW,
- contracted MW when known,
- likely realized MW,
- timing and confidence.

### Data Availability Reality Check

Some of the most important geospatial layers are restricted, precision-limited, approximate, or fragile:

- HIFLD electric substations are restricted.
- HIFLD Open was discontinued in August 2025, with layers moving to HIFLD Secure or provider-managed portals. Even public HIFLD acquisition is now more fragmented than it used to be.
- HIFLD transmission lines and retail service territories are public, but distribution and hosting details are fragile and uneven. HIFLD transmission metadata carries `VAL_METHOD` (IMAGERY, IMAGERY/OTHER, OTHER, UNVERIFIED) but no formal horizontal positional-accuracy report.
- Third-party mirrors and infrastructure cards disappear or get deprecated.
- PHMSA/NPMS public usage should be treated as a public viewer with precision limits (minimum accuracy of +/-500 feet) and restricted detailed access, not as an exact engineering layer.
- FiberLocator maps are street-level and useful for sales/pre-qualification, but not engineering-level, even though data comes from participating carriers with monthly/quarterly updates.

That pushes the strategy toward `curate + verify + version + caveat`.

### County Adjacency Nuance Is Not Optional

The Census County Adjacency File explicitly includes both shared-edge and point-touch adjacency, and the 2025 product year adds boundary length in meters. Point-touch neighbors have `length = 0`.

That is exactly the knob needed to implement defensible spillover and catchment logic without overstating neighbor influence.

### Environmental Layers Matter, But Mostly As Gates

The best public environmental layers are authoritative and useful, but easy to misuse. Examples:

- FEMA NFHL is excellent for flood screening, but preliminary data is not the same as effective data.
- USDA wildfire hazard potential is useful for long-term planning, but is not a short-term threat or forecast map.

These layers should mostly act as parcel and corridor exclusions, risk flags, and scenario overlays rather than dominant county ranking inputs.

## Competitive Convergence

The siting stack is now converging from three directions at once:

- energy-side platforms are moving directly into power-first siting workflows,
- adjacent data-center intelligence firms are already operationalizing GIS-enabled siting UX,
- CRE firms are internalizing proprietary site-selection tooling.

Based on publicly marketed capabilities, the opportunity is not to win with more layers. It is to be the first platform that combines county-level market intelligence, corridor-level infrastructure friction, parcel-level screening, and explicit provenance and confidence into one decision pipeline.

### Direct Competitive Pressure

The clearest direct signals are:

- Enverus marketing withdrawal-capacity-led siting with parcel and grid analytics,
- PVcase marketing an all-in-one power-first siting workflow,
- Orennia marketing data-center siting, queue analytics, and scenario-based power-flow analysis,
- DC Byte already offering a Site Selector with flood, fiber, substation, and hazard overlays while tracking thousands of facilities,
- Cushman & Wakefield launching Athena as proprietary site-selection tooling.

The defensible claim is not that no competitor has any advanced capability. It is that, based on publicly marketed capabilities, no reviewed platform appears to combine county -> corridor -> parcel workflow, probabilistic grid friction, seam-aware geography, and provenance/confidence UX in one product.

### Owned Advantage

The near-term owned advantage is not "we can out-grid Enverus tomorrow." It is that datacenterHawk can fuse analyst-led market intelligence and transaction context with CCMI-owned connectivity data faster than energy-first rivals can fuse in real-estate truth.

That is where the FiberLocator relationship matters most. The strategic advantage is not generic "fiber matters" language. It is direct carrier-linked fiber intelligence that can be combined with datacenterHawk's analyst-led market and transaction context inside the same siting workflow.

### True Competitors Versus Component Ecosystem

The main strategic threats are:

- energy-side siting platforms,
- adjacent data-center intelligence firms,
- CRE firms that decide to keep their best siting tools internal.

The component ecosystem should be treated differently. Platforms such as Esri, Regrid, LightBox, and Arcadia are better framed as enabling layers, integration partners, or component vendors than as the core strategic threat.

## Opportunity Map

| Opportunity | Strategic upside | Customer value | Differentiation | Data risk | Maintenance burden | Why it matters |
|---|---|---|---|---|---|---|
| Corridor feasibility system: probabilistic supply timeline + seam-aware grid friction + multi-infrastructure access | High | High | High | Medium | Medium | Matches operator screening reality without pretending deliverability |
| County -> catchment market pressure 2.0 | High | High | Medium-High | Low | Low-Medium | Census adjacency gives a real mechanical backbone |
| Parcel pre-diligence packet automation | High | High | High | Medium-High | Medium | Becomes daily-use analyst and sales asset |
| Policy and governance friction watch | Medium-High | High | High | Medium | Medium | High retention value and hard-to-automate local truth |
| Utility-territory-aware modeling | Medium-High | High | Medium-High | Medium | Medium | Corrects the wrong-grain problem of county-only logic |
| Premium APIs and data feeds | Medium-High | Medium-High | Medium-High | Low-Medium | Low | Existing provenance-aware contracts are a strong foundation |
| "Everything overlay" expansion | Low | Low-Medium | Low | Medium | High | High clutter, low signal, violates the workflow thesis |

---

## Locked Design Decisions

The following specifications have been resolved through design review and are ready for implementation.

### 1. Corridor Definition And Derivation

#### What A Corridor Is

A corridor is a **linear geographic zone where deployable infrastructure is co-located along a shared route**. It is defined by five properties:

1. **Linear, not areal.** It follows a path — typically a right-of-way, highway, river valley, or utility easement.
2. **Contains multiple infrastructure types.** A single transmission line is not a corridor. A transmission line + fiber following the same path is.
3. **Connects nodes.** Substations, generation plants, carrier hotels, IXPs, load centers.
4. **Has capacity characteristics.** Voltage class, fiber strand count, pipe diameter, congestion levels.
5. **Has friction characteristics.** Seam crossings, congestion pockets, transfer constraints, permitting jurisdictions.
6. **Is indifferent to political boundaries.** It crosses counties, utility territories, sometimes ISO/RTO seams.

A corridor answers: "What can physically get to this location, from where, through what, and at what cost/constraint?"

#### Two Entity Types: Corridors And Hubs

The corridor feasibility system produces two spatial entity types:

- **Corridor**: an elongated overlap zone where >= 2 infrastructure types are co-located at ROW scale. Represents shared-route feasibility geography.
- **Hub**: a compact multi-infrastructure cluster or intersection. Represents convergence/anchor geography (substation clusters, generation plant sites, carrier hotel concentrations).

Hubs are first-class independent entities. Some hubs also function as nodes on the corridor network. The distinction:

- A hub is a semantically meaningful compact convergence of multiple infrastructure types.
- A node is a topological role in the network.
- Some hubs are nodes, some nodes are not hubs.

#### Derivation Algorithm

| Parameter | Value |
|-----------|-------|
| Co-location threshold | >= 2 infrastructure types |
| Buffer approach | Source-pair-specific candidate buffers, not one global default |
| Minimum continuous length | 2 miles |
| Shape test | Aspect ratio >= 3:1 (elongated = corridor, compact = hub) |
| Access bands | Computed separately at 1 / 3 / 5 miles as parcel-facing metrics |

#### Source Precision Tiers

Corridors are derived using source-pair-specific candidate buffers and validation-weighted confidence tiers. A 0.25-mile half-buffer is the initial candidate-generation setting for eligible linework, while precision-limited public sources are context-only until empirically validated or replaced.

| Tier | Description | Corridor role | Candidate half-buffer |
|------|-------------|---------------|----------------------|
| **A** | Quantified or empirically validated linework | Corridor-defining | 0.25 mi |
| **B** | Good but unquantified linework (HIFLD transmission, FiberLocator) | Corridor-defining with confidence downgrade, stronger length/shape filters | 0.25 mi candidate |
| **C** | Explicitly degraded / non-engineering layers (NPMS public viewer) | Context-only, not corridor-defining | Not corridor-eligible |

Tolerances live in per-infrastructure-type metadata, not in code:

- `default_corridor_buffer`
- `max_allowed_corridor_buffer`
- `geometry_confidence / positional_uncertainty`
- `parcel_access_bands`
- `corridor_eligible: boolean`

#### Three Derivation Outputs

1. **Corridor**: elongated overlap of >= N types at tight scale
2. **Hub**: compact multi-infrastructure cluster/intersection
3. **Access metrics**: parcel-facing 1 / 3 / 5 mile reachability bands

This prevents a messy interchange or substation cluster from becoming a fake corridor.

#### Entity Model

**First-class spatial entities:**

- **Corridor**: polygon ribbon, representative axis/centerline, infrastructure types present, length, width proxy, confidence
- **Hub**: compact polygon and representative point, infrastructure types present, hub class, confidence

**Derived topology (v2):**

- **Node**: `hub_node`, `junction_node`, `terminal_node`
- **Edge**: corridor segment between nodes

**Relationship tables:**

- `hub_to_corridor`: relation type (intersects, anchors, near_endpoint, within, independent)
- `corridor_to_corridor`: relation type (crosses, branches, merges)

#### Corridor Data Strategy

| Layer | v1 Source | Role | Precision tier | Upgrade path |
|-------|-----------|------|----------------|-------------|
| Transmission | HIFLD (tiered by VAL_METHOD) | Corridor-defining | B | State/local overrides in priority markets; commercial (MAPSearch/S&P) if budget allows |
| Gas | EIA/BTS interstate/intrastate pipelines | Context-only, not corridor-defining | C | NPMS via government sponsor, or commercial gas linework |
| Fiber | FiberLocator (existing CCMI relationship) | Corridor-defining | B | Already best practical source |
| Substations | HIFLD (restricted) | Hub candidate input | B | Fragile access — monitor post-HIFLD-Open discontinuation |

**Validation results (completed):** Empirical corridor validation was run at 5 US data center corridor locations comparing HIFLD transmission lines (Parquet, 94k features) against FiberLocator fiber routes (vector tiles at z14, 0.46m precision).

| Site | Min separation | Pairs < 0.25mi | Pairs < 0.5mi | HIFLD VAL_METHOD |
|------|---------------|----------------|---------------|-----------------|
| Atlanta Northeast | **0.004mi (22ft)** | 12 | 17 | 100% IMAGERY |
| Phoenix West | **0.006mi (29ft)** | 1 | 1 | 100% IMAGERY/OTHER |
| Chicago West | **0.022mi (116ft)** | 52 | 100 | 100% IMAGERY |
| Dallas-Fort Worth | **0.022mi (116ft)** | 7 | 12 | 64% IMAGERY/OTHER, 36% IMAGERY |
| Northern Virginia | **0.174mi (917ft)** | 2 | 5 | 100% IMAGERY |

**Overall minimum separation: 22ft. Median of site minimums: 116ft.**

**Verdict: STRONG PASS.** Co-located infrastructure consistently within ~250ft across all 5 sites. The 0.25mi half-buffer is well-supported for Tier B sources. Atlanta and Phoenix showed 22-29ft minimum separations — genuine shared-ROW co-location. Chicago had 52 pairs under 0.25mi — the densest co-location of any site. NoVA was the weakest at 917ft minimum, likely because Dominion transmission and metro fiber follow different routes in the suburban Loudoun County grid.

**Tier A upgrade path:** MAPSearch (electric + gas GIS, quarterly updates, utility-submitted data) is the single vendor most likely to upgrade transmission and gas to Tier A. For fiber, the FiberLocator source database (pre-tile-quantization geometry from carrier partnerships) is almost certainly Tier A quality — the bottleneck is organizational access within CCMI, not data quality. State-level official layers (Oregon traced from orthoimagery/lidar, California CEC) can serve as Tier A overrides in priority markets.

**Data acquired:**
- HIFLD transmission lines: `/Users/robertfarris/map/.cache/hifld/transmission-lines.parquet` (44MB, 94,619 features, archived Aug 2025, source data through mid-2022)
- Berkeley Lab Queued Up 2025: `/Users/robertfarris/map/.cache/berkeley-lab/queued-up-2025.xlsx` (14MB, 36,441 project-level queue records through end-2024) — historical calibration/backtesting corpus
- FiberLocator: 921 layers (392 metro, 66 longhaul) accessible via vector tile API at z14 with 0.46m precision

**Data pending procurement (approved, access expected soon):**
- Interconnection.fyi — primary queue data source for supply timeline model (replaces Berkeley Lab as v1 primary)
- EQ Research — primary policy event/condition source for policy system
- Regrid parcels — already ingested (24.6M parcels), procurement confirmed

**Data under evaluation (not yet approved):**
- East Daley — gas pricing and utilization data. On hold. Would enrich gas context layer but does not change corridor derivation (gas remains context-only / Tier C).

#### Corridor Production-Visibility Rules

Corridor outputs are production-ready in **validated markets** (NoVA, Dallas, Phoenix, Chicago, Atlanta). Outside validated markets, corridors are shown as **derived corridors with explicit confidence labels**, not treated as surveyed ROW truth.

Additional release rules:
- **Parameter-stability test required:** a corridor must persist with limited topology drift under reasonable sweeps of buffer (0.20-0.30mi), min-length (1.5-2.5mi), and shape thresholds (2.5:1-3.5:1). If a corridor disappears under minor parameter variation, it is not stable enough for production display.
- **Tier B + Tier B confidence cap:** corridors derived from two Tier B sources are capped at medium evidence confidence and low-to-medium method confidence until either Tier A overrides or manual QA exists.
- **Corridors do not drive hard parcel gating.** They feed contextual access scoring and analyst review, not exclusion logic. (Already established in parcel gating spec.)
- **Ongoing morphology-expansion validation program:** new market types (rural long-haul, mountain pass, coastal, industrial brownfield) must be validated before inheriting the same confidence level as tested markets. This is post-lock expansion QA, not a launch blocker.

**Important risk:** HIFLD Open was discontinued August 2025. Confirm you still have access to the transmission layer or have a cached copy.

#### Drill-Down Flow

```
County    -> "This county is hot. Where's the infrastructure?"
Corridor  -> "Infrastructure runs here, along this route, with these constraints."
Parcel    -> "These specific parcels are near that infrastructure and pass the gates."
```

The corridor step surfaces which corridors and hubs serve a county. Parcel filtering then uses proximity to those corridors/hubs as access metrics.

---

### 2. County Catchment Market Pressure 2.0

#### Computation Model

Catchment rollup is computed at the **raw-feature level for market-pressure features only**. It does not average neighbor pillar scores.

For each county `i` and eligible raw feature `x`:

```
x_i_catchment = x_i_local + lambda_f * sum_j(w_ij_f * x_j)
```

Where:

- `j` = eligible adjacent counties
- `w_ij_f` = neighbor weight for metric family `f` (normalized shared-boundary length, capped)
- `lambda_f` = spillover intensity by metric family
- Point-touch neighbors get 0 or a very small weight depending on family

The pooled raw features are then scored into a **catchment-adjusted market pressure score**.

#### Spillover Scope

**Pool into catchment-adjusted county market pressure (high or medium spillover):**

- facility counts
- leased / occupied / under-construction MW
- known development pipeline
- transaction / comp activity
- absorption trends
- hyperscaler / large-user presence signals
- land/development inventory (where additive logic is valid)
- competition intensity
- development activity

**Do NOT pool into catchment score (keep as separate contextual surfaces):**

- probabilistic supply timeline
- grid friction
- congestion context
- seam-sensitive geography
- utility process posture
- zoning hostility / moratoria / lawsuits
- policy/governance

These remain on their own surfaces as corridor-feasibility context, jurisdictional flags, neighbor cards, and exposure callouts.

#### Spillover Intensity By Metric Family

- **High spillover**: competition intensity, absorption pressure, development activity
- **Medium spillover**: land pipeline, facility counts, transaction activity
- **Low or none**: policy, utility process, seam friction, local governance

#### Lambda Calibration Protocol

`lambda_f` values are calibrated through a backtest-and-cap protocol, not analyst intuition alone:

1. **One lambda per metric family**, not market-specific lambdas.
2. **Calibrate on rolling out-of-sample forward targets** using only information available at time `t`: provider entry, signed IA growth, under-construction MW, commissioned MW, and transaction activity at `t+12m` and `t+24m`.
3. **Search over bounded values**, `lambda_f ∈ [0, 0.35]`. Starting priors:
   - competition intensity: **0.30**
   - absorption / development activity: **0.20–0.25**
   - land pipeline / facility counts / transaction activity: **0.10–0.15**
   - policy / utility / seam friction: **0** (these families do not spill over)
4. **Point-touch lambda = 0 by default.** Allow a maximum of **0.05** for competition-style families only if backtests show consistent lift.
5. **Structural caps** to prevent halo dominance:
   - No single neighbor can carry more than **50%** of total spillover weight.
   - Total spillover contribution cannot exceed **35–40%** of the adjusted family signal.
   - If the catchment version does not beat the local-only baseline stably across peer groups, set that family's `lambda_f = 0`.
6. **Lambdas are versioned** and shown in provenance so the catchment delta is auditable.

#### Adjacency Rules

- **Shared-edge neighbors**: normalized shared-boundary length with caps so no single neighbor carries more than 50% of spillover weight.
- **Point-touch neighbors**: excluded by default (lambda = 0). Weak inclusion (lambda <= 0.05) only for competition-style families where backtests show consistent lift.

#### UX

Even when the catchment-adjusted metric is computed using raw-input pooling, present it with individual neighbor transparency:

- Focal county score
- Catchment-adjusted score
- Catchment delta
- Top 3 contributing neighbors
- Contribution by driver
- Why the delta changed
- Edge-only vs include-point toggle
- Confidence / missingness

---

### 3. Probabilistic Supply Timeline

#### Training Data Strategy

- **v1 primary data source:** Interconnection.fyi (commercial, procurement approved). Provides project-level interconnection queue data with status history across ISOs/RTOs. Likely near-real-time updates, significantly fresher than annual snapshots.
- **v1 model type:** Competing-risks survival model with outcomes: COD, withdrawal, still active/censored.
- **v1 fallback:** Empirical rate tables (D-style lookup) for sparse segments where sample sizes cannot support stable model estimates.
- **Historical calibration / backtesting corpus:** Berkeley Lab's project-level Queued Up dataset (through end-2024, 36,441 projects, 7 ISOs + 49 non-ISO BAs, ~97% of installed U.S. generating capacity). Use for training the initial survival model and validating against known outcomes. Available locally at `.cache/berkeley-lab/queued-up-2025.xlsx`.
- **Supplementary freshness:** Official ISO/RTO public feeds (CAISO, MISO, ISO-NE, SPP, ERCOT, PJM, NYISO) for validation and gap-filling where interconnection.fyi coverage is thin.

#### Model Covariates

- Technology type (solar, wind, storage, gas, hybrid)
- ISO/RTO region
- Queue entry year (cohort effects)
- Project size (MW)
- Time already in queue (duration dependence)
- Whether an IA has been executed

#### County Rollup

Primary county expected curve at time `t`:

```
E_c(t) = sum_p MW_p * F_p(t) * a_pc
```

Where:

- `MW_p` = project size
- `F_p(t)` = predicted probability project `p` reaches COD by time `t`
- `a_pc` = `allocation_share` from `analytics.fact_gen_queue_county_resolution`

**Primary rollup uses `allocation_share` only.** `resolver_confidence` is NOT multiplied into the main estimate.

#### Resolver Confidence Treatment

`resolver_confidence` is carried as a separate confidence/control layer:

- **Geography-confidence overlay**: a county-level resolution confidence computed from the weighted resolver scores of contributing projects.
- **Optional conservative view**: `E_c_conservative(t) = sum_p MW_p * F_p(t) * a_pc * g(r_pc)` where `g(.)` is a calibrated mapping from resolver score to probability-like weight. If `resolver_confidence` is just a heuristic score today, `g(x) = x` is not yet statistically justified.
- **Unresolved geography reserve**: the difference between primary and conservative estimates goes to an unresolved geography bucket, not nowhere. This keeps national/regional totals honest.

#### Visualization

A banded timeline with P10/P50/P90 style ranges and a visible "what this does not mean" box. The UI must always reinforce that this is screening and probability, not firm capacity.

---

### 4. Source Map Registry

#### Architecture

The Source Registry is a **hybrid, normalized system**:

- **Versioned definitions in repo** for semantics and rules (YAML or SQL migrations, code-reviewed).
- **Runtime tables in the database** for freshness, ingestion, health, and current state.
- **Every scoring run pins a registry version** so outputs are reproducible.

This is not documentation. It is an operational dependency for the confidence/freshness/suppression system.

#### Four Entities

##### source_definition (repo-versioned)

The canonical definition of what a source is:

- `source_id`, `source_name`, `provider_name`
- `source_family` (government primary, commercial licensed, internal curated, derived)
- `description`, `what_it_is`, `what_it_is_not`
- `primary_use_cases`, `prohibited_use_cases`
- `production_method` (surveyed, digitized, modeled, aggregated, self-reported, curated)
- `evidence_type` (observed, reported, curated, modeled, inferred)
- `coverage_geography`, `coverage_grain`, `geometry_type`, `expected_completeness`, `known_gaps`
- `provider_update_cadence`
- `licensing_class`, `redistribution_rights`, `attribution_requirements`
- `precision_tier` (A/B/C)
- `accuracy_statement`, `accuracy_basis` (metadata, empirical validation, provider statement, unknown)
- `default_role` (defining, contextual, validation-only, fallback)
- `owner_team`
- `status` (active, deprecated, experimental, blocked)

##### source_version (repo-versioned)

A source definition can have many provider vintages or approved internal versions:

- `source_version_id`, `source_id`
- `provider_version_label`
- `source_as_of_date`, `source_release_date`
- `effective_from`, `effective_to`
- `schema_version`, `geographic_extent_version`
- `notes_on_change`, `change_type` (refresh, schema drift, methodology change, coverage change)
- `checksum_or_fingerprint`

##### source_runtime_status (database, mutable)

The operational state the app queries at runtime:

- `source_id`, `current_source_version_id`
- `last_successful_ingest_at`, `last_attempted_ingest_at`
- `latest_provider_update_seen_at`, `freshness_as_of`
- `staleness_state` (fresh, aging, stale, critical)
- `ingestion_health` (healthy, degraded, failed)
- `record_count`, `geographic_coverage_observed`, `completeness_observed`
- `runtime_alert_state`
- `license_expiration_date`
- `access_status` (accessible, cached-only, lost-access, pending-renewal)

##### source_dependency_rule (repo-versioned)

How source state affects downstream outputs:

- `dependency_rule_id`, `source_id`
- `downstream_object_type` (metric, feature, score, surface, packet section)
- `downstream_object_id`
- `role_in_downstream` (primary, contextual, fallback, validation)
- `requiredness` (required, optional, enhancing)
- `confidence_impact_rule`, `freshness_impact_rule`, `suppression_rule`, `missingness_rule`, `precision_rule`
- `geography_scope` (national, state, utility, county, parcel)
- `rule_version`, `effective_from`, `effective_to`

Dependency rules must be **structured policies, not prose**:

- `warn_if_days_stale > 30`
- `degrade_if_days_stale > 90`
- `suppress_if_days_stale > 180`
- `suppress_if_missing = true`
- `precision_tier_c_allowed_for_primary = false`

#### Materialization And Runtime Pattern

1. Canonical definitions and rules live in repo, code-reviewed.
2. On deploy or registry publish: parse definitions, load into DB tables, stamp a `registry_version`.
3. App and scoring engine query database views: `registry.active_sources`, `registry.current_source_status`, `registry.downstream_rules`.
4. Every scoring/model run stores: `registry_version`, `source_version_ids used`, `ingestion_snapshot_ids used`.

---

### 5. Confidence, Freshness, And Suppression System

#### Architecture: Confidence DAG

Confidence is a **propagation backbone with local confidence operators**, not a single scalar chain. Confidence should propagate upward through lineage, but any level that introduces new transformation, aggregation, geometry, or modeling must add its own independent confidence assessment.

A level gets independent confidence logic when it does any of:

- **Estimation**: imputes, predicts, or resolves ambiguity
- **Aggregation**: pools heterogeneous things into one number
- **Spatial derivation**: creates a new geometry (corridor, hub)
- **Allocation**: splits one object across many places
- **Parameterized logic**: depends on thresholds (buffers, length tests, point-touch policy)
- **Domain shift / sparse support**: applies a model where training support is weak

If a level does none of those and is just displaying inherited values, it should mostly summarize propagated confidence.

#### Per-Level Confidence

| Level | Confidence source |
|-------|------------------|
| **Source** | Base layer. Source quality, completeness, precision tier, observed vs modeled, freshness, access stability. Not derived from anything else. |
| **Field** | Sometimes inherited, sometimes independent. Derived fields, allocated values (queue-to-county resolver), and imputed values need independent method confidence. |
| **Pillar** | Own confidence logic. Introduces weighting, normalization, missingness handling, possible imputation. High-confidence fields can still yield medium-confidence pillars if fields conflict or coverage is sparse. |
| **County** | Propagated from pillars + county-specific composition risk (cross-pillar contradiction, missing coverage, normalization fit, modeled vs observed dependency). |
| **Catchment** | Independent assessment required. Adjacency rules, boundary weighting, point-touch inclusion, neighbor dominance, heterogeneous coverage, sensitivity to spillover parameters. |
| **Corridor** | Independent assessment required. Source pair precision tiers, buffer sensitivity, minimum-length robustness, shape robustness, whether corridor persists across parameter changes, validation support. |
| **Parcel** | Independent assessment required. Parcel geometry/zoning quality, distance thresholds, environmental layer completeness, freshness of governance inputs, whether access conclusions depend on approximate linework. |
| **Surface** | Presentation summary of underlying object states, not a new model. Summarize confidence of objects shown, freshness states, active suppressions, unresolved share. |

#### Per-Object Confidence Vector

Each object carries:

- `evidence_confidence` — how trustworthy are the inputs feeding this thing?
- `method_confidence` — how trustworthy is the way this thing was constructed from those inputs?
- `coverage_confidence` — how complete is the input data?
- `freshness_state` — is the data current?
- `suppression_state` — should this be hidden or downgraded?

Optionally also: `precision_confidence`, `allocation_confidence`, `model_support_confidence`.

#### Key Rules

- **Higher-level independent confidence should usually act as a cap or penalty, not a booster.** A clever model should not make weak inputs look highly certain. Local confidence operators mostly degrade, cap, or suppress.
- **User-facing confidence** is visible at meaningful levels: pillar, county, catchment delta, corridor/hub, parcel packet sections.
- **Field-level and source-level details** remain inspectable in drill-down or provenance views.

---

### 6. Parcel Pre-Diligence Gating

#### Data Inventory

The parcel dataset contains 24.6 million parcels across 55 states/territories (Regrid source). All gate-relevant attribute keys are present at ~100% population rate, though many values within keys are empty strings.

Key field availability:

| Field | Population | Notes |
|-------|-----------|-------|
| `gisacre` | 100% | Median 18 acres, P25=8.4, P75=48, P95=449 |
| `fema_flood_zone` | 100% key; ~53% have a zone value | Values: X (no flood), A, AE, D, VE, AH, AO, A99. 47% empty. |
| `fema_nri_risk_rating` | 99.9% | Very Low / Relatively Low / Relatively Moderate / Relatively High / Very High |
| `zoning_type` | 100% key; ~68% have a value | Agriculture (21%), Special (18%), Planned (12%), Mixed (8%), Residential (6%), Commercial (2%), Industrial (1.6%). 32% empty. |
| `usedesc` | 100% key; ~30% have a value | Too sparse for gating. Context only. |
| `ll_bldg_count` | 100% | Integer, many are 0 |
| `transmission_line_distance` | 100% | In feet. Median 2,273ft, P25=779ft, P75=4,822ft |
| `roughness_rating` | 92% | 0-6 scale (0=flat, 6=rough) |
| `lowest/highest_parcel_elevation` | 100% | In meters. Slope proxy via difference. |
| `ll_row_parcel` | Present | Right-of-way parcel flag |
| `padus_public_access` | Present | Public access designation |
| `insite_score` | Present | Low/Moderate/High (opaque third-party score) |

#### Three-Tier Gate Policy

Every parcel gets one of three outcomes: **Pass**, **Fail**, **Review Required**.

##### Hard Exclude (fail)

| Gate | Logic | Rationale |
|------|-------|-----------|
| Minimum acreage | `gisacre < min_gross_acres_for_selected_archetype` | Archetype-specific: enterprise (lower floor), colo/wholesale (medium), hyperscale/campus (much higher). Single-parcel only — not assemblage-aware. |
| Right-of-way parcel | `ll_row_parcel = true` | Infrastructure easements, cannot be built on. Cleanest exclusion field available. |
| Residential zoning | `zoning_type = Residential` | First-pass pre-diligence logic. Rezoning is possible but high friction. |
| Confirmed protected/public land | Confirmed protected-area overlap or protected ownership | Hard gate only with verified field. NOT `padus_public_access` alone. |

##### Strong Review / Likely Fail

| Gate | Logic | Rationale |
|------|-------|-----------|
| 100-year flood zones | `fema_flood_zone in (A, AE, VE)` | Strong exclusion flag, but only a hard gate if the parcel-level FEMA assignment is verified as reliable, not a coarse copied attribute. |
| Ambiguous zoning | `zoning_type in (Mixed, Planned, Special, Agriculture)` | Too ambiguous to pass or fail automatically. Agriculture is 21% of parcels — some are rezonable. |
| Public access present | `padus_public_access` is set | Flag for review, not automatic exclusion. |
| Dense small parcel | High `ll_bldg_count` on low acreage | Redevelopment possible but adds cost. |
| Very rough terrain | High `roughness_rating` + large elevation spread | Combine roughness with elevation delta into one terrain-cost flag. |

##### Soft Flag

| Gate | Logic | Rationale |
|------|-------|-----------|
| Other flood zones | `fema_flood_zone in (D, AH, AO, A99)` or empty | Unknown or moderate risk. |
| Multi-hazard risk | `fema_nri_risk_rating = Very High` | Good for narrative and escalation, not exclusion. |
| Moderate roughness | `roughness_rating >= 5` | Cost indicator, not infeasibility. |
| Unknown zoning | `zoning_type` is empty (32% of parcels) | Confidence downgrade + manual-review trigger if parcel is otherwise attractive. |
| Existing buildings | `ll_bldg_count > 0` | Not disqualifying on its own. |

##### Context Only (scoring/narrative, not gating)

- `transmission_line_distance` — access scoring / corridor context
- `usedesc` — too sparse for gating
- `insite_score` — opaque third-party summary; use for QA/context only, cuts against provenance-first posture
- Raw elevation values — useful to derive terrain flag, not a direct gate

#### Missing Value Policy

Because `zoning_type` is empty 32% of the time and `fema_flood_zone` is empty 47% of the time, **missing values must not silently pass**. Missing should become:

- Soft flag
- Confidence downgrade
- Manual-review trigger if the parcel is otherwise attractive

---

### 7. Anti-Double-Counting Variable Assignment

Each variable family has one primary surface. It can appear contextually on other surfaces but should not be primary in multiple places. Raw infrastructure is primary on Corridor; Parcel owns derived access metrics, not raw infrastructure.

| Variable family | Primary surface | Contextual on | Not primary / not scored on |
|---|---|---|---|
| Demand pressure (facility pipeline, expected MW, signed IA) | County | Parcel (market context) | Corridor |
| Competition intensity (provider entry, hyperscaler presence, density) | County | Parcel (market context) | Corridor |
| Supply timeline (queue probability, P10/P50/P90 forecast) | Corridor | County (feasibility badge/narrative, **not a ranking pillar**), Parcel (power-timeline narrative) | — |
| Grid friction (congestion, seam sensitivity, transfer constraints) | Corridor | County (flag only), Parcel (inherited feasibility note) | Parcel gate or independent parcel score |
| Raw transmission infrastructure | Corridor | County (narrative only) | Parcel |
| Raw fiber infrastructure | Corridor | County (narrative only) | Parcel |
| Raw gas infrastructure | Corridor (context-only in v1) | Parcel (context) | County |
| Corridor/hub access metrics (distance to corridor, hub, infra count within bands) | Parcel | Corridor | County |
| Flood/wildfire | Parcel | Corridor (route risk) | County ranking |
| Zoning/land use | Parcel | — | County, Corridor |
| Acreage/developability | Parcel | — | County, Corridor |
| Policy/governance | Policy-watch system | County (flag), Corridor (cross-jurisdiction friction), Parcel (friction flag) | — |

**Breaking change from current system:** County `supplyTimelineScore` and `gridFrictionScore` are demoted from ranking pillars to contextual feasibility badges. County market pressure ranking is driven only by demand, competition, absorption, and momentum.

---

### 8. Normalization Strategy

#### Two-Layer Design

County normalization uses two separate layers to prevent tier instability:

1. **Fixed calibration peer group** — determines the tier. Uses within-grid structural peers by default, fallback within-state if peer set is too thin, fallback national only if needed.
2. **User-switchable comparison lens** — determines the displayed rank/percentile. Users can toggle between within-grid, within-state, and national.

#### What switches change vs. what stays fixed

| Changes with lens switch | Does NOT change with lens switch |
|---|---|
| Percentile rank | Tier assignment |
| Rank order among displayed counties | Primary badge |
| Comparison distribution charts | Shortlist eligibility logic |
| Narrative phrasing (e.g., "strong within ERCOT peers, average nationally") | — |

#### Tier Labels

Since county is now market-pressure-only (supply timeline and grid friction demoted), the tier labels should reflect market pressure, not feasibility. Rename from `advantaged / balanced / constrained / blocked` to market-pressure language:

- **High pressure** (formerly advantaged)
- **Above-peer** (new)
- **Balanced** (unchanged)
- **Low-signal** (formerly constrained/blocked combined)

"Constrained" and "blocked" are reserved for corridor-feasibility judgments.

#### Absolute Guardrails

Tiers are not pure percentile buckets. Guardrails prevent false elites and false quiets. See Locked Design Decisions section 12 for the full tier assignment mechanics.

---

### 9. Policy/Governance System

#### Architecture: Three-Layer Source Model

The policy system is both event-based and condition-based, with a derived posture layer:

1. **Policy conditions** = standing jurisdiction facts with effective periods
2. **Policy events** = discrete dated changes, proposals, or actions with lifecycle states
3. **Policy posture snapshots** = derived current siting implication from conditions + active events

#### policy_condition

Standing facts about a jurisdiction:

- `condition_id`, `jurisdiction_id`, `jurisdiction_level` (state, county, municipality, parcel-overlay district)
- `condition_family` (incentives, utility structure, zoning posture, permitting, environmental overlay, tax, retail choice, moratorium status)
- `condition_type`, `value_type` (boolean, enum, numeric, text), `value`
- `direction` (supportive, restrictive, mixed, neutral, unknown)
- `materiality`, `effective_from`, `effective_to`
- `status` (active, inactive, superseded, pending-verification)
- `reassessment_due_at`, `evidence_summary`, `confidence`, `source_refs`
- `derived_from_event_id` (nullable)

Examples: `retail_choice = true`, `data_center_sales_tax_exemption = active`, `moratorium_status = active`

#### policy_event

Discrete changes or actions:

- `event_id`, `jurisdiction_id`, `jurisdiction_level`
- `event_family` (legislation, zoning, litigation, incentive, utility filing, public opposition, permitting)
- `event_type`, `title`, `description`
- `event_date`, `announced_at`, `effective_from`, `effective_to`
- `lifecycle_state` (proposed, introduced, hearing-scheduled, approved, denied, enacted, appealed, enjoined, expired, withdrawn, resolved)
- `direction` (supportive, restrictive, mixed, uncertain)
- `materiality`, `affected_geographies`, `affected_asset_scope` (county-wide, district-specific, parcel-specific, corridor-crossing)
- `evidence_summary`, `confidence`, `source_refs`
- `creates_or_updates_condition_id` (nullable)
- `supersedes_event_id` (nullable)

#### policy_posture_snapshot

Derived, computed, time-aware — this is what the product mostly consumes:

- `posture_snapshot_id`, `jurisdiction_id`, `as_of_date`
- `baseline_posture` (supportive, mixed, restrictive, uncertain)
- `active_restrictive_conditions`, `active_supportive_conditions`
- `active_material_events_count`, `recent_change_score`
- `confidence`, `top_drivers`, `source_lineage`

#### Interaction Rules

- Events can create, modify, or terminate conditions.
- Conditions describe what is currently true.
- Posture snapshots summarize current truth plus recent change pressure.

#### Event Threshold

A candidate becomes an event only if it is: an official legislative/regulatory/judicial/zoning action, a formally scheduled public process, a filing with legal or permitting consequence, a structured opposition action tied to a formal process, or a major corporate/utility filing affecting the siting process. Otherwise it remains evidence attached to a condition, an analyst note, or a low-signal watch item.

#### Primary Data Source

**EQ Research** (commercial, procurement approved) is the primary source for `policy_event` and `policy_condition` objects. EQ Research tracks energy and utility policy across jurisdictions. On receipt of access:

1. Evaluate coverage of data-center-relevant legislation, moratoria, incentives, and utility filings.
2. Map EQ Research event types to the `event_family` and `lifecycle_state` enums defined above.
3. Map EQ Research jurisdiction coverage to the `jurisdiction_level` taxonomy (state, county, municipality).
4. Identify gaps that still require manual analyst curation (likely: hyper-local zoning actions, opposition events, parcel-specific rezoning).

**DSIRE and NCSL** are demoted to supplementary/validation sources, not primary. They remain useful for incentive program context and state-level legislative tracking where EQ Research coverage is thin.

#### How Policy Feeds Each Surface

- **County surface**: posture snapshot as contextual flag + recent material events in "what changed" — not part of ranking.
- **Corridor surface**: cross-jurisdiction policy posture along the corridor, active events affecting corridor counties, permitting/governance friction notes.
- **Parcel surface**: parcel/jurisdiction conditions, local zoning and governance conditions, active rezoning/litigation/moratoria/opposition events, friction flags in the pre-diligence packet.
- **Policy-watch system**: primary home — event timeline, condition map, posture changes, evidence and confidence drill-down.

---

### 10. Parcel Packet Export

#### Architecture: One Canonical Packet Object With Multiple Renderers

The parcel pre-diligence packet is a **versioned packet object**, not a file type. It contains all analyst-grade data and renders into different formats for different audiences.

#### Audience Hierarchy

| Audience | Priority | Format | Notes |
|---|---|---|---|
| **Internal analyst** | Primary | In-app detail view, JSON export, spreadsheet export | Full gate logic, raw values, confidence details, source lineage, review notes |
| **Sales/BD** | Secondary (derived) | 3-6 page reviewable PDF brief | Polished but caveated, map-heavy, concise narrative, "what this does/does not mean" |
| **Client/prospect** | Controlled derivative (not v1 default) | PDF with executive summary + appendix | Requires analyst review or "external-safe mode" before export |

#### Canonical Packet Object Sections

1. **Packet metadata**: version, run timestamp, archetype, registry version
2. **Parcel summary**: identity, location, acreage, ownership, zoning
3. **Gate results**: three-tier outcomes (pass/fail/review-required) with archetype-specific thresholds
4. **Access metrics**: distance to nearest corridor, hub, transmission line; infrastructure type count within 1/3/5mi
5. **County market context**: market pressure tier, catchment-adjusted score, top drivers
6. **Corridor feasibility context**: serving corridors/hubs, supply timeline narrative, grid friction note
7. **Policy/governance flags**: active conditions, material events, posture summary
8. **Power-timeline narrative**: probabilistic supply forecast with P10/P50/P90 bands and caveats
9. **Confidence/provenance appendix**: per-section confidence vectors, source registry references, freshness states
10. **Maps/assets**: embedded location map, corridor/infrastructure overlay, flood/environmental overlay

#### Truth Rule

External PDF output must never exceed the truth standard of the internal packet:

- If a parcel is Review Required, the PDF must say that.
- If flood/zoning is missing, the PDF must say that.
- If corridor access depends on Tier B sources, the PDF must say that.
- If the power narrative is probabilistic screening, the PDF must say that.

No sales polish erases the caveats.

---

### 11. County Market Pressure Index — Scoring Model

#### Index Structure

The county market pressure index is a **transparent weighted composite of four family subscores**:

| Family | Weight | Primary signals |
|---|---|---|
| **Demand pressure** | 35% | `expectedMw0To24m` (50%), `signedIaMw` (30%), discounted `expectedMw24To60m` (20%) |
| **Absorption / tightness** | 30% | Absorption (45%), inverse vacancy (35%), leased/occupied MW growth (20%) |
| **Momentum** | 20% | `demandMomentumQoq` (50%), `recentCommissionedMw24m` (30%), transaction/development acceleration (20%) |
| **Competition intensity** | 15% | `providerEntryCount12m` (50%), hyperscaler presence/entry (30%), provider density/diversity capped (20%) |

#### Pipeline

1. Build catchment-adjusted raw features for eligible market-pressure variables.
2. Transform: `log1p` on MW/count variables, winsorize extremes, convert to rates/ratios using existing market base, invert vacancy.
3. Normalize each transformed feature against the fixed calibration peer group.
4. Compute family subscores.
5. Compute composite index as weighted sum of family subscores.

#### Design Rules

- **Raw facility counts and installed MW are not standalone positive drivers.** Use them as denominators for growth/intensity ratios, scale anchors, minimum-signal filters, and narrative context. This prevents the index from just rewarding big legacy markets.
- **Absorption/vacancy from market/metro grain** is usable via county-to-market mapping, but with lower method confidence and capped influence.
- **Weights are fixed, versioned, and analyst-governed** — empirically informed, not machine-learned end-to-end. Changes require review. Quarterly or semiannual recalibration is acceptable.
- Weights are calibrated using: forward validity against later commissioning/provider entry/transaction activity, rank stability over time, analyst sanity checks, peer-group robustness tests.

---

### 12. Tier Assignment Mechanics

#### Three-Step Process

##### Step 0: Scorability Check

Before assigning any tier:

- If county confidence/coverage/freshness trips suppression rules → **do not assign a tier**.
- Show "Insufficient signal" or suppress the badge entirely.
- This keeps weak-data counties from being mislabeled as Low-signal.

##### Step 1: Provisional Percentile Tier

Using the weighted county market-pressure index and the fixed calibration peer group:

- **High pressure**: >= 80th percentile
- **Above-peer**: 50th to <80th percentile
- **Balanced**: 20th to <50th percentile
- **Low-signal**: <20th percentile

These are provisional only.

##### Step 2: Apply Guardrails

**High-pressure floor** — a county can only remain High pressure if ALL of:

- County confidence is at least medium; no active suppression.
- Near-term demand floor: `expectedMw0To24m` or `signedIaMw` exceeds a configured absolute minimum.
- Breadth floor: at least one additional nontrivial signal from absorption/tightness, recent activity/momentum, or competition.
- Multi-family rule: at least 2 of 4 family subscores are meaningfully positive.
- Locality floor: the score is not driven primarily by inherited market-level context; a majority of effective signal should come from county/catchment-native features.

If a county is top-20% by percentile but fails these floors → **demoted to Above-peer**.

**Low-signal ceiling** — a county can only be Low-signal if ALL of:

- Percentile is <20th.
- `expectedMw0To24m` and `signedIaMw` are both below floor.
- `recentCommissionedMw24m`, momentum, and absorption/tightness are all below floor.
- Provider-entry / hyperscaler signal below floor.
- No strong absolute signal that would make "Low-signal" misleading.

If a county lands in the bottom 20% but clears any strong-activity floor → **promoted to Balanced**.

**Confidence cap** — even if percentile and raw inputs are strong:

- Low confidence can cap the county at Above-peer.
- Critical missingness / staleness suppresses tier assignment entirely.

#### Threshold Governance

Absolute floor values (MW minimums, count minimums) are:

- Stored in versioned config alongside the scoring weights.
- Calibrated from actual county feature distributions.
- Reviewed periodically with analyst input.
- Not re-fit continuously.

---

### 13. Story System Evolution

#### From County-Native Story Types To Surface-Native Story Families

The existing four story types evolve into three top-level story families aligned to the three-surface architecture:

| Current story type | Action | New name | New home |
|---|---|---|---|
| `market-structure` | Keep, rename | `market-pressure` | County surface |
| `grid-stress` | Rehome, rename | `grid-friction` (corridor subtype) | Corridor surface |
| `queue-pressure` | Rehome, rename | `supply-timeline` (corridor subtype) | Corridor surface |
| `policy-watch` | Keep as user-facing family, replatform on policy condition/event/posture system | `policy-watch` | Policy-watch system |

#### Three Top-Level Story Families

1. **Market pressure** — County-native. Absorbs demand, competition, absorption, momentum, and catchment-adjusted delta. Catchment is a lens within this family, not a separate top-level story.
2. **Corridor feasibility** — Corridor-native. Subtypes: `supply-timeline`, `grid-friction`, optionally `infrastructure-composition` later. Counties receive contextual badges/narrative only.
3. **Policy watch** — Policy-system-native. Replatformed on the condition/event/posture model. Renders event timelines, condition maps, and posture changes.

#### Story Engine Changes

The story engine should stop assuming county polygon geometry, one activity score, one universal time window, and one universal renderer. Each story family declares:

- **Primary geometry**: county / corridor / hub / jurisdiction
- **Time basis**: change window / forecast horizon / effective period
- **Primary metric type**: pressure / friction / timeline / posture
- **Renderer**: county fill / corridor ribbon / hub marker / timeline panel

#### Time Semantics By Family

- **Market pressure**: `live / 30d / 60d / 90d` (change windows — unchanged)
- **Grid friction**: recent-change windows (similar to current)
- **Supply timeline**: primary time basis is **forecast horizons**: `0-24m / 24-60m / 60m+` — not "last 30 days"
- **Policy watch**: `30d / 60d / 90d` change windows + event timelines

---

## Feature Strategy And Analyst Workflows

### County Catchment Market Pressure 2.0

**Decision question:** If I shortlist this county, what is the effective market pressure in the surrounding catchment?

**Correct grain:** county plus adjacency graph, optionally with drive-time or corridor-based catchment overlays.

**Computation model:** See Locked Design Decisions section 2.

**Key build:** use Census shared-boundary length for shared-edge weighting and explicit point-touch rules:

- Shared-edge neighbors are eligible for spillover using length-weighted logic.
- Point-touch neighbors are excluded or heavily downweighted for infrastructure-friction metrics.
- Point-touch neighbors can be weakly included for competition and demand-pressure metrics where that is analytically defensible.

**UX:** county score plus catchment-adjusted score, catchment halo, delta mode, neighbor contribution cards, and toggles for edge-only versus include-point.

**QA:** verify adjacency symmetry, protect against corner-case domination, and version the adjacency graph by Census vintage.

### Corridor Feasibility System

This is one system with several tightly related modules, not three unrelated product ideas.

It should combine:

- derived corridor and hub geometries (see Locked Design Decisions section 1),
- probabilistic supply timeline (see Locked Design Decisions section 3),
- seam-aware grid friction,
- multi-infrastructure corridor access,
- transmission context,
- fiber resilience and route diversity context,
- gas context (context-only, not corridor-defining in v1).

#### Seam-Aware Grid Friction Lens

**Decision question:** If I choose this county, am I functionally inside a constrained pocket or seam-sensitive geography?

**Correct grain:** multiple grid boundary sets, not county alone.

**Important context:** eGRID subregions are explicitly representational and approximate, while other boundary families vary in quality and should be confidence-rated rather than treated as equally approximate.

**Build:** a seam-aware transfer-friction representation that ties:

- seam geometry,
- congestion observations,
- transmission planning stress,
- reliability or large-load pocket evidence,
- confidence in boundary truth.

**Visualization:** friction ribbons, corridor bands, time-window intensity, and a visible "boundary confidence" treatment.

#### Substation Handling Without Overclaiming

**Policy:**

- treat substations and POIs as context anchors,
- use them to frame nearby corridor and transmission opportunity,
- show screening-only indicators where operator evidence exists,
- never generalize to "available MW" unless the evidence truly supports it.

Substations belong in expert mode and parcel pre-diligence context, not as a broad county promise.

#### Fiber Intelligence That Is Actually High-Signal

**Decision question:** Can this site or market achieve genuine connectivity resilience and procurement flexibility?

**Correct grain:** corridor or network plus parcel/site.

**High-signal features:**

- fiber diversity index,
- number of distinct nearby long-haul routes,
- distance to carrier hotels and IXPs,
- route-diversity proxy,
- corridor vulnerability to shared hazards,
- operator independence and shared-infrastructure risk.

#### Natural Gas Context

Gas should remain a tightly scoped context module, not corridor-defining:

- use EIA/BTS interstate/intrastate pipeline data as the national gas-context layer,
- flag relevant transmission or storage proximity,
- keep clear "reference-only" language where public-source constraints apply,
- do not turn gas into a corridor-defining input until better geometry is available (NPMS via government sponsor, or commercial gas linework),
- **East Daley** (gas pricing and utilization data) is under evaluation but not yet approved. If approved, it would enrich the gas context layer with pricing/utilization signals but would not change the corridor derivation spec (gas remains Tier C / context-only).

### Policy, Legislation, And Local Governance Friction

**Decision question:** Will this geography become hostile or supportive to data center development?

**Correct grain:** state for broad policy, county and municipal for local friction, parcel for compliance.

**Operational system:** event objects with:

- timeline,
- scope,
- direction,
- confidence,
- evidence,
- siting implication.

**Automation vs curation:**

- EQ Research as primary automated feed for state-level and major regulatory events,
- DSIRE and NCSL as supplementary state-level feeds,
- analyst curation for hyper-local zoning, moratoria, rezonings, lawsuits, and opposition that commercial feeds don't cover.

### Parcel Pre-Diligence Packet

**Decision question:** What should a serious first-pass pre-diligence packet contain?

**Packet contents:**

- county and corridor context,
- three-tier gating results (pass/fail/review-required) with archetype-specific acreage thresholds,
- net buildable acreage and exclusions,
- flood and environmental flags (not hard gates unless verified),
- infrastructure access summary (distance to nearest corridor, distance to nearest hub, transmission line distance),
- probability-based power narrative from supply timeline model,
- provenance and confidence appendix with source registry references.

### Utility And Process Dossiers

**Decision question:** What is the real process posture of the utility or operator behind this market?

This should become an analyst-first, curated surface covering:

- interconnection posture,
- large-load process specifics,
- tariff or manual nuances,
- study cadence or screening behavior,
- expert notes.

## Source Strategy And Moat Strategy

### Source Registry

The Source Registry is a hybrid system, not a single artifact. Source definitions and downstream dependency rules are versioned with code and reviewed as part of product governance. Runtime source state — including latest ingest, freshness, completeness, health, and access status — is stored in database tables and joined at scoring time. Every scoring run pins a registry version and source-version set so outputs are reproducible and auditable.

See Locked Design Decisions section 4 for the full four-entity architecture.

## Source Matrix

| Layer family | Source | Source class | Public vs paid | Coverage and grain | Cadence | Caveats | Precision tier | Best fit | Moat contribution |
|---|---|---|---|---|---|---|---|---|---|
| County geometry | Census TIGER/Line | Government primary | Public | National, legal boundaries | Annual | Must version boundary changes | A | County | Low |
| County adjacency | Census County Adjacency File | Government primary | Public | National adjacency graph, shared-edge plus point-touch | Periodic | Point-touch exists, length is critical | A | County and catchment | Medium |
| Queue data (primary) | Interconnection.fyi | Commercial licensed | Paid (approved) | National, project-level, multi-ISO/RTO | Near-real-time | Pending access — evaluate schema and coverage on receipt | A (expected) | Supply timeline model | High through modeling |
| Queue synthesis (calibration) | Berkeley Lab Queued Up | Nonprofit research | Public | National, project-level, 7 ISOs + 49 non-ISO BAs | Annual | Realization is low and probabilistic; through end-2024 | A | Historical calibration and backtesting | High through modeling |
| Realized generation | EIA-860 / EIA-860M | Government primary | Public | Generator-level | Annual + monthly | Monthly is more provisional | A | County and catchment | Medium |
| Transmission lines | HIFLD | Government-distributed aggregate | Public (fragile post-HIFLD-Open) | National corridor and line context | Periodic | No formal horizontal accuracy report; tier by VAL_METHOD; source dates through mid-2022 | B | Corridor-defining | Medium |
| Substations | HIFLD electric substations | Government-distributed aggregate | Restricted | National | Restricted | Cannot assume open or durable access | B | Hub input | Medium-High if curated |
| Retail territories | HIFLD retail service territories | Government-distributed aggregate | Public | National polygons | Periodic | Not always complete or canonical | B | County and corridor | High if validated |
| Gas pipelines | EIA/BTS interstate/intrastate | Government primary | Public | Network, US polyline | Updated 2020, attributes through 2024 | Better than GEM but still not ROW-grade geometry | C | Context-only | Low-Medium |
| Fiber routes | FiberLocator (CCMI) | Commercial licensed | Paid | Carrier-level, street-level | Monthly-quarterly | Pre-qualification, not engineering-level | B | Corridor-defining | High (owned advantage) |
| Flood hazard | FEMA NFHL | Government primary | Public | National, multi-scale | Continuous | Preliminary vs effective matters | A | Parcel gate (strong review, not auto-exclude) | Medium |
| Wildfire hazard | USDA WHP | Government primary | Public | National raster | Periodic | Planning tool, not forecast | A | County and corridor gate | Medium |
| Policy events/conditions (primary) | EQ Research | Commercial licensed | Paid (approved) | Energy/utility policy tracking | Ongoing | Pending access — evaluate coverage of DC-relevant legislation and local governance | N/A | Policy system primary source | High |
| Policy and incentives (supplementary) | DSIRE API | Commercial licensed | Paid | National program-level | Frequent | Needs interpretation for DC siting | N/A | Supplementary policy context | Medium |
| Legislation (supplementary) | NCSL database | Nonprofit research | Public | State-level | Daily-to-weekly | State, not local; verify cadence | N/A | Supplementary state-level context | Low-Medium |
| Pipeline corridors (detailed) | PHMSA / NPMS | Government primary | Restricted | Network | Periodic | ±500 feet minimum accuracy; restricted to government/operators/sponsored contractors | C | Not corridor-eligible | Low unless partnered |
| Grid subregions | EPA eGRID mapping | Government primary | Public | National subregions | Periodic | Representational and approximate | C | Context and seams | Low |
| Parcels | Regrid | Commercial licensed | Paid | National, 24.6M parcels, 55 states/territories | Ongoing | 150+ attrs per parcel; zoning empty 32%, flood empty 47% | A (geometry), variable (attrs) | Parcel gating and pre-diligence | High |

### Data Acquisition Priorities

**Buy first:** Better power/gas linework (MAPSearch, S&P Global) — geometry fidelity is the limiting factor for corridor derivation.

**Evaluate:** GeoTel (fiber benchmark vendor), Regrid Roadway ROW (corridor context), LightBox SmartFabric (connected parcel fabric with zoning).

**Pursue:** NPMS access via government sponsor path for higher-fidelity gas pipeline geometry.

**Override nationally:** State/local transmission layers where available (Oregon traced from orthoimagery/lidar, California CEC transmission lines) for priority markets.

## What To Buy Vs Build Vs Derive Vs Curate

### Buy

- parcels, ownership, zoning, and parcel attributes (Regrid — already acquired),
- long-haul fiber routes and carrier hotels (FiberLocator — existing relationship),
- premium connectivity and interconnection datasets,
- curated utility-territory truth where needed,
- production-grade energy linework (MAPSearch, S&P Global) for corridor derivation.

### Build And Derive

- corridor and hub geometries from infrastructure layer overlaps,
- county and catchment rollups with raw-input pooling,
- probabilistic queue-to-timeline competing-risks survival model,
- seam friction layers,
- parcel three-tier gate logic with archetype-specific thresholds,
- confidence DAG with propagation and local operators,
- change detection and diff views.

### Curate

- seam and subregional truth sets,
- utility-territory corrections,
- local policy and governance event objects,
- interpretation rules for grid friction,
- operator/process dossiers,
- corridor validation against orthophotos in priority markets.

## Scoring, Modeling, And Confidence Strategy

### What To Actually Ship

Ship a two-layer surface:

1. A truth-safe tier model using market-pressure labels (High pressure / Above-peer / Balanced / Low-signal) assigned by fixed calibration peer groups with absolute guardrails.
2. A transparent relative index within tiers (the weighted four-family composite), always paired with confidence, coverage, and suppression rules.

This keeps the visible product interpretable while still leveraging richer modeling internally. See Locked Design Decisions sections 11 and 12 for the full scoring model and tier assignment mechanics.

### Normalization

See Locked Design Decisions section 8 for the full two-layer normalization design. Key points:

- Fixed calibration peer group (within-grid structural peers) assigns the tier.
- User-switchable comparison lens (within-grid, within-state, national) changes rank/percentile only.
- Tier never changes when the user switches lenses.
- Absolute guardrails prevent false elites in weak peer groups and false quiets in hot peer groups.

### Neighbor Spillover Logic

See Locked Design Decisions section 2 for the full catchment specification.

### Anti-Double-Counting Rule

See Locked Design Decisions section 7 for the full variable-to-surface assignment table. Key breaking change: supply timeline and grid friction are demoted from county ranking pillars to contextual feasibility badges. County market pressure is driven only by demand, competition, absorption, and momentum.

### Parcel Aggregation

Do not rely on county centroids for parcel rollups. Prefer:

- distance to nearest corridor and hub,
- corridor-aware reachability,
- drive-time or cost-distance approaches where appropriate.

### Missingness, Staleness, And Suppression

See Locked Design Decisions section 5 for the full confidence system architecture.

### County Market Pressure Index

See Locked Design Decisions section 11 for the full scoring model: four family subscores (demand pressure 35%, absorption/tightness 30%, momentum 20%, competition intensity 15%), transformed and normalized against the calibration peer group, with analyst-tuned versioned weights.

### Tier Assignment

See Locked Design Decisions section 12 for the full three-step process: scorability check, provisional percentile tier, then guardrail application (high-pressure floor, low-signal ceiling, confidence cap).

## UX And Storytelling Strategy

### Story System

See Locked Design Decisions section 13 for the full story system evolution. Key changes:

- Three top-level story families: market pressure (County), corridor feasibility (Corridor), policy watch (Policy system).
- `market-structure` renamed to `market-pressure`, stays on County, absorbs catchment as a lens.
- `grid-stress` and `queue-pressure` rehomed to Corridor surface as subtypes.
- `policy-watch` replatformed on the condition/event/posture system.
- Each story family declares its own geometry, time basis, metric type, and renderer.
- Supply timeline uses forecast horizons (0-24m / 24-60m / 60m+), not change windows.

### County Triage UX

The county surface should feel like a triage board plus map, not just a choropleth:

- market-pressure tier (High pressure / Above-peer / Balanced / Low-signal),
- top drivers from the four family subscores,
- confidence badge,
- 30/60/90-day deltas,
- catchment-adjusted market pressure with delta,
- top 3 contributing neighbors with contribution breakdown,
- edge-only vs include-point toggle,
- comparison lens switcher (within-grid / within-state / national) — changes rank/percentile only, not tier,
- supply timeline and grid friction as contextual badges/narrative (not ranking inputs),
- policy posture flag from the policy-watch system,
- shortlist workflows.

### Corridor And Seam UX

Use a corridor lens toggle that shifts the experience from counties to feasibility-aware geography:

- corridor ribbons with infrastructure composition labels and confidence,
- hub markers with convergence characteristics,
- corridor-feasibility story subtypes: supply-timeline (with forecast horizons) and grid-friction,
- seam ribbons,
- corridor bands,
- evidence and confidence breakdowns,
- representational warnings,
- cross-jurisdiction policy friction context,
- drill-down from corridor to parcels within access range.

### Parcel Handoff UX

Support one-click packet generation with:

- three-tier gate results (pass/fail/review-required) clearly labeled,
- archetype-specific thresholds visible,
- parcel summary with acreage, zoning, flood status,
- exclusion overlays,
- corridor/hub access metrics (distance to corridor, hub; infra count within bands),
- inherited grid-friction and supply-timeline context from corridor surface,
- policy/governance friction flags from the policy system,
- power-timeline probability narrative with P10/P50/P90 bands and caveats,
- provenance appendix with source registry references.

See Locked Design Decisions section 10 for the full packet architecture: one canonical packet object with analyst-primary design, multiple renderers (in-app, JSON, spreadsheet, reviewable PDF brief).

### Analyst Workflow UX

Support saved market theses, contradiction tracking, and audit-ready exports. The product should feel like a decision instrument, not a generic map UI.

### Sales Storytelling UX

Support exportable story-mode decks and high-integrity explanation packets for external discussions. Sales/BD PDF is derived from the analyst packet — same canonical object, lighter renderer. External truth standard never exceeds internal packet.

## Technical And Operational Implications

### Source Registry

See Locked Design Decisions section 4 for the full four-entity architecture.

### Snapshotting

Extend the existing run/version model toward:

- per-metric confidence (using the confidence DAG),
- per-metric staleness (from source_runtime_status),
- diff snapshots,
- "what changed" explanations between runs.

### QA And Backtesting

Add:

- queue-to-COD backtesting (validate competing-risks model against held-out Berkeley data),
- demand realization backtesting,
- corridor derivation validation against orthophotos (NAIP via Planetary Computer),
- seam-model validation,
- environmental gate validation,
- source-fragility monitoring (especially HIFLD post-discontinuation),
- metric drift detection.

### Contracts And APIs

Treat provenance-first contracts as a strategic asset. Over time, county intelligence, corridor feasibility, and parcel pre-diligence should all be API-grade products.

## What To Validate With Internal Experts

### Requires Expert Confirmation

- which seams and subregional boundaries are operationally meaningful,
- what should count as a defensible grid-friction indicator,
- where automation breaks down,
- how to interpret edge cases across markets,
- corridor validation: initial 5-market validation complete (strong pass). Ongoing morphology-expansion program required — validate new market types (rural long-haul, mountain pass, coastal, industrial brownfield) before inheriting the same confidence level as tested markets.

### Can Be Automated With Guardrails

- Census-based adjacency spillover with raw-input pooling,
- queue probability framework (competing-risks survival model),
- corridor derivation from buffered infrastructure overlaps,
- change detection,
- confidence DAG propagation,
- source registry enforcement,
- tier assignment with percentile bands + guardrail application,
- four-family market pressure index computation,
- policy posture snapshot derivation from conditions + events,
- parcel packet assembly from canonical object schema.

### Needs Expert-Curated Geometry

- ISO/RTO subregions not cleanly published,
- congestion zones and interfaces,
- utility-territory truth corrections,
- high-value seam and corridor overlays.

### Must Remain Caveated Even After Review

- any available-capacity depiction not directly backed by operator-confirmed assumptions,
- gas corridor conclusions derived from restricted or reference-only public inputs,
- approximate public boundary sets presented as engineering truth,
- corridor geometries derived from Tier B sources without empirical validation.

## What To Avoid

- available-MW maps at county or substation level without defensible operator assumptions,
- equating substation proximity with deliverability,
- opaque black-box scoring as the main product surface,
- silently rewarding counties that just have more data,
- generic GIS clutter that answers no specific siting question,
- hiding caveats on reference-only or approximate datasets,
- averaging neighbor pillar scores for catchment rollups (use raw-input pooling instead),
- multiplying resolver_confidence into the primary supply timeline estimate (keep as separate layer),
- treating missing flood/zoning data as a silent pass (missing = confidence downgrade + review trigger),
- using a single global buffer distance for corridor derivation (use source-pair-specific precision tiers),
- making GEM or OpenInfraMap the primary source for corridor-defining geometry (too coarse),
- using supply timeline or grid friction as county ranking inputs (they are corridor-primary, county-contextual only),
- letting raw infrastructure variables be primary on both Corridor and Parcel (raw infra is Corridor-primary; Parcel owns derived access metrics),
- letting tier assignment change when the user switches comparison lenses (tier is fixed by calibration peer group),
- using pure percentile tiers without absolute guardrails (prevents false elites in weak peer groups and false quiets in hot ones),
- using ML-learned county scoring weights without analyst governance and version control,
- making the parcel packet a file format instead of a versioned packet object with multiple renderers,
- letting sales/external PDF output exceed the truth standard of the internal analyst packet,
- treating every local news article as a policy event (use the formal-action threshold filter),
- forcing all story types into the same county-polygon / live-30-60-90 grammar (corridor stories need different geometry and temporal semantics).

## Top 15 Actions

1. Make the product hierarchy explicit everywhere: county = where to look, corridor/utility/seam = whether it is plausible, parcel = what survives first-pass diligence.
2. Implement adjacency spillover using Census shared-boundary length, explicit point-touch policy by metric family, and raw-input pooling for market-pressure features only.
3. Build the corridor-feasibility system: derive corridor and hub geometries from infrastructure overlaps at ROW scale, with source-pair-specific precision tiers and validation gating.
4. Build the probabilistic supply timeline using interconnection.fyi as the primary queue data source and Berkeley Lab's project-level dataset as historical calibration corpus, for a competing-risks survival model with P10/P50/P90 bands.
5. Create the Source Map Registry as a four-entity hybrid system (definition, version, runtime status, dependency rules) with repo-defined semantics and DB-backed runtime state.
6. Ship the confidence DAG: propagation backbone with local confidence operators at every transformation level, structured per-object confidence vectors, and suppression rules tied to source registry.
7. Ship parcel pre-diligence with three-tier gating (hard exclude, strong review, soft flag), archetype-specific acreage thresholds, pass/fail/review-required outcomes, and missing-value policies.
8. Build the county market pressure index as a transparent weighted composite of four family subscores (demand 35%, absorption 30%, momentum 20%, competition 15%) with analyst-tuned versioned weights. Demote supply timeline and grid friction from county ranking to contextual badges.
9. Implement tier assignment with fixed calibration peer groups, absolute guardrails (high-pressure floor, low-signal ceiling, confidence cap), and market-pressure-appropriate labels.
10. Implement two-layer normalization: fixed calibration tier + user-switchable comparison lens (within-grid / within-state / national) that changes rank but never tier.
11. Enforce the anti-double-counting variable assignment table: raw infrastructure primary on Corridor, derived access metrics primary on Parcel, demand/competition primary on County.
12. Build the policy system as conditions + events + derived posture snapshots, with EQ Research as the primary event/condition feed. Replatform the `policy-watch` story type on this system.
13. Evolve the story engine to three surface-native families (market-pressure, corridor-feasibility, policy-watch), each with its own geometry, time basis, and renderer. Use forecast horizons for supply-timeline stories.
14. Ship the parcel packet as one canonical versioned object with analyst-primary design and multiple renderers (in-app, JSON, spreadsheet, reviewable PDF brief).
15. Lock the seam, zone, and interpretability truth set with internal domain experts and make that curation part of the moat. Maintain an ongoing corridor morphology-expansion validation program for new market types.

## Final Recommendation

If datacenterHawk wants this system to become a strategic advantage, it should build the `county -> corridor -> parcel` decision pipeline around probabilistic grid friction, operator-aware geography, connectivity topology, governance intelligence, and high-integrity provenance and confidence UX.

That is the version of the map that becomes hard to replicate. It matches the reality of screening tools, interconnection uncertainty, operator caveats, large-load planning, and the limits of public data. It gives users better answers without pretending the map knows more than the evidence can support.

The near-term strategic edge is to fuse analyst-led market intelligence and transaction context with CCMI/FiberLocator connectivity data before energy-first rivals fuse in equivalent real-estate truth. That is the cleanest owned advantage in the current convergence window.
