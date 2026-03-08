export interface CountyScoreRow {
  readonly composite_score: number | string | null | undefined;
  readonly county_fips: string;
  readonly county_name: string | null | undefined;
  readonly data_version: string | null | undefined;
  readonly demand_score: number | string | null | undefined;
  readonly formula_version: number | string | null | undefined;
  readonly generation_score: number | string | null | undefined;
  readonly has_county_reference: boolean | number | string | null | undefined;
  readonly has_county_score: boolean | number | string | null | undefined;
  readonly input_data_version: number | string | null | undefined;
  readonly policy_score: number | string | null | undefined;
  readonly state_abbrev: string | null | undefined;
}

export interface CountyScoresStatusRow {
  readonly available_feature_families: unknown;
  readonly data_version: string | null | undefined;
  readonly formula_version: string | null | undefined;
  readonly input_data_version: string | null | undefined;
  readonly methodology_id: string | null | undefined;
  readonly metrics_row_count: number | string | null | undefined;
  readonly missing_feature_families: unknown;
  readonly publication_run_id: string | null | undefined;
  readonly publication_status: string | null | undefined;
  readonly published_at: Date | string | null | undefined;
  readonly score_row_count: number | string | null | undefined;
  readonly scored_county_count: number | string | null | undefined;
  readonly source_county_count: number | string | null | undefined;
  readonly water_coverage_count: number | string | null | undefined;
}
