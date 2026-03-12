export interface FloodAreaSummaryRow {
  readonly data_version: string | null | undefined;
  readonly dataset_feature_count: number | string | null | undefined;
  readonly flood100_area_sq_km: number | string | null | undefined;
  readonly flood500_area_sq_km: number | string | null | undefined;
  readonly run_id: string | null | undefined;
  readonly selection_area_sq_km: number | string | null | undefined;
}

export interface FloodParcelRollupRow {
  readonly parcel_count_intersecting_flood_100: number | string | null | undefined;
  readonly parcel_count_intersecting_flood_500: number | string | null | undefined;
  readonly parcel_count_outside_mapped_flood: number | string | null | undefined;
  readonly selected_parcel_count: number | string | null | undefined;
}
