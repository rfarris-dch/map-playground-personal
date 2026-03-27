import { describe, expect, it } from "bun:test";
import { mapCountyScoreRow } from "../../../src/geo/county-intelligence/county-intelligence.mapper";
import type { CountyScoreRow } from "../../../src/geo/county-intelligence/county-intelligence.repo";

function createCountyScoreRow(): CountyScoreRow {
  return {
    avg_rt_congestion_component: 4.8,
    attractiveness_tier: "balanced",
    balancing_authority: "ERCOT",
    competitive_area_type: "choice",
    confidence_badge: "high",
    coverage_confidence: "high",
    congestion_proxy_score: 36,
    county_fips: "48453",
    county_name: "Travis County",
    county_tagged_event_share: 0.5,
    deferred_reason_codes_json: [],
    demand_momentum_qoq: 0.12,
    demand_pressure_score: 74.2,
    evidence_confidence: "high",
    expected_mw_0_24m: 120,
    expected_mw_24_60m: 60,
    expected_supply_mw_0_36m: 80,
    expected_supply_mw_36_60m: 40,
    fiber_presence_flag: true,
    freshness_state: "fresh",
    formula_version: "county-market-pressure-v1",
    freshness_score: 92,
    gas_pipeline_mileage_county: 88.6,
    gas_pipeline_presence_flag: true,
    grid_friction_score: 48.6,
    has_county_reference: true,
    has_county_score: true,
    heatmap_signal_flag: true,
    input_data_version:
      "dc_pipeline=2026-03-07;queue=2026-03-01;policy=2026-03-05;power_market_context=2026-03-07;utility_context=2026-03-07;transmission=2026-03-06;congestion=2026-03-05",
    is_border_county: false,
    is_seam_county: false,
    last_updated_at: "2026-03-07T00:00:00.000Z",
    load_zone: "LCRA",
    market_pressure_index: 61.4,
    market_structure: "organized_market",
    market_withdrawal_prior: 0.18,
    median_days_in_queue_active: 540,
    moratorium_status: "watch",
    method_confidence: "medium",
    narrative_summary:
      "Demand and supply signals are mixed, pointing to a balanced county profile.",
    negative_price_hour_share: 0.07,
    p95_shadow_price: 29.4,
    past_due_share: 0.22,
    pillar_value_states_json: {
      demand: "observed",
      gridFriction: "observed",
      infrastructure: "derived",
      policy: "observed",
      supplyTimeline: "observed",
    },
    planned_upgrade_count: 2,
    policy_constraint_score: 32.5,
    policy_event_count: 3,
    policy_mapping_confidence: "high",
    policy_momentum_score: 14.6,
    primary_tdu_or_utility: "Oncor",
    primary_market_id: "austin",
    provider_entry_count_12m: 1,
    public_sentiment_score: 0.41,
    publication_run_id: "county-market-pressure-20260307T000000Z",
    queue_avg_age_days: 610,
    queue_mw_active: 200,
    queue_project_count_active: 4,
    queue_solar_mw: 20,
    queue_storage_mw: 75,
    queue_wind_mw: 15,
    queue_withdrawal_rate: 0.19,
    rank_status: "ranked",
    recent_online_mw: 55,
    recent_commissioned_mw_24m: 45,
    retail_choice_status: "choice",
    signed_ia_mw: 25,
    source_provenance_json: {
      congestion: "fact_congestion_snapshot@2026-03-05",
      interconnectionQueue: "fact_gen_queue_snapshot@2026-03-01",
      operatingFootprints: "fact_power_market_context_snapshot@2026-03-07",
      retailStructure: "fact_utility_context_snapshot@2026-03-07",
      transmission: "fact_transmission_snapshot@2026-03-06",
      utilityTerritories: "fact_utility_context_snapshot@2026-03-07",
      wholesaleMarkets: "fact_power_market_context_snapshot@2026-03-07",
    },
    source_volatility: "medium",
    state_abbrev: "TX",
    suppression_state: "none",
    supply_timeline_score: 55.1,
    top_drivers_json: [],
    top_constraints_json: [
      {
        constraintId: "ercot-west-001",
        flowMw: 410,
        hoursBound: 38,
        label: "West export interface",
        limitMw: 450,
        operator: "ERCOT",
        shadowPrice: 29.4,
        voltageKv: 345,
      },
    ],
    transmission_miles_138kv_plus: 96.4,
    transmission_miles_69kv_plus: 128.2,
    transmission_miles_230kv_plus: 42.8,
    transmission_miles_345kv_plus: 18.1,
    transmission_miles_500kv_plus: 0,
    transmission_miles_765kv_plus: 0,
    utility_context_json: {
      dominantUtilityId: "oncor",
      dominantUtilityName: "Oncor Electric Delivery",
      retailChoicePenetrationShare: 0.82,
      territoryType: "tdu",
      utilities: [
        {
          utilityId: "oncor",
          utilityName: "Oncor Electric Delivery",
          territoryType: "tdu",
          retailChoiceStatus: "choice",
        },
      ],
      utilityCount: 1,
    },
    operator_weather_zone: "South Central",
    operator_zone_confidence: "medium",
    operator_zone_label: "LCRA",
    operator_zone_type: "load_zone",
    meteo_zone: "Austin/San Antonio (TX215)",
    weather_zone: "South Central",
    what_changed_30d_json: [],
    what_changed_60d_json: [],
    what_changed_90d_json: [],
    wholesale_operator: "ERCOT",
  };
}

describe("mapCountyScoreRow", () => {
  it("maps power market context, queue, congestion, and provenance fields", () => {
    const row = createCountyScoreRow();
    const result = mapCountyScoreRow(row);

    expect(result.powerMarketContext).toEqual({
      balancingAuthority: "ERCOT",
      loadZone: "LCRA",
      marketStructure: "organized_market",
      meteoZone: "Austin/San Antonio (TX215)",
      operatorWeatherZone: "South Central",
      operatorZoneConfidence: "medium",
      operatorZoneLabel: "LCRA",
      operatorZoneType: "load_zone",
      weatherZone: "South Central",
      wholesaleOperator: "ERCOT",
    });
    expect(result.retailStructure.primaryTduOrUtility).toBe("Oncor");
    expect(result.confidence).toEqual({
      evidenceConfidence: "high",
      methodConfidence: "medium",
      coverageConfidence: "high",
      freshnessState: "fresh",
      suppressionState: "none",
    });
    expect(result.retailStructure.utilityContext.utilities).toHaveLength(1);
    expect(result.isBorderCounty).toBe(false);
    expect(result.transmissionContext.miles345kvPlus).toBe(18.1);
    expect(result.interconnectionQueue).toMatchObject({
      activeMw: 200,
      avgAgeDays: 610,
      storageMw: 75,
      withdrawalRate: 0.19,
    });
    expect(result.congestionContext).toMatchObject({
      avgRtCongestionComponent: 4.8,
      p95ShadowPrice: 29.4,
      negativePriceHourShare: 0.07,
    });
    expect(result.topConstraints[0]).toMatchObject({
      constraintId: "ercot-west-001",
      label: "West export interface",
    });
    expect(result.sourceProvenance.wholesaleMarkets).toBe(
      "fact_power_market_context_snapshot@2026-03-07"
    );
  });
});
