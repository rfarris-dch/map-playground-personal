/**
 * Provider table contracts — pagination, sorting, and row schemas
 * specific to the providers table endpoint.
 */
import { z } from "zod";
import {
  PageQuerySchema,
  PageSizeQuerySchema,
  paginationOffsetGuard,
  trimmedEnumWithDefault,
} from "./_query-parsing.js";
import { PaginationSchema, SortDirectionSchema } from "./_pagination.js";

export const ProviderSortBySchema = z.enum([
  "name",
  "category",
  "country",
  "state",
  "listingCount",
  "updatedAt",
]);

export const ProviderTableRowSchema = z.object({
  providerId: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  country: z.string().nullable(),
  state: z.string().nullable(),
  listingCount: z.number().int().nullable(),
  supportsHyperscale: z.boolean(),
  supportsColocation: z.boolean(),
  updatedAt: z.string().datetime().nullable(),
});

export const ProvidersTableResponseSchema = z.object({
  rows: z.array(ProviderTableRowSchema),
  pagination: PaginationSchema,
});

export const ProvidersTableRequestSchema = z
  .object({
    page: PageQuerySchema,
    pageSize: PageSizeQuerySchema,
    sortBy: trimmedEnumWithDefault(ProviderSortBySchema, "name"),
    sortOrder: trimmedEnumWithDefault(SortDirectionSchema, "asc"),
  })
  .superRefine(paginationOffsetGuard);

export type ProviderSortBy = z.infer<typeof ProviderSortBySchema>;
export type ProviderTableRow = z.infer<typeof ProviderTableRowSchema>;
export type ProvidersTableResponse = z.infer<typeof ProvidersTableResponseSchema>;
export type ProvidersTableRequest = z.infer<typeof ProvidersTableRequestSchema>;
