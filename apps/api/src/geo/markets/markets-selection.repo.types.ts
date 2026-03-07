export interface MarketSelectionRow {
  readonly absorption: number | string | null;
  readonly country: string | null;
  readonly intersection_area_sq_km: number | string;
  readonly latitude: number | string | null;
  readonly longitude: number | string | null;
  readonly market_area_sq_km: number | string;
  readonly market_id: number | string;
  readonly name: string | null;
  readonly region: string | null;
  readonly selection_area_sq_km: number | string;
  readonly state: string | null;
  readonly updated_at: Date | string | null;
  readonly vacancy: number | string | null;
}

export interface MarketsSelectionQuery {
  readonly geometryGeoJson: string;
  readonly limit: number;
  readonly minimumSelectionOverlapPercent: number;
}
