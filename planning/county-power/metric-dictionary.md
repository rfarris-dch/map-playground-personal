# County Power Metric Dictionary

Current reference publication: `county-market-pressure-county-power-public-us-20260324t123500z`  
Current publication date: `2026-03-24`

## Purpose

This dictionary freezes the semantics for the county-power layer before further scoring work. It is intentionally strict:

- Null is valid when public or internal evidence is not defensible.
- Score and confidence are separate outputs.
- County, operator subregion, operator region, and state are different grains.
- Generation-side queue and load-side queue are separate products.
- Native source values are preserved alongside normalized values where possible.

## Field Semantics

### Geography Truth Layer

| Field | Plain-English meaning | Current source | Grain | Null policy | Fallback / notes |
| --- | --- | --- | --- | --- | --- |
| `wholesaleOperator` | Primary wholesale market or vertically integrated operator for the county | EIA-861 plus operator normalization in `buildCountyPowerMarketRecords()` | county | Should not be null in the published layer | Published for `3221 / 3221` counties |
| `marketStructure` | Whether the county sits in an organized market or a traditional vertically integrated region | Derived from operator assignment | county | Null only if operator identity is not defensible | Published as `organized_market` or `traditional_vertical` |
| `balancingAuthority` | Balancing authority code or canonical operator name | EIA-861 plus operator normalization | county | Preserve null if the authority cannot be normalized | Published for `3221 / 3221` counties |
| `operatorZoneLabel` | Best defensible operator subregion label for the county | Operator-specific references and queue-derived mappings | county | Preserve null unless an official or defensible derived mapping exists | Current coverage `1719 / 3221` |
| `operatorZoneType` | Meaning of `operatorZoneLabel` by operator | Derived from operator-specific mapping rules | county | Null when `operatorZoneLabel` is null | Current types include `weather_zone`, `local_resource_zone`, `utility_zone_proxy`, `load_zone`, `queue_study_region`, `settlement_location` |
| `operatorZoneConfidence` | Confidence attached to the county-to-subregion mapping | Derived from mapping method | county | Null when `operatorZoneLabel` is null | Current values are `high`, `medium`, or `low` |
| `operatorWeatherZone` | Operator-published weather zone | ERCOT Appendix D only | county | Remains null outside ERCOT | Current coverage `154 / 3221`; this is intentional |
| `meteoZone` | Public meteorology zone or county weather reference | NWS ZoneCounty fallback | county-equivalent | Null only when the county-equivalent cannot be normalized | Current coverage `3220 / 3221`; only `15005` remains null |
| `loadZone` | Legacy compatibility mirror for `operatorZoneLabel` | Derived from `operatorZoneLabel` | county | Mirrors `operatorZoneLabel` null behavior | Keep only for compatibility; do not treat as a universal literal load-zone field |
| `weatherZone` | Legacy compatibility mirror for `operatorWeatherZone` | Derived from `operatorWeatherZone` | county | Mirrors `operatorWeatherZone` null behavior | ERCOT-only in practice |
| `isSeamCounty` | Indicates the county touches a market or mapping seam | Derived county context | county | False when not explicitly flagged | Do not infer from sparse zone data alone |

### Generation Context

| Field | Plain-English meaning | Current source | Grain | Null policy | Fallback / notes |
| --- | --- | --- | --- | --- | --- |
| `fact_gen_queue_project.project_id` | Canonical ID for a generation queue project | Operator queue source or stable hash builder | queue project | Never null for loaded projects | Generation-side only; load queue is out of scope |
| `fact_gen_queue_project.queue_name` | Native queue name from source | Operator queue source | queue project | Preserve null or blank if the source omits it | Keep native value for debugging |
| `fact_gen_queue_project.queue_poi_label` | Native POI or substation label | Operator queue source | queue project | Preserve null if absent | Key input for future POI reference work |
| `fact_gen_queue_project.queue_resolver_type` | How county siting was resolved | Resolver pipeline | queue project | Null when no county assignment exists | Current values include `manual_override`, `explicit_county`, `explicit_multi_county`, `poi_lookup`, `place_lookup`, and unresolved |
| `fact_gen_queue_project.queue_county_confidence` | Confidence of county siting | Resolver pipeline | queue project | Null when unresolved | Keep separate from market attractiveness |
| `fact_gen_queue_snapshot.queue_status` | Current normalized queue status | Operator-specific normalizers in extractor | queue snapshot | Preserve normalized value as loaded | See `queue-status-crosswalk.csv` |
| `signedIaMw` | County-level MW with signed or executed IA where available | Queue snapshots rolled up in refresh SQL | county | Null when source does not expose IA meaningfully | Not all operators expose equivalent IA markers |
| `queueMwActive` | Active generation queue MW assigned to the county | Queue snapshot rollup | county | Null only if rollup is unavailable | Published for all counties; can be `0` |
| `queueProjectCountActive` | Active project count assigned to the county | Queue snapshot rollup | county | Null only if rollup is unavailable | Published for all counties |
| `queueStorageMw` | Active storage MW in queue | Queue project fuel mix rollup | county | Null when no matching projects exist | `0` means no storage queue MW |
| `queueSolarMw` | Active solar MW in queue | Queue project fuel mix rollup | county | Null when no matching projects exist | `0` means no solar queue MW |
| `queueWindMw` | Active wind MW in queue | Queue project fuel mix rollup | county | Null when no matching projects exist | `0` means no wind queue MW |
| `queueAvgAgeDays` | Average age of active queue projects | Queue snapshot rollup | county | Null when there are no active projects with queue dates | Do not backfill from inactive rows |
| `medianDaysInQueueActive` | Median days in queue for active projects | Queue snapshot rollup | county | Null when there are too few usable rows | Used as a grid-friction input |
| `queueWithdrawalRate` | County-level withdrawal share or proxy | Queue history and snapshot rollup | county | Null when denominator is not defensible | Keep separate from attractiveness |
| `recentOnlineMw` | Recently completed online generation MW | Queue snapshot rollup | county | Null when no recent completed projects are defensible | Reflects supply context, not attractiveness by itself |
| `expectedSupplyMw0To36m` | Near-term expected supply MW from the queue context | Derived rollup | county | Null when timing or county assignment is weak | Planned scoring input, not a direct market label |
| `expectedSupplyMw36To60m` | Later expected supply MW from the queue context | Derived rollup | county | Null when timing or county assignment is weak | Planned scoring input |

