import type { MarketSortBy, SortDirection } from "@map-migration/contracts";

export interface MarketPageQuery {
  readonly limit: number;
  readonly offset: number;
  readonly sortBy: MarketSortBy;
  readonly sortOrder: SortDirection;
}

export interface MarketListRow {
  readonly absorption: number | string | null;
  readonly country: string | null;
  readonly market_id: number | string;
  readonly name: string | null;
  readonly region: string | null;
  readonly state: string | null;
  readonly updated_at: Date | string | null;
  readonly vacancy: number | string | null;
}

export interface MarketCountRow {
  readonly total_count: number | string;
}
