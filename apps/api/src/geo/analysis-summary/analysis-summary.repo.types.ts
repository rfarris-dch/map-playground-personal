export interface AnalysisSummaryAreaRow {
  readonly county_fips: string | null;
  readonly selection_area_sq_km: number | string;
}

export interface AnalysisSummaryMarketBoundarySourceVersionRow {
  readonly source_version: string | null;
}

export interface AnalysisSummaryMarketInsightRow {
  readonly colocation_commissioned_mw: number | string | null;
  readonly growth_ratio: number | string | null;
  readonly growth_year: number | null;
  readonly hyperscale_owned_mw: number | string | null;
  readonly market_id: string;
  readonly market_name: string;
  readonly period_label: string | null;
  readonly preleasing_mw: number | string | null;
  readonly preleasing_pct_of_absorption: number | string | null;
  readonly preleasing_pct_of_commissioned: number | string | null;
  readonly source_basis: string;
  readonly total_market_size_mw: number | string | null;
}
