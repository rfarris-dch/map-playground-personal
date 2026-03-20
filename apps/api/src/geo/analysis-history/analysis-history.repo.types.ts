export interface AreaHistoryPointRow {
  readonly colocation_available_mw: number | string;
  readonly colocation_commissioned_mw: number | string;
  readonly colocation_planned_mw: number | string;
  readonly colocation_under_construction_mw: number | string;
  readonly facility_count: number;
  readonly hyperscale_owned_mw: number | string;
  readonly hyperscale_planned_mw: number | string;
  readonly hyperscale_under_construction_mw: number | string;
  readonly period_id: number;
  readonly period_label: string;
  readonly quarter_num: number;
  readonly total_market_size_mw: number | string;
  readonly year_num: number;
}

export interface AreaHistoryCoverageRow {
  readonly included_colocation_facility_count: number;
  readonly included_facility_count: number;
  readonly included_hyperscale_facility_count: number;
  readonly selected_colocation_facility_count: number;
  readonly selected_facility_count: number;
  readonly selected_hyperscale_facility_count: number;
  readonly selected_market_count: number;
}
