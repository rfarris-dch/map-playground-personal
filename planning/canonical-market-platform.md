# Canonical Market Platform

## Decision

The canonical market platform in this repository uses a hybrid relational core plus explicit read model:

- `canon.*` stores typed canonical identities, publication state, periodic fact families, coverage, and provenance.
- `serve.*` exposes denormalized read-serving views and SQL functions for API and map consumers.

This decision rejects both a single mega-table and pure event sourcing as the primary system of record.

## Why

The current source estate mixes several incompatible concerns:

- facility identities are fragmented across colocation and hyperscale source systems
- market-quarter publication is a first-class business rule, but it is implicit in source behavior
- current operational snapshots and quarterly history are distinct truth families
- hyperscale leased totals are market + company + year facts, not facility facts
- facility geometry is only trustworthy as current state in the MVP

The canonical layer has to preserve those distinctions rather than flatten them away.

## Core Modeling Rules

1. Official publication is a market-quarter state.
   Public read models are gated by `publication_state = 'live'`.

2. Preview behavior is explicit.
   Preview-serving views may include inactive market quarters that public views exclude.

3. Current snapshots and historical facts stay separate.
   Current facility geometry and identity do not overwrite quarterly history.

4. Hyperscale leasing keeps its own grain.
   Market + company + year leased totals are modeled separately from facility capacity.

5. Historical polygon queries in the MVP use current geometry.
   The system does not currently have valid-time geometry, so polygon time series are based on the
   facilities selected by their current known geometry.

## What This Worktree Implements

This worktree adds the first durable platform slice in repo-native form:

- `scripts/sql/market-canonical-schema.sql`
  Creates `canon.*` tables plus `serve.*` read models and the polygon aggregation function.

- `scripts/init-market-canonical-schema.sh`
  Bootstraps the schema into Postgres/PostGIS.

- `scripts/load-market-canonical.sh`
  Loads the canonical slice from the existing `market_source.*` landing schema.

The loader now lands and canonicalizes these source families end to end:

- market identities
- submarket identities
- market-quarter publication state
- official market-quarter facts
- current colocation operational snapshots
- current hyperscale operational snapshots
- colocation facility quarterly capacity facts
- hyperscale facility quarterly capacity facts
- hyperscale company-market-year lease overlay
- insight forecast facts
- insight pricing facts
- current facility identities and current geometry from point feeds

What is still not complete is the app-site parity layer on top of those facts. The current worktree
does not yet rebuild every derived insight surface or API contract from the canonical read model.

## Read Model Surfaces

The schema publishes these initial serving objects:

- `serve.market_release_current`
- `serve.market_quarterly_live`
- `serve.market_quarterly_preview`
- `serve.facility_current`
- `serve.facility_capacity_quarterly_live`
- `serve.facility_capacity_quarterly_preview`
- `serve.submarket_quarterly_live`
- `serve.submarket_quarterly_preview`
- `serve.hyperscale_company_market_leased_yearly`
- `serve.hyperscale_company_market_leased_latest_year`
- `serve.market_forecast_current`
- `serve.market_pricing_forecast_current`
- `serve.area_capacity_quarterly_current_geometry(...)`

The area query function returns time series aggregated over facilities selected by current geometry
and explicitly labels its basis:

- `geometry_basis = 'current'`
- `publication_basis = 'live_only' | 'preview_allowed'`

It does not allocate hyperscale leased overlay into arbitrary polygons.

## Implementation Status

Implemented in this worktree:

- hybrid `canon.*` core plus `serve.*` read model
- first-class market-quarter publication state
- explicit live vs preview serving for market-quarter and facility-quarterly history
- separate current snapshots from quarterly history
- separate hyperscale lease overlay at `market + company + year`
- current-geometry polygon time series with explicit basis fields
- facility and market coverage/provenance tracking

Not fully implemented yet:

- endpoint-parity dashboards and drift dashboards
- app/API cutover for the app-site and map runtime surfaces

The remaining work is no longer in the canonical SQL layer. It is in operational cutover and
validation: runtime consumers, endpoint parity checks, and drift dashboards.

## Migration Order

Migration priority follows the business surfaces that have the highest compatibility risk:

1. app-site market insight parity
2. hyperscale market and company capacity plus leasing
3. colocation company capacity totals
4. new map historical facility capacity and polygon time series

The new map is not the first cutover target.

## Known Gaps

- `HAWK_MARKET_YEARLY_DATA` still needs a finalized semantic contract relative to
  `INSIGHT_FORECAST` and `INSIGHT_PRICING_FORECAST`.
- app-site derived insight formulas still need verified parity rules rather than inferred SQL.
- hyperscale leased authority should remain `HYPERSCALE_COMPANY_LEASE_TOTAL` unless the business
  explicitly promotes a different public source family.
- valid-time geometry is intentionally deferred.
