# MP-47 Decision Log Entry

**Date:** 2026-03-26  
**Status:** Proposed  
**Owners:** Robert Farris, Product, Research/Analytics

## Decision

Freeze the Source Registry MVP at 4 tables and 3 runtime views with:

- repo-versioned `source_definition`
- repo-versioned `source_version`
- mutable `source_runtime_status`
- repo-versioned `source_dependency_rule`

The only approved runtime consumer surface is:

- `registry.active_sources`
- `registry.current_source_status`
- `registry.downstream_rules`

## Reason

MP-47 needs a stable cross-surface contract for County, Corridor, and Parcel without turning into a lineage platform. Downstream runs should pin `registry_version` plus source-version IDs rather than continue to depend on ad hoc source metadata.

## Evidence

- `next-phase.md` Source Registry architecture
- `source-registry/mp-47-source-registry-mvp.md`
- `scripts/sql/source-registry-schema.sql`
- `source-registry/source-definitions-v1.csv`
- `source-registry/source-versions-v1.csv`
- `source-registry/source-dependency-rules-v1.csv`

## Affected Areas

- `registry.source_definition`
- `registry.source_version`
- `registry.source_runtime_status`
- `registry.source_dependency_rule`
- future publication metadata such as `analytics.fact_publication.registry_version`

## Repo Note

The existing `planning/` tree is ignored in this repository, so this decision-log entry lives under `source-registry/` to keep the spike output trackable.
