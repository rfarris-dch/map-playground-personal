# County Power Scoring Framework V1

## Purpose

Define how county power intelligence should be scored after the data foundation is explainable and stable. This is a scoring design document, not an implementation commit.

## Scoring Principles

- Do not reward counties for having more data.
- Do not merge generation-side and load-side queue data.
- Keep attractiveness and confidence as separate outputs.
- Keep county, operator subregion, operator region, and state signals at their own grains.
- Preserve native values and provenance so a score can always be explained.
- Null is a valid output when public evidence is not defensible.

## Required Inputs Before Shipping Scores

1. Geography truth layer with county-to-region and county-to-subregion provenance.
2. Generation queue normalization with native status and normalized status.
3. Infrastructure context for transmission, fiber, and gas as separate layers.
4. Policy event layer and policy snapshot layer.
5. Confidence and provenance fields that explain where every score input came from.

## Output Contract

Each county should ultimately emit:

- `attractivenessTier`
- `marketPressureIndex`
- `confidenceBadge`
- `topDrivers`
- `blockers`
- `whatChanged`
- `sourceProvenance`

## Three-Part Model

### 1. Base Bucket

Apply a rules-based first pass that places a county into one of:

- `advantaged`
- `balanced`
- `constrained`
- `blocked`
- `deferred`

The base bucket should rely on decisive combinations only, such as:

- supportive infrastructure plus manageable congestion plus low competitive saturation
- or severe policy restriction plus high grid friction plus no defensible supply relief

This prevents a county with sparse but strong data from looking worse than a county with many noisy signals.

### 2. Adjustment Layer

Apply smaller positive or negative adjustments from tertiary signals:

- transmission reinforcement
- fiber support
- gas support
- queue quality and stage mix
- competition intensity
- policy momentum
- freshness

The adjustment layer should not be large enough to overpower a strong base bucket decision.

### 3. Confidence Layer

Confidence is not a multiplier on attractiveness. It is a separate output that reflects:

- source authority
- percentage of required inputs populated
- boundary precision
- amount of inference versus direct source coverage
- unresolved queue tail share
- freshness and publication recency

## Candidate Input Families

### Geography Truth Inputs

- `wholesaleOperator`
- `marketStructure`
- `balancingAuthority`
- `operatorZoneLabel`
- `operatorZoneType`
- `operatorZoneConfidence`
- seam and border flags

### Generation Context Inputs

- `queueMwActive`
- `queueProjectCountActive`
- `queueStorageMw`
- `queueSolarMw`
- `queueWindMw`
- `queueAvgAgeDays`
- `queueWithdrawalRate`
- `signedIaMw`
- normalized stage-group shares once approved

### Infrastructure Context Inputs

- transmission mileage by voltage band
- future fiber route mileage and corridor proximity
- future gas pipeline mileage and feasibility proxies

### Policy Context Inputs

- restrictive or supportive event counts
- moratorium status
- policy momentum
- policy mapping confidence

### Grid Friction Inputs

- `avgRtCongestionComponent`
- `p95ShadowPrice`
- `negativePriceHourShare`
- `topConstraintsJson`
- queue age and withdrawal pressure

## Null Handling Rules

- Missing decisive inputs can trigger `deferred` instead of a false numeric score.
- Missing optional tertiary inputs should reduce confidence, not directly reduce attractiveness.
- `p95ShadowPrice` stays null unless real constraint or shadow-price evidence exists.
- `operatorWeatherZone` should not be backfilled outside ERCOT.

## Anti-Bias Rules

- Do not add positive weight merely because more source families are present.
- Do not let counties with richer public market data automatically outrank counties in traditional utility areas.
- Do not infer operator subregions where only balancing authority is defensible.
- Do not force a county queue assignment from weak POI text.

## Suggested Release Gates

### Gate 1

Every scoring input has:

- a definition
- a source
- a grain
- a null policy

### Gate 2

Every county-to-region and county-to-subregion assignment has:

- provenance
- confidence
- a repeatable mapping method

### Gate 3

Queue data has:

- canonical IDs
- native status
- normalized status
- unresolved tails tracked explicitly

### Gate 4

Transmission, fiber, and gas all exist as separate county context layers.

### Gate 5

Public-facing county outputs always show:

- attractiveness
- confidence
- top drivers
- provenance

## Current State Against The Framework

- Geography truth: partially ready
- Generation queue normalization: partially ready
- Transmission: ready
- Fiber: not yet source-backed
- Gas: not yet source-backed as a true layer
- Policy: alpha only
- Confidence and provenance: partly ready and already present in the county output

## Immediate Next Scoring Work

1. Approve a normalized `queueStageGroup` vocabulary using `queue-status-crosswalk.csv`.
2. Freeze a county-to-subregion authority order in `boundary-manifest-v1.json`.
3. Use the Ian session to tag representative counties as correct, incorrect, ambiguous, or impossible from public data.
4. Keep score tuning out of the critical path until the explanation layer is accepted internally.
