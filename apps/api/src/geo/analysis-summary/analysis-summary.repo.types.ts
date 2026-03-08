export interface AnalysisSummaryAreaRow {
  readonly county_fips: string;
  readonly selection_area_sq_km: number | string;
}

export interface AnalysisSummaryMarketBoundarySourceVersionRow {
  readonly source_version: string | null;
}
