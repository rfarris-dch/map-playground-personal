# MP-47 - Source Registry MVP Cut

**Status:** Proposed for approval  
**Date:** 2026-03-26  
**Document type:** Contract-freeze spike output  
**Primary owners:** Engineering, Product, Research/Analytics  
**Related work:** `MP-43`, `MP-44`, `MP-53`, `MP-56`, `MP-58`, `next-phase.md`, `mp-44-launch-policy.md`

## 1. Purpose

This document freezes the minimum viable Source Registry contract for v1. It is intentionally narrow. The goal is to give downstream implementation tickets one stable schema, one stable runtime surface, and one explicit list of deferred metadata so the registry does not balloon into a lineage platform.

The Source Registry remains a hybrid repo + database system:

- repo-versioned semantics and downstream rules,
- mutable runtime source state in the database,
- reproducibility through `registry_version` plus source-version stamping in downstream publications.

## 2. MVP Cut

### In scope

- exact column-level contract for:
  - `registry.source_definition`
  - `registry.source_version`
  - `registry.source_runtime_status`
  - `registry.source_dependency_rule`
- exact runtime views consumers may read:
  - `registry.active_sources`
  - `registry.current_source_status`
  - `registry.downstream_rules`
- repo seed artifacts for definitions, versions, and dependency rules
- explicit deferred-metadata list
- publish/materialization pattern for `registry_version`
- five concrete review examples

### Out of scope

- ingestion orchestration
- runtime-status history tables
- field-level lineage
- alerting dashboards
- analyst UI
- scoring-model rewrites
- packet renderer changes
- a fifth "registry publication" entity

## 3. Binding Design Decisions

1. The schema is platform-generic. It must work for County, Corridor, and Parcel.
2. `source_definition`, `source_version`, and `source_dependency_rule` are repo-versioned contract entities.
3. `source_runtime_status` is the single mutable current-state entity.
4. `registry_version` belongs to the repo-versioned contract layer. It does not create a fifth publication table in v1.
5. Runtime reproducibility comes from downstream publications storing `registry_version` plus the selected `source_version_id` set.
6. Dependency rules are structured columns. The authoritative rule layer must not depend on prose notes or opaque JSON.
7. Base tables are publish artifacts. Application and scoring consumers read the runtime views only.

## 4. Seed Inventory Scope

The v1 seed set includes:

- all 31 rows from `planning/county-power/source-registry.csv`,
- plus 7 launch-critical or cross-surface additions:
  - `census-county-adjacency-2025`
  - `hifld-electric-substations`
  - `fiberlocator`
  - `regrid-parcels`
  - `eq-research`
  - `fema-nfhl`
  - `eia-bts-gas-pipelines`

Total `source_definition` seed rows: **38**.

The seed files live in this folder:

- `source-definitions-v1.csv`
- `source-versions-v1.csv`
- `source-dependency-rules-v1.csv`

Multi-value fields in those CSVs use pipe delimiters, for example `county|corridor`.

## 5. Rule Grammar

The structured rule grammar frozen for v1 is:

- `warn_if_days_stale`
- `degrade_if_days_stale`
- `suppress_if_days_stale`
- `suppress_if_missing`
- `precision_tier_c_allowed_for_primary`
- `allowed_roles`
- `requiredness`
- `truth_mode_cap`
- `confidence_cap`
- `surface_scopes`

This grammar is enough to operationalize the locked truths without expanding into a policy DSL.

## 6. Four-Table Contract

### 6.1 `registry.source_definition`

Purpose: stable description of what a source is, what surfaces it may support, and whether it is launch-critical.

