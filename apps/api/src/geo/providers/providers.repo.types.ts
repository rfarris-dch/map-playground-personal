import type { ProviderSortBy, SortDirection } from "@map-migration/http-contracts/table-contracts";

export interface ProvidersPageQuery {
  readonly limit: number;
  readonly offset: number;
  readonly sortBy: ProviderSortBy;
  readonly sortOrder: SortDirection;
}

export interface ProviderListRow {
  readonly category: string | null;
  readonly country: string | null;
  readonly listing_count: number | string | null;
  readonly name: string | null;
  readonly provider_id: number | string;
  readonly state: string | null;
  readonly supports_hyperscale: number | string | boolean | null;
  readonly supports_colocation: number | string | boolean | null;
  readonly updated_at: Date | string | null;
}

export interface ProviderCountRow {
  readonly total_count: number | string;
}
