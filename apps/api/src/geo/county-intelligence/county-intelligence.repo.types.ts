export interface CountyScoreRow {
  readonly attractiveness_tier: string | null | undefined;
  readonly avg_rt_congestion_component: number | string | null | undefined;
  readonly balancing_authority: string | null | undefined;
  readonly competitive_area_type: string | null | undefined;
  readonly confidence_badge: string | null | undefined;
  readonly congestion_proxy_score: number | string | null | undefined;
  readonly county_fips: string;
  readonly county_name: string | null | undefined;
  readonly county_tagged_event_share: number | string | null | undefined;
  readonly coverage_confidence: string | null | undefined;
  readonly deferred_reason_codes_json: unknown;
  readonly demand_momentum_qoq: number | string | null | undefined;
  readonly demand_pressure_score: number | string | null | undefined;
  readonly evidence_confidence: string | null | undefined;
  readonly expected_mw_0_24m: number | string | null | undefined;
  readonly expected_mw_24_60m: number | string | null | undefined;
  readonly expected_supply_mw_0_36m: number | string | null | undefined;
  readonly expected_supply_mw_36_60m: number | string | null | undefined;
  readonly fiber_presence_flag: boolean | number | string | null | undefined;
  readonly formula_version: number | string | null | undefined;
  readonly freshness_score: number | string | null | undefined;
  readonly freshness_state: string | null | undefined;
  readonly gas_pipeline_mileage_county: number | string | null | undefined;
  readonly gas_pipeline_presence_flag: boolean | number | string | null | undefined;
  readonly grid_friction_score: number | string | null | undefined;
  readonly has_county_reference: boolean | number | string | null | undefined;
  readonly has_county_score: boolean | number | string | null | undefined;
  readonly heatmap_signal_flag: boolean | number | string | null | undefined;
  readonly input_data_version: number | string | null | undefined;
  readonly is_border_county: boolean | number | string | null | undefined;
  readonly is_seam_county: boolean | number | string | null | undefined;
  readonly last_updated_at: Date | string | null | undefined;
  readonly load_zone: string | null | undefined;
  readonly market_pressure_index: number | string | null | undefined;
  readonly market_structure: string | null | undefined;
  readonly market_withdrawal_prior: number | string | null | undefined;
  readonly median_days_in_queue_active: number | string | null | undefined;
  readonly meteo_zone: string | null | undefined;
  readonly method_confidence: string | null | undefined;
  readonly moratorium_status: string | null | undefined;
  readonly narrative_summary: string | null | undefined;
  readonly negative_price_hour_share: number | string | null | undefined;
  readonly operator_weather_zone: string | null | undefined;
  readonly operator_zone_confidence: string | null | undefined;
  readonly operator_zone_label: string | null | undefined;
  readonly operator_zone_type: string | null | undefined;
  readonly p95_shadow_price: number | string | null | undefined;
  readonly past_due_share: number | string | null | undefined;
  readonly pillar_value_states_json: unknown;
  readonly planned_upgrade_count: number | string | null | undefined;
  readonly policy_constraint_score: number | string | null | undefined;
  readonly policy_event_count: number | string | null | undefined;
  readonly policy_mapping_confidence: string | null | undefined;
  readonly policy_momentum_score: number | string | null | undefined;
  readonly primary_market_id: string | null | undefined;
  readonly primary_tdu_or_utility: string | null | undefined;
  readonly provider_entry_count_12m: number | string | null | undefined;
  readonly public_sentiment_score: number | string | null | undefined;
  readonly publication_run_id: string | null | undefined;
  readonly queue_avg_age_days: number | string | null | undefined;
  readonly queue_mw_active: number | string | null | undefined;
  readonly queue_project_count_active: number | string | null | undefined;
  readonly queue_solar_mw: number | string | null | undefined;
  readonly queue_storage_mw: number | string | null | undefined;
  readonly queue_wind_mw: number | string | null | undefined;
  readonly queue_withdrawal_rate: number | string | null | undefined;
  readonly rank_status: string | null | undefined;
  readonly recent_commissioned_mw_24m: number | string | null | undefined;
  readonly recent_online_mw: number | string | null | undefined;
  readonly retail_choice_status: string | null | undefined;
  readonly signed_ia_mw: number | string | null | undefined;
  readonly source_provenance_json: unknown;
  readonly source_volatility: string | null | undefined;
  readonly state_abbrev: string | null | undefined;
  readonly supply_timeline_score: number | string | null | undefined;
  readonly suppression_state: string | null | undefined;
  readonly top_constraints_json: unknown;
  readonly top_drivers_json: unknown;
  readonly transmission_miles_69kv_plus: number | string | null | undefined;
  readonly transmission_miles_138kv_plus: number | string | null | undefined;
  readonly transmission_miles_230kv_plus: number | string | null | undefined;
  readonly transmission_miles_345kv_plus: number | string | null | undefined;
  readonly transmission_miles_500kv_plus: number | string | null | undefined;
  readonly transmission_miles_765kv_plus: number | string | null | undefined;
  readonly utility_context_json: unknown;
  readonly weather_zone: string | null | undefined;
  readonly what_changed_30d_json: unknown;
  readonly what_changed_60d_json: unknown;
  readonly what_changed_90d_json: unknown;
  readonly wholesale_operator: string | null | undefined;
}

