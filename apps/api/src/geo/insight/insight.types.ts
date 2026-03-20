export interface MarketCapacityPoint {
  readonly absorption: number | null;
  readonly availablePower: number | null;
  readonly commissionedPower: number | null;
  readonly fullQy: string;
  readonly operatorPlannedPower: number | null;
  readonly plannedPower: number | null;
  readonly powerUnits: "kW";
  readonly preleasing: number | null;
  readonly quarter: number;
  readonly siteDeveloperPlannedPower: number | null;
  readonly status: "Live";
  readonly underConstructionPower: number | null;
  readonly vacancy: number | null;
  readonly year: number;
}

export interface MarketInsightResponse {
  readonly capacity: readonly MarketCapacityPoint[];
  readonly marketId: string;
  readonly marketName: string;
}

export interface PreleasingPercentageResponse {
  readonly percent: number | null;
  readonly quarter: number | null;
  readonly year: number | null;
}

export interface TtmGrowthResponse {
  readonly growth: number | null;
  readonly year: number | null;
}

export interface MarketSizeHistoryPoint {
  readonly inactive: boolean;
  readonly marketSize: number;
  readonly year: number;
}

export interface ForecastPoint {
  readonly commissionedPower: number;
  readonly year: number;
}

export interface PricingCategoryRange {
  readonly max: number | null;
  readonly min: number | null;
}

export interface PricingPoint {
  readonly currency: string;
  readonly hyperscaleMidRange: PricingCategoryRange | null;
  readonly hyperscaleRange: PricingCategoryRange;
  readonly hyperscaleUpperRange: PricingCategoryRange | null;
  readonly retailRange: PricingCategoryRange;
  readonly wholesaleRange: PricingCategoryRange;
  readonly year: string;
}

export interface PricingAveragePoint {
  readonly currency: string;
  readonly hyperscaleMidRange: number | null;
  readonly hyperscaleRange: number | null;
  readonly hyperscaleUpperRange: number | null;
  readonly retailRange: number | null;
  readonly wholesaleRange: number | null;
  readonly year: number;
}

export interface PricingRatioResponse {
  readonly hyperscale: number | null;
  readonly hyperscaleAvg: number | null;
  readonly hyperscaleStdDev: number | null;
  readonly latestYear: number | null;
  readonly retail: number | null;
  readonly retailAvg: number | null;
  readonly retailStdDev: number | null;
  readonly wholesale: number | null;
  readonly wholesaleAvg: number | null;
  readonly wholesaleStdDev: number | null;
}

export interface SubmarketCapacityPoint {
  readonly absorption: number | null;
  readonly commissioned: number | null;
  readonly live: boolean;
  readonly planned: number | null;
  readonly quarter: number;
  readonly submarketId: string;
  readonly submarketName: string;
  readonly underConstruction: number | null;
  readonly vacancy: number | null;
  readonly year: number;
}

export interface SubmarketInsightRecord {
  readonly data: readonly SubmarketCapacityPoint[];
  readonly submarketId: string;
}

export interface SubmarketTtmRecord {
  readonly commissioned: number | null;
  readonly submarketId: string;
  readonly submarketName: string;
  readonly ttmAbsorption: number | null;
  readonly vacancy: number | null;
}

export interface RawMarketQuarterRow {
  readonly absorption_override_mw: number | string | null;
  readonly available_mw: number | string | null;
  readonly commissioned_mw: number | string | null;
  readonly market_name: string;
  readonly operator_planned_mw: number | string | null;
  readonly period_label: string;
  readonly planned_mw: number | string | null;
  readonly preleasing_mw: number | string | null;
  readonly quarter_num: number | string;
  readonly site_developer_planned_mw: number | string | null;
  readonly under_construction_mw: number | string | null;
  readonly vacancy_pct_reported: number | string | null;
  readonly year_num: number | string;
}

export interface PreleasingRow {
  readonly preleasing_pct_of_absorption: number | string | null;
  readonly quarter_num: number | string;
  readonly year_num: number | string;
}

export interface MarketSizeReportRow {
  readonly total_market_size_mw: number | string | null;
}

export interface TtmGrowthRow {
  readonly growth_ratio: number | string | null;
  readonly year_num: number | string | null;
}

export interface SubmarketQuarterRow {
  readonly available_mw: number | string | null;
  readonly commissioned_mw: number | string | null;
  readonly planned_mw: number | string | null;
  readonly quarter_num: number | string;
  readonly submarket_id: string;
  readonly submarket_name: string;
  readonly under_construction_mw: number | string | null;
  readonly year_num: number | string;
}

export interface ForecastRow {
  readonly value_numeric: number | string;
  readonly year_num: number | string;
}

export interface MarketSizeHistoryRow {
  readonly market_size_mw: number | string | null;
  readonly year_num: number | string;
}

export interface PricingHistoryRow {
  readonly high_range_max: number | string | null;
  readonly high_range_min: number | string | null;
  readonly hyper_max: number | string | null;
  readonly hyper_min: number | string | null;
  readonly low_range_max: number | string | null;
  readonly low_range_min: number | string | null;
  readonly year_num: number | string;
}

export interface PricingRatioRow {
  readonly hyperscale_avg: number | string | null;
  readonly hyperscale_std_dev: number | string | null;
  readonly hyperscale_value: number | string | null;
  readonly latest_year: number | string | null;
  readonly retail_avg: number | string | null;
  readonly retail_std_dev: number | string | null;
  readonly retail_value: number | string | null;
  readonly wholesale_avg: number | string | null;
  readonly wholesale_std_dev: number | string | null;
  readonly wholesale_value: number | string | null;
}

export interface PricingForecastRow {
  readonly hyper_max: number | string | null;
  readonly hyper_min: number | string | null;
  readonly retail_max: number | string | null;
  readonly retail_min: number | string | null;
  readonly wholesale_max: number | string | null;
  readonly wholesale_min: number | string | null;
  readonly year_num: number | string;
}
