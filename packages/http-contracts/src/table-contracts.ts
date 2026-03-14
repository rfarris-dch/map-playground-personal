import {
  CommissionedSemanticSchema,
  LeaseOrOwnSchema,
} from "@map-migration/geo-kernel/commissioned-semantic";
import { FacilityPerspectiveSchema } from "@map-migration/geo-kernel/facility-perspective";
import { z } from "zod";

function trimQueryValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseQueryInteger(value: unknown): unknown {
  const normalized = trimQueryValue(value);
  if (typeof normalized === "undefined") {
    return undefined;
  }

  if (typeof normalized === "number") {
    return normalized;
  }

  if (typeof normalized !== "string") {
    return normalized;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : normalized;
}

const PageQuerySchema = z.preprocess(parseQueryInteger, z.number().int().nonnegative()).default(0);
const PageSizeQuerySchema = z
  .preprocess(parseQueryInteger, z.number().int().positive().max(500))
  .default(100);

export const PaginationSchema = z.object({
  page: z.number().int().nonnegative(),
  pageSize: z.number().int().positive(),
  totalCount: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const SortDirectionSchema = z.enum(["asc", "desc"]);

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
  updatedAt: z.string().nullable(),
});

export const MarketsTableResponseSchema = z.object({
  rows: z.array(MarketTableRowSchema),
  pagination: PaginationSchema,
});

export const MarketsTableRequestSchema = z
  .object({
    page: PageQuerySchema,
    pageSize: PageSizeQuerySchema,
    sortBy: z.preprocess(trimQueryValue, MarketSortBySchema).default("name"),
    sortOrder: z.preprocess(trimQueryValue, SortDirectionSchema).default("asc"),
  })
  .superRefine((request, ctx) => {
    const offset = request.page * request.pageSize;
    if (offset > 1_000_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pagination offset exceeds maximum of 1000000",
        path: ["page"],
      });
    }
  });

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
  updatedAt: z.string().nullable(),
});

export const ProvidersTableResponseSchema = z.object({
  rows: z.array(ProviderTableRowSchema),
  pagination: PaginationSchema,
});

export const ProvidersTableRequestSchema = z
  .object({
    page: PageQuerySchema,
    pageSize: PageSizeQuerySchema,
    sortBy: z.preprocess(trimQueryValue, ProviderSortBySchema).default("name"),
    sortOrder: z.preprocess(trimQueryValue, SortDirectionSchema).default("asc"),
  })
  .superRefine((request, ctx) => {
    const offset = request.page * request.pageSize;
    if (offset > 1_000_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pagination offset exceeds maximum of 1000000",
        path: ["page"],
      });
    }
  });

export const FacilitySortBySchema = z.enum([
  "facilityName",
  "providerId",
  "stateAbbrev",
  "commissionedSemantic",
  "leaseOrOwn",
  "commissionedPowerMw",
  "plannedPowerMw",
  "underConstructionPowerMw",
  "availablePowerMw",
  "updatedAt",
]);

export const FacilityTableRowSchema = z.object({
  perspective: FacilityPerspectiveSchema,
  facilityId: z.string(),
  facilityName: z.string(),
  providerId: z.string().nullable(),
  stateAbbrev: z.string().nullable(),
  commissionedSemantic: CommissionedSemanticSchema,
  leaseOrOwn: LeaseOrOwnSchema.nullable(),
  commissionedPowerMw: z.number().nullable(),
  plannedPowerMw: z.number().nullable(),
  underConstructionPowerMw: z.number().nullable(),
  availablePowerMw: z.number().nullable(),
  updatedAt: z.string().nullable(),
});

export const FacilitiesTableResponseSchema = z.object({
  rows: z.array(FacilityTableRowSchema),
  pagination: PaginationSchema,
});

export const FacilitiesTableRequestSchema = z
  .object({
    page: PageQuerySchema,
    pageSize: PageSizeQuerySchema,
    perspective: z.preprocess(trimQueryValue, FacilityPerspectiveSchema).default("colocation"),
    sortBy: z.preprocess(trimQueryValue, FacilitySortBySchema).default("facilityName"),
    sortOrder: z.preprocess(trimQueryValue, SortDirectionSchema).default("asc"),
  })
  .superRefine((request, ctx) => {
    const offset = request.page * request.pageSize;
    if (offset > 1_000_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pagination offset exceeds maximum of 1000000",
        path: ["page"],
      });
    }
  });

export type SortDirection = z.infer<typeof SortDirectionSchema>;
export type MarketSortBy = z.infer<typeof MarketSortBySchema>;
export type MarketTableRow = z.infer<typeof MarketTableRowSchema>;
export type MarketsTableResponse = z.infer<typeof MarketsTableResponseSchema>;
export type MarketsTableRequest = z.infer<typeof MarketsTableRequestSchema>;
export type ProviderSortBy = z.infer<typeof ProviderSortBySchema>;
export type ProviderTableRow = z.infer<typeof ProviderTableRowSchema>;
export type ProvidersTableResponse = z.infer<typeof ProvidersTableResponseSchema>;
export type ProvidersTableRequest = z.infer<typeof ProvidersTableRequestSchema>;
export type FacilitySortBy = z.infer<typeof FacilitySortBySchema>;
export type FacilityTableRow = z.infer<typeof FacilityTableRowSchema>;
export type FacilitiesTableResponse = z.infer<typeof FacilitiesTableResponseSchema>;
export type FacilitiesTableRequest = z.infer<typeof FacilitiesTableRequestSchema>;