| Column | Type | Notes |
| --- | --- | --- |
| `source_id` | `text` | Stable natural ID |
| `registry_version` | `text` | Publish version stamp |
| `source_name` | `text` | Human-readable label |
| `provider_name` | `text` | Provider or steward |
| `source_family` | `text` | Controlled vocabulary |
| `source_type` | `text` | Feed/storage type |
| `integration_state` | `text` | Current implementation posture |
| `owner_team` | `text` | Operational owner |
| `status` | `text` | `active`, `planned`, `deprecated`, `blocked` |
| `surface_scopes` | `text[]` | Allowed surfaces |
| `default_role` | `text` | `primary`, `contextual`, `validation`, `fallback` |
| `precision_tier` | `text` | `A`, `B`, `C` |
| `launch_criticality` | `text` | `blocking`, `gated`, `supporting`, `deferred` |
| `coverage_geography` | `text` | MVP keeps this coarse |
| `coverage_grain` | `text` | Human-readable grain |
| `geometry_type` | `text` | `tabular`, `point`, `line`, `polygon`, `edge` |
| `provider_update_cadence` | `text` | As-supplied cadence |
| `production_method` | `text` | `surveyed`, `digitized`, `reported`, `curated`, `modeled` |
| `evidence_type` | `text` | `observed`, `reported`, `curated`, `modeled`, `inferred` |
| `description` | `text` | Short use description |
| `known_gaps` | `text` | Required caveat field |
| `code_entrypoint` | `text` | Current or future integration entrypoint |
| `effective_from` | `date` | Registry effective date |
| `effective_to` | `date?` | Null when active |

Primary key: `(source_id, registry_version)`

### 6.2 `registry.source_version`

Purpose: approved provider vintages and internal version labels that downstream runs can pin.

| Column | Type | Notes |
| --- | --- | --- |
| `source_version_id` | `text` | Stable natural ID |
| `registry_version` | `text` | Publish version stamp |
| `source_id` | `text` | FK to `source_definition` |
| `provider_version_label` | `text` | Provider-facing or approved internal label |
| `source_as_of_date` | `date?` | Optional |
| `source_release_date` | `date?` | Optional |
| `schema_version` | `text` | Version of interpreted shape |
| `geographic_extent_version` | `text` | Extent/boundary stamp |
| `change_type` | `text` | `initial_seed`, `refresh`, `schema_drift`, `methodology_change`, `coverage_change`, `carry_forward` |
| `approval_status` | `text` | `approved`, `planned`, `deprecated`, `blocked` |
| `change_notes` | `text` | Short required explanation |
| `checksum_or_fingerprint` | `text?` | Optional |
| `effective_from` | `date` | Registry effective date |
| `effective_to` | `date?` | Null when active |

Primary key: `(source_version_id, registry_version)`

### 6.3 `registry.source_runtime_status`

Purpose: mutable operational status the app and scoring engine can join at runtime.

| Column | Type | Notes |
| --- | --- | --- |
| `source_id` | `text` | One row per source |
| `current_registry_version` | `text` | Active contract version |
| `current_source_version_id` | `text` | Active source version |
| `last_successful_ingest_at` | `timestamptz?` | Optional |
| `last_attempted_ingest_at` | `timestamptz?` | Optional |
| `latest_provider_update_seen_at` | `timestamptz?` | Optional |
| `freshness_as_of` | `timestamptz?` | Optional |
| `staleness_state` | `text` | `fresh`, `aging`, `stale`, `critical`, `unknown` |
| `ingestion_health` | `text` | `healthy`, `degraded`, `failed`, `not_run` |
| `access_status` | `text` | `accessible`, `cached_only`, `lost_access`, `pending_renewal`, `planned` |
| `runtime_alert_state` | `text` | `none`, `warning`, `blocking`, `investigating` |
| `record_count` | `bigint?` | Optional |
| `completeness_observed` | `numeric(5,4)?` | `0` to `1` |
| `geographic_coverage_observed` | `text?` | Optional |
| `license_expiration_date` | `date?` | Optional |
| `updated_at` | `timestamptz` | Defaults to `now()` |

Primary key: `source_id`

### 6.4 `registry.source_dependency_rule`

Purpose: structured downstream behavior for freshness, missingness, truth caps, and confidence caps.

