/**
 * Facility table contracts — pagination, sorting, and row schemas
 * specific to the facilities table endpoint.
 */
import {
  CommissionedSemanticSchema,
  LeaseOrOwnSchema,
} from "@map-migration/geo-kernel/commissioned-semantic";
import { FacilityPerspectiveSchema } from "@map-migration/geo-kernel/facility-perspective";
import { z } from "zod";
import { FacilityCorePropertiesSchema } from "./_facility-core.js";
import {
  PageQuerySchema,
  PageSizeQuerySchema,
  paginationOffsetGuard,
  trimmedEnumWithDefault,
} from "./_query-parsing.js";
import { PaginationSchema, SortDirectionSchema } from "./_pagination.js";

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

export const FacilityTableRowSchema = FacilityCorePropertiesSchema.pick({
  perspective: true,
  facilityId: true,
  facilityName: true,
  stateAbbrev: true,
  commissionedPowerMw: true,
  plannedPowerMw: true,
  underConstructionPowerMw: true,
  availablePowerMw: true,
}).extend({
  providerId: z.string().nullable(),
  providerName: z.string().nullable(),
  commissionedSemantic: CommissionedSemanticSchema,
  leaseOrOwn: LeaseOrOwnSchema.nullable(),
  updatedAt: z.string().datetime().nullable(),
});

export const FacilitiesTableResponseSchema = z.object({
  rows: z.array(FacilityTableRowSchema),
  pagination: PaginationSchema,
});

export const FacilitiesTableRequestSchema = z
  .object({
    page: PageQuerySchema,
    pageSize: PageSizeQuerySchema,
    perspective: trimmedEnumWithDefault(FacilityPerspectiveSchema, "colocation"),
    sortBy: trimmedEnumWithDefault(FacilitySortBySchema, "facilityName"),
    sortOrder: trimmedEnumWithDefault(SortDirectionSchema, "asc"),
    datasetVersion: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() || undefined : v),
      z.string().min(1)
    ).optional(),
  })
  .superRefine(paginationOffsetGuard);

export type FacilitySortBy = z.infer<typeof FacilitySortBySchema>;
export type FacilityTableRow = z.infer<typeof FacilityTableRowSchema>;
export type FacilitiesTableResponse = z.infer<typeof FacilitiesTableResponseSchema>;
export type FacilitiesTableRequest = z.infer<typeof FacilitiesTableRequestSchema>;