### Infrastructure Context

| Field | Plain-English meaning | Current source | Grain | Null policy | Fallback / notes |
| --- | --- | --- | --- | --- | --- |
| `transmissionMiles69kvPlus` | County transmission miles at `69+` kV | Public transmission line feature service | county | Null only if rollup failed | Published for all counties |
| `transmissionMiles138kvPlus` | County transmission miles at `138+` kV | Public transmission line feature service | county | Null only if rollup failed | Published for all counties |
| `transmissionMiles230kvPlus` | County transmission miles at `230+` kV | Public transmission line feature service | county | Null only if rollup failed | Published for all counties |
| `transmissionMiles345kvPlus` | County transmission miles at `345+` kV | Public transmission line feature service | county | Null only if rollup failed | Published for all counties |
| `transmissionMiles500kvPlus` | County transmission miles at `500+` kV | Public transmission line feature service | county | Null only if rollup failed | Published for all counties |
| `transmissionMiles765kvPlus` | County transmission miles at `765+` kV | Public transmission line feature service | county | Null only if rollup failed | Published for all counties |
| `fiberPresenceFlag` | Whether fiber context is present for the county | Existing county market-pressure layer | county | Preserve null when no source exists | Current power ingestion does not yet publish county fiber route miles |
| `gasPipelinePresenceFlag` | Whether gas pipeline context is present for the county | Existing county market-pressure layer | county | Preserve null when no source exists | Current power ingestion does not yet publish full gas network detail |
| `gasPipelineMileageCounty` | Gas pipeline mileage in county | Existing county market-pressure layer | county | Preserve null when no source exists | Future dedicated gas layer should supersede this |

### Policy Context

| Field | Plain-English meaning | Current source | Grain | Null policy | Fallback / notes |
| --- | --- | --- | --- | --- | --- |
| `fact_policy_event.event_id` | Native policy event identifier | NLR workbook-derived policy ingest | event | Never null for loaded events | Alpha policy layer only |
| `policyMomentumScore` | Snapshot proxy for supportive or restrictive policy movement | Policy snapshot rollup | county or state-applied county | Null when no policy snapshot is defensible | Current policy coverage is narrower than the rest of county-power |
| `moratoriumStatus` | Whether a moratorium or restrictive posture is present | Policy snapshot rollup | county or state-applied county | Preserve null or watch state when not defensible | Should not be inferred from headlines alone |
| `publicSentimentScore` | Snapshot sentiment proxy from current policy/event inputs | Policy snapshot rollup | county or state-applied county | Preserve null when not defensible | Confidence should stay separate |
| `policyEventCount` | Count of policy events affecting the county or its parent jurisdiction | Policy event rollup | county | Null when no events exist | `0` is valid |
| `countyTaggedEventShare` | Share of policy events tagged directly to the county | Policy event rollup | county | Null when denominator is not defensible | Explains locality of policy evidence |
| `policyMappingConfidence` | Confidence of the county policy mapping | Derived from policy event applicability | county | Null when there is no mapped policy layer | Separate from attractiveness and confidence badge |

### Congestion and Grid Friction