export interface CountyScoresStatusRow {
  readonly available_feature_families: unknown;
  readonly blocked_county_count: number | string | null | undefined;
  readonly config_hash: string | null | undefined;
  readonly data_version: string | null | undefined;
  readonly deferred_county_count: number | string | null | undefined;
  readonly envelope_hash: string | null | undefined;
  readonly formula_version: string | null | undefined;
  readonly fresh_county_count: number | string | null | undefined;
  readonly freshness_aging_count: number | string | null | undefined;
  readonly freshness_critical_count: number | string | null | undefined;
  readonly freshness_fresh_count: number | string | null | undefined;
  readonly freshness_stale_count: number | string | null | undefined;
  readonly freshness_unknown_count: number | string | null | undefined;
  readonly high_confidence_count: number | string | null | undefined;
  readonly ingestion_snapshot_count: number | string | null | undefined;
  readonly input_data_version: string | null | undefined;
  readonly low_confidence_count: number | string | null | undefined;
  readonly medium_confidence_count: number | string | null | undefined;
  readonly methodology_id: string | null | undefined;
  readonly missing_feature_families: unknown;
  readonly publication_run_id: string | null | undefined;
  readonly publication_status: string | null | undefined;
  readonly published_at: Date | string | null | undefined;
  readonly ranked_county_count: number | string | null | undefined;
  readonly registry_version: string | null | undefined;
  readonly replayability_tier: string | null | undefined;
  readonly replayed_from_run_id: string | null | undefined;
  readonly reproducibility_available: boolean | number | string | null | undefined;
  readonly row_count: number | string | null | undefined;
  readonly source_county_count: number | string | null | undefined;
  readonly source_version_count: number | string | null | undefined;
  readonly suppression_downgraded_count: number | string | null | undefined;
  readonly suppression_none_count: number | string | null | undefined;
  readonly suppression_review_required_count: number | string | null | undefined;
  readonly suppression_suppressed_count: number | string | null | undefined;
}

export interface CountyScoresCoverageFieldRow {
  readonly field_name: string;
  readonly populated_count: number | string | null | undefined;
  readonly total_count: number | string | null | undefined;
}

export interface CountyScoresCoverageByOperatorRow {
  readonly avg_rt_congestion_component_count: number | string | null | undefined;
  readonly county_count: number | string | null | undefined;
  readonly meteo_zone_count: number | string | null | undefined;
  readonly operator_weather_zone_count: number | string | null | undefined;
  readonly operator_zone_label_count: number | string | null | undefined;
  readonly p95_shadow_price_count: number | string | null | undefined;
  readonly primary_tdu_or_utility_count: number | string | null | undefined;
  readonly wholesale_operator: string | null | undefined;
}

export interface CountyScoresResolutionSourceRow {
  readonly derived_resolution_count: number | string | null | undefined;
  readonly direct_resolution_count: number | string | null | undefined;
  readonly effective_date: Date | string | null | undefined;
  readonly low_confidence_resolution_count: number | string | null | undefined;
  readonly manual_resolution_count: number | string | null | undefined;
  readonly sample_location_labels: unknown;
  readonly sample_poi_labels: unknown;
  readonly sample_snapshot_location_labels: unknown;
  readonly sample_snapshot_poi_labels: unknown;
  readonly source_system: string;
  readonly total_projects: number | string | null | undefined;
  readonly total_snapshots: number | string | null | undefined;
  readonly unresolved_projects: number | string | null | undefined;
  readonly unresolved_snapshots: number | string | null | undefined;
}

export interface CountyOperatorZoneDebugRow {
  readonly allocation_share: number | string | null | undefined;
  readonly county_fips: string;
  readonly operator_zone_confidence: string | null | undefined;
  readonly operator_zone_label: string;
  readonly operator_zone_type: string;
  readonly resolution_method: string;
  readonly source_as_of_date: Date | string | null | undefined;
  readonly wholesale_operator: string;
}

export interface CountyQueueResolutionDebugRow {
  readonly allocation_share: number | string | null | undefined;
  readonly county_fips: string;
  readonly project_id: string;
  readonly queue_poi_label: string | null | undefined;
  readonly resolver_confidence: string;
  readonly resolver_type: string;
  readonly source_location_label: string | null | undefined;
  readonly source_system: string;
  readonly state_abbrev: string | null | undefined;
}

export interface CountyQueuePoiReferenceDebugRow {
  readonly county_fips: string;
  readonly operator_zone_label: string | null | undefined;
  readonly operator_zone_type: string | null | undefined;
  readonly queue_poi_label: string;
  readonly resolution_method: string;
  readonly resolver_confidence: string;
  readonly source_as_of_date: Date | string | null | undefined;
  readonly source_system: string;
  readonly state_abbrev: string | null | undefined;
}

export interface CountyCongestionDebugRow {
  readonly avg_rt_congestion_component: number | string | null | undefined;
  readonly county_fips: string;
  readonly negative_price_hour_share: number | string | null | undefined;
  readonly p95_shadow_price: number | string | null | undefined;
  readonly source_as_of_date: Date | string | null | undefined;
}

export interface CountyCatchmentDebugRow {
  readonly adjacency_source_id: string;
  readonly adjacency_source_version_id: string | null | undefined;
  readonly calibration_version: string;
  readonly county_fips: string;
  readonly neighbor_count: number | string | null | undefined;
  readonly point_touch_neighbor_count: number | string | null | undefined;
  readonly point_touch_reference_family: string;
  readonly point_touch_weight_share: number | string | null | undefined;
  readonly shared_edge_neighbor_count: number | string | null | undefined;
  readonly total_weight_mass: number | string | null | undefined;
}

export interface CountyConfidenceTraceRow {
  readonly baseline_suppression_state: string | null | undefined;
  readonly dependencies_json: unknown;
  readonly downstream_object_id: string;
  readonly downstream_object_type: string;
  readonly minimum_constitutive_confidence_cap: string | null | undefined;
  readonly minimum_truth_mode_cap: string | null | undefined;
  readonly registry_version: string | null | undefined;
  readonly worst_required_freshness_state: string | null | undefined;
}
