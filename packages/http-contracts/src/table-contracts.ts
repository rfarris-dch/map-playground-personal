/**
 * Table contracts barrel — re-exports shared pagination primitives and
 * all domain-specific table contracts.
 */

// Shared primitives
export {
  PaginationSchema,
  SortDirectionSchema,
  type Pagination,
  type SortDirection,
} from "./_pagination.js";

// Domain-specific table contracts
export {
  MarketSortBySchema,
  MarketTableRowSchema,
  MarketsTableResponseSchema,
  MarketsTableRequestSchema,
  type MarketSortBy,
  type MarketTableRow,
  type MarketsTableResponse,
  type MarketsTableRequest,
} from "./markets-table-http.js";

export {
  ProviderSortBySchema,
  ProviderTableRowSchema,
  ProvidersTableResponseSchema,
  ProvidersTableRequestSchema,
  type ProviderSortBy,
  type ProviderTableRow,
  type ProvidersTableResponse,
  type ProvidersTableRequest,
} from "./providers-table-http.js";

export {
  FacilitySortBySchema,
  FacilityTableRowSchema,
  FacilitiesTableResponseSchema,
  FacilitiesTableRequestSchema,
  type FacilitySortBy,
  type FacilityTableRow,
  type FacilitiesTableResponse,
  type FacilitiesTableRequest,
} from "./facilities-table-http.js";
