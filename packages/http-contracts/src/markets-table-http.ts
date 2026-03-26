/**
 * Market table contracts — pagination, sorting, and row schemas
 * specific to the markets table endpoint.
 */
import { z } from "zod";
import { PaginationSchema, SortDirectionSchema } from "./_pagination.js";
import {
  PageQuerySchema,
  PageSizeQuerySchema,
  paginationOffsetGuard,
  trimmedEnumWithDefault,
} from "./_query-parsing.js";

export const MarketSortBySchema = z.enum([
  "name",
  "region",
  "country",
  "state",
  "absorption",
  "vacancy",
  "updatedAt",
]);

export const MarketTableRowSchema = z.object({
  marketId: z.string(),
  name: z.string(),
  region: z.string().nullable(),
  country: z.string().nullable(),
  state: z.string().nullable(),
  absorption: z.number().nullable(),
  vacancy: z.number().nullable(),
  updatedAt: z.string().datetime().nullable(),
});

export const MarketsTableResponseSchema = z.object({
  rows: z.array(MarketTableRowSchema),
  pagination: PaginationSchema,
});

export const MarketsTableRequestSchema = z
  .object({
    page: PageQuerySchema,
    pageSize: PageSizeQuerySchema,
    sortBy: trimmedEnumWithDefault(MarketSortBySchema, "name"),
    sortOrder: trimmedEnumWithDefault(SortDirectionSchema, "asc"),
  })
  .superRefine(paginationOffsetGuard);

export type MarketSortBy = z.infer<typeof MarketSortBySchema>;
export type MarketTableRow = z.infer<typeof MarketTableRowSchema>;
export type MarketsTableResponse = z.infer<typeof MarketsTableResponseSchema>;
export type MarketsTableRequest = z.infer<typeof MarketsTableRequestSchema>;
