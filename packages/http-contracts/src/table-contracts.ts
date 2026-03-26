/**
 * Table contracts barrel — re-exports shared pagination primitives and
 * all domain-specific table contracts.
 */

// biome-ignore-all lint/performance/noBarrelFile: public package contract entrypoint is intentional.

// Shared primitives
export {
  type Pagination,
  PaginationSchema,
  type SortDirection,
  SortDirectionSchema,
} from "./_pagination.js";
export {
  type FacilitiesTableRequest,
  FacilitiesTableRequestSchema,
  type FacilitiesTableResponse,
  FacilitiesTableResponseSchema,
  type FacilitySortBy,
  FacilitySortBySchema,
  type FacilityTableRow,
  FacilityTableRowSchema,
} from "./facilities-table-http.js";
// Domain-specific table contracts
export {
  type MarketSortBy,
  MarketSortBySchema,
  type MarketsTableRequest,
  MarketsTableRequestSchema,
  type MarketsTableResponse,
  MarketsTableResponseSchema,
  type MarketTableRow,
  MarketTableRowSchema,
} from "./markets-table-http.js";
export {
  type ProviderSortBy,
  ProviderSortBySchema,
  type ProvidersTableRequest,
  ProvidersTableRequestSchema,
  type ProvidersTableResponse,
  ProvidersTableResponseSchema,
  type ProviderTableRow,
  ProviderTableRowSchema,
} from "./providers-table-http.js";
