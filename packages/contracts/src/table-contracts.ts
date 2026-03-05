import { z } from "zod";
import {
  CommissionedSemanticSchema,
  FacilityPerspectiveSchema,
  LeaseOrOwnSchema,
} from "@/shared-contracts";

export type {
  FacilitiesTableResponse,
  FacilitySortBy,
  FacilityTableRow,
  MarketSortBy,
  MarketsTableResponse,
  MarketTableRow,
  ProviderSortBy,
  ProvidersTableResponse,
  ProviderTableRow,
  SortDirection,
} from "./table-contracts.types";

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
  supportsRetail: z.boolean(),
  supportsWholesale: z.boolean(),
  updatedAt: z.string().nullable(),
});

export const ProvidersTableResponseSchema = z.object({
  rows: z.array(ProviderTableRowSchema),
  pagination: PaginationSchema,
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