| Column | Type | Notes |
| --- | --- | --- |
| `dependency_rule_id` | `text` | Stable natural ID |
| `registry_version` | `text` | Publish version stamp |
| `source_id` | `text` | FK to `source_definition` |
| `downstream_object_type` | `text` | `metric`, `feature`, `score`, `surface`, `packet_section`, `model_input` |
| `downstream_object_id` | `text` | Stable consumer ID |
| `role_in_downstream` | `text` | `primary`, `contextual`, `validation`, `fallback` |
| `requiredness` | `text` | `required`, `optional`, `enhancing` |
| `warn_if_days_stale` | `integer?` | Optional |
| `degrade_if_days_stale` | `integer?` | Optional |
| `suppress_if_days_stale` | `integer?` | Optional |
| `suppress_if_missing` | `boolean` | Hard missingness gate |
| `precision_tier_c_allowed_for_primary` | `boolean` | Usually `false` |
| `allowed_roles` | `text[]` | Allowed source roles |
| `truth_mode_cap` | `text` | `full`, `validated_screening`, `derived_screening`, `context_only`, `internal_only` |
| `confidence_cap` | `text?` | `high`, `medium`, `low` |
| `surface_scopes` | `text[]` | Surfaces where the rule applies |
| `geography_scope` | `text` | `national`, `market`, `state`, `utility`, `county`, `corridor`, `parcel` |
| `effective_from` | `date` | Registry effective date |
| `effective_to` | `date?` | Null when active |

Primary key: `(dependency_rule_id, registry_version)`

## 7. Frozen Runtime Views

Consumers may read these views only:

### `registry.active_sources`

Purpose: semantic + runtime join for the latest active `registry_version`.

Must expose at least:

- source identity and metadata from `source_definition`
- approved current source version from `source_version`
- current staleness, health, and access state from `source_runtime_status`

### `registry.current_source_status`

Purpose: direct operational state for launch gating and confidence/freshness logic.

Must expose at least:

- `source_id`
- `current_registry_version`
- `current_source_version_id`
- staleness, health, access, alert state
- latest ingest timestamps
- observed completeness and record count

### `registry.downstream_rules`

Purpose: structured dependency rules for scoring, rendering, and suppression.

Must expose at least:

- source identity
- downstream object identity
- role and requiredness
- stale/missingness thresholds
- truth-mode cap
- confidence cap
- applicable surfaces

## 8. Materialization Pattern

The publish flow is frozen as:

1. Repo-managed definitions, versions, and dependency rules are reviewed in source control.
2. A publish command validates those artifacts, stamps a new `registry_version`, and loads repo-versioned rows transactionally.
3. `source_runtime_status` remains mutable current state and is not republished from repo on every scoring run.
4. Runtime views resolve against the latest active `registry_version`.
5. Downstream run/publication metadata records:
   - `registry_version`
   - the effective `source_version_id` set

The first downstream persistence target should be the publication metadata path already anchored in:

- `scripts/sql/county-scores-schema.sql`
- `scripts/sql/refresh-county-scores.sql`

Adding `registry_version` there is follow-on implementation, not part of this spike.

## 9. Review Examples

The frozen contract must represent these examples cleanly:

| Example | Representation requirement |
| --- | --- |
| County adjacency | Primary source for county catchment logic with explicit point-touch caveat and stale thresholds |
| HIFLD transmission | Corridor-defining linework with truth caps and confidence limits |
| Gas pipelines | Context-only corridor input with Tier C blocked from primary use |
| Parcel zoning and flood | Missingness must trigger required review behavior rather than silent pass |
| Interconnection queue | Primary for probabilistic supply timeline, contextual only for county score semantics |

## 10. Codebase Touchpoints

This spike does not wire runtime behavior, but it freezes the handoff points:

- seed inventory precedent: `planning/county-power/source-registry.csv`
- decision tracking: `planning/county-power/decision-log.md`
- policy-contract precedent: `packages/http-contracts/src/analysis-policy-http.ts`
- launch-policy precedent: `packages/http-contracts/src/launch-policy-http.ts`
- publication metadata handoff: `scripts/sql/county-scores-schema.sql`
- eventual publisher/integration layer: `packages/ops/src/etl/*`

## 11. Done Means

MP-47 is done when:

- the 4-table schema is frozen,
- the 3 runtime views are frozen,
- the seed inventory is classified,
- deferred metadata is explicit,
- `registry_version` behavior is unambiguous,
- the five example cases pass review,
- later tickets can implement without reopening the contract.
