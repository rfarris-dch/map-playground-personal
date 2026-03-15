export interface MarketBoundaryRow {
  readonly absorption: number | string | null | undefined;
  readonly commissioned_power_mw: number | string | null | undefined;
  readonly geom_json: unknown;
  readonly market_id: string;
  readonly parent_region_name: string | null | undefined;
  readonly region_id: string;
  readonly region_name: string | null | undefined;
  readonly vacancy: number | string | null | undefined;
}
