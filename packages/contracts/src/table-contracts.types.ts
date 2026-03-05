import type { z } from "zod";
import type {
  FacilitiesTableResponseSchema,
  FacilitySortBySchema,
  FacilityTableRowSchema,
  MarketSortBySchema,
  MarketsTableResponseSchema,
  MarketTableRowSchema,
  ProviderSortBySchema,
  ProvidersTableResponseSchema,
  ProviderTableRowSchema,
  SortDirectionSchema,
} from "./table-contracts";

export type FacilitiesTableResponse = z.infer<typeof FacilitiesTableResponseSchema>;

export type FacilityTableRow = z.infer<typeof FacilityTableRowSchema>;

export type FacilitySortBy = z.infer<typeof FacilitySortBySchema>;

export type ProvidersTableResponse = z.infer<typeof ProvidersTableResponseSchema>;

export type ProviderTableRow = z.infer<typeof ProviderTableRowSchema>;

export type ProviderSortBy = z.infer<typeof ProviderSortBySchema>;

export type MarketsTableResponse = z.infer<typeof MarketsTableResponseSchema>;

export type MarketTableRow = z.infer<typeof MarketTableRowSchema>;

export type MarketSortBy = z.infer<typeof MarketSortBySchema>;

export type SortDirection = z.infer<typeof SortDirectionSchema>;