| Field | Plain-English meaning | Current source | Grain | Null policy | Fallback / notes |
| --- | --- | --- | --- | --- | --- |
| `avgRtCongestionComponent` | Average real-time congestion component aggregated to county | Operator public congestion feeds | county | Preserve null unless a defensible county or zonal aggregation exists | Current coverage `2245 / 3221` |
| `p95ShadowPrice` | Ninety-fifth percentile shadow-price summary for county constraints | Operator public constraint feeds | county | Preserve null unless real shadow-price evidence exists | Do not backfill from zonal congestion components |
| `negativePriceHourShare` | Share of hours or intervals with negative pricing | Operator price feeds | county | Preserve null when county or zonal mapping is not defensible | Supports grid-friction interpretation |
| `topConstraintsJson` | Top binding constraints affecting county context | Operator public constraint feeds | county | Preserve null when constraint attribution is weak | Explainability field, not a score by itself |
| `congestionProxyScore` | Normalized proxy used in county market-pressure scoring | Derived rollup | county | Null when supporting congestion inputs are missing | Keep provenance alongside this field |
| `heatmapSignalFlag` | Whether heatmap-style congestion evidence exists | Derived rollup | county | Null when no supporting feed exists | Diagnostics field |

### Confidence and Provenance

| Field | Plain-English meaning | Current source | Grain | Null policy | Fallback / notes |
| --- | --- | --- | --- | --- | --- |
| `publicationRunId` | Publication run that produced the county row | Publication pipeline | county row | Never null in the published layer | Primary anchor for audits |
| `formulaVersion` | Scoring or rollup formula version | Publication pipeline | county row | Null only for unpublished rows | Tracks model changes |
| `inputDataVersion` | Composite source version string | Publication pipeline | county row | Null only for unpublished rows | Useful in debug and exports |
| `sourceProvenanceJson` | Structured per-field source provenance | Publication pipeline | county row | Preserve null only if provenance is unavailable | Should explain official, derived, or override paths |
| `confidenceBadge` | User-facing confidence class for county row | County publication scoring logic | county | Never infer from attractiveness alone | Must remain separate from score |
| `freshnessScore` | Freshness proxy for county row | Publication pipeline | county | Null when freshness inputs are not defensible | Can adjust confidence, not attractiveness alone |

### Diagnostics and Completeness

| Field | Plain-English meaning | Current source | Grain | Null policy | Fallback / notes |
| --- | --- | --- | --- | --- | --- |
| `status.featureCoverage` | Dataset-family availability flags | Publication metadata | dataset publication | Never use as county-level completeness | Indicates whether a source family is published at all |
| `coverage.fields[*].populatedCount` | How many county rows have a field populated | `/coverage` diagnostics endpoint | dataset publication | `0` is valid | Explains sparse optional fields |
| `resolution.bySource[*].unresolvedProjectCount` | Count of project rows with no direct county or resolution row | `/resolution` diagnostics endpoint | source system | `0` is valid | Current counts: CAISO `20`, ISO-NE `107`, MISO `131`, NYISO `133`, PJM `901`, SPP `9` |
| `resolution.bySource[*].unresolvedSnapshotCount` | Count of current snapshot rows with no direct county or resolution row | `/resolution` diagnostics endpoint | source system | `0` is valid | Current counts: CAISO `20`, ISO-NE `107`, MISO `131`, NYISO `133`, PJM `52`, SPP `9` |
| `debug.queueResolutions` | County-scoped queue resolution audit rows | `/debug` diagnostics endpoint | county and project | Empty array is valid | Use this to explain nulls rather than hiding them |

## Planned Metrics Not Yet Live

These are part of the roadmap but are not yet authoritative in the current publication:

| Planned field or family | Why it is planned | Expected authoritative source | Grain | Null policy |
| --- | --- | --- | --- | --- |
| `countyToOperatorSubregion.owner` | Needed to preserve who approved or adjusted a seam decision | boundary manifest plus Ian review pack | county bridge | Null until the boundary manifest is versioned |
| `queueStageGroup` | Needed for a consistent national queue scoring model | Interconnection.fyi first, public scrapes second | queue project and county rollup | Null until the crosswalk is approved |
| `fiberRouteMiles` | Needed for infrastructure context beyond a boolean presence flag | purchased or consultant fiber source | county | Null until a defensible source is integrated |
| `gasTransmissionMiles` | Needed for natural-gas infrastructure context | public or purchased gas network source | county | Null until integrated |
| `loadSideQueue*` | Needed if large-load interconnection becomes a separate product | operator or purchased load queue source | queue project and county | Keep out of generation queue tables entirely until modeled separately |

## Immediate Review Questions

1. Do we accept `operatorZoneLabel` as a heterogeneous operator subregion field, provided `operatorZoneType` and `operatorZoneConfidence` are always shown?
2. Do we formalize `queueStageGroup` using the proposed crosswalk in `queue-status-crosswalk.csv`, or do we wait for Interconnection.fyi to become canonical?
3. Which planned infrastructure fields can be exposed to sales before fiber and gas are truly source-backed?
