# County Power Decision Log

## Template

| Date | Decision | Reason | Source or evidence | Owner | Code or table affected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | Decision statement | Why the decision exists | Link, source, or review evidence | Owner name | Path or table | proposed |

## Adopted and Proposed Decisions

| Date | Decision | Reason | Source or evidence | Owner | Code or table affected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-03-24 | Preserve nulls when county or subregion precision is not defensible | False precision is more damaging than sparse coverage for sales, leadership, and Ian review | Live `/coverage`, `/resolution`, and `/debug` surfaces; current publication retains nulls | Robert Farris | `packages/ops/src/etl/county-power-public-us.impl.js`, `analytics.county_market_pressure_current` | adopted |
| 2026-03-24 | Treat `operatorWeatherZone` as ERCOT-only until another operator publishes a comparable geography | ERCOT has a clear public weather-zone source; most other operators do not | ERCOT Appendix D integration and current extractor logic | Robert Farris | `buildCountyPowerMarketRecords()`, `resolveCountyOperatorZone()` | adopted |
| 2026-03-24 | Keep `meteoZone` separate from `operatorWeatherZone` | Public meteorology geography should not be mislabeled as operator geography | NWS ZoneCounty fallback and current county-intelligence contract | Robert Farris | `packages/http-contracts/src/county-intelligence-http.ts`, `analytics.fact_power_market_context_snapshot` | adopted |
| 2026-03-24 | Do not backfill `p95ShadowPrice` from zonal congestion values | A zonal congestion component is not a shadow price | Current congestion merge logic and diagnostics | Robert Farris | `buildMergedCountyCongestionRecords()`, `analytics.fact_congestion_snapshot` | adopted |
| 2026-03-24 | Use heterogeneous operator subregions in `operatorZoneLabel`, but always pair them with `operatorZoneType` and `operatorZoneConfidence` | Coverage improves materially without hiding semantics | Current publication coverage by type: weather-zone `154`, LRZ `864`, utility-zone-proxy `503`, load-zone `129`, queue-study-region `57`, settlement-location `12` | Robert Farris | `analytics.fact_power_market_context_snapshot`, county-intelligence API | adopted |
| 2026-03-24 | Multi-county labels should resolve as multi-county only when the source explicitly names multiple counties | Explicit multi-county is defensible; inferred multi-county is not | Current queue resolver behavior and unresolved-tail audit | Robert Farris | `resolveQueueCountyResolution()`, `analytics.fact_gen_queue_county_resolution` | adopted |
| 2026-03-24 | Keep generation-side queue and load-side queue as separate products | Semantics, buyers, and score effects are different | Product plan and current table names `fact_gen_queue_*` | Robert Farris, Product Lead | Queue schema and future roadmap | adopted |
| 2026-03-24 | Promote purchased standardized queue data above public scrapes once licensed and field-complete | Standardized identifiers and stage groups should outrank bespoke scraping | Interconnection.fyi plan and current queue normalization complexity | Robert Farris, Product Lead | Future queue ingestion precedence | proposed |
| 2026-03-24 | Promote Ian-adjusted boundaries above approximate public boundaries once they are versioned | Seam corrections need structured ownership instead of ad hoc notes | Ian review plan and boundary manifest roadmap | Robert Farris, Ian | Future boundary manifest and county bridge tables | proposed |
| 2026-03-24 | Separate score and confidence in every downstream release | We should not reward counties for data richness or punish counties for honest nulls | Current confidence badge model and scoring roadmap | Robert Farris, Product Lead | County publication and web presentation | adopted |
| 2026-03-24 | Treat `/status.featureCoverage` as dataset-family availability, not county completeness | Publication metadata is truthful but coarse | Current `/status` vs `/coverage` semantics | Robert Farris | `analytics.fact_publication`, county-intelligence status route | adopted |
| 2026-03-24 | Use diagnostics as an explanation layer before broad score rollout | Backend already exposes the right observability to explain nulls and weak operators | `/coverage`, `/resolution`, and `/debug` are now surfaced in the web panel | Robert Farris | County-intelligence API and web diagnostics components | adopted |

## Immediate Review Questions For Ian

1. Are `utility_zone_proxy` labels acceptable for PJM until a stronger public system-map alias layer is in place?
2. Which MISO seam counties should remain `low` confidence even after LRZ coverage is nearly complete?
3. Which unresolved queue labels are impossible from public data and should stay unresolved permanently?
4. Which public boundary layers should be superseded immediately by consultant or Ian-adjusted geometry once those files are integrated?
