export interface ProviderCapacityTotalsRow {
  readonly available_power: number | string | null;
  readonly commissioned_power: number | string | null;
  readonly planned_power: number | string | null;
  readonly region_name: string | null;
  readonly uc_power: number | string | null;
}

export interface HyperscaleLeasedYearRow {
  readonly leased_power: number | string | null;
  readonly region_name: string | null;
  readonly year_num: number | string;
}

export interface HyperscaleMarketLeasedRow {
  readonly leased_power: number | string | null;
  readonly market_name: string;
  readonly region_name: string | null;
}
