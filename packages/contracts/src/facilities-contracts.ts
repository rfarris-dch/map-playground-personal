import { z } from "zod";
import {
  CommissionedSemanticSchema,
  FacilityPerspectiveSchema,
  LeaseOrOwnSchema,
  PointGeometrySchema,
  PolygonGeometrySchema,
  ResponseMetaSchema,
} from "@/shared-contracts";

export type {
  FacilitiesDetailFeature,
  FacilitiesDetailResponse,
  FacilitiesFeature,
  FacilitiesFeatureCollection,
  FacilitiesSelectionRequest,
  FacilitiesSelectionResponse,
} from "./facilities-contracts.types";

export const FacilitiesPropertiesSchema = z.object({
  perspective: FacilityPerspectiveSchema,
  facilityId: z.string(),
  facilityName: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  countyFips: z.string(),
  commissionedPowerMw: z.number().nullable(),
  commissionedSemantic: CommissionedSemanticSchema,
  leaseOrOwn: LeaseOrOwnSchema.nullable(),
});

export const FacilitiesFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.union([z.string(), z.number()]),
  geometry: PointGeometrySchema,
  properties: FacilitiesPropertiesSchema,
});

export const FacilitiesFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(FacilitiesFeatureSchema),
  meta: ResponseMetaSchema,
});

export const FacilitiesSelectionPolygonGeometrySchema = PolygonGeometrySchema;

export const FacilitiesSelectionRequestSchema = z.object({
  geometry: FacilitiesSelectionPolygonGeometrySchema,
  perspectives: z
    .array(FacilityPerspectiveSchema)
    .min(1)
    .max(2)
    .default(["colocation", "hyperscale"]),
  limitPerPerspective: z.number().int().positive().max(100_000).default(5000),
});

export const FacilitiesSelectionSummarySchema = z.object({
  countsByPerspective: z.object({
    colocation: z.number().int().nonnegative(),
    hyperscale: z.number().int().nonnegative(),
  }),
  truncatedByPerspective: z.object({
    colocation: z.boolean(),
    hyperscale: z.boolean(),
  }),
});

export const FacilitiesSelectionResponseSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(FacilitiesFeatureSchema),
  meta: ResponseMetaSchema,
  selection: FacilitiesSelectionSummarySchema,
});

export const FacilitiesDetailPropertiesSchema = z.object({
  perspective: FacilityPerspectiveSchema,
  facilityId: z.string(),
  facilityName: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  countyFips: z.string(),
  commissionedSemantic: CommissionedSemanticSchema,
  leaseOrOwn: LeaseOrOwnSchema.nullable(),
  commissionedPowerMw: z.number().nullable(),
  plannedPowerMw: z.number().nullable(),
  underConstructionPowerMw: z.number().nullable(),
  availablePowerMw: z.number().nullable(),
});

export const FacilitiesDetailFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.union([z.string(), z.number()]),
  geometry: PointGeometrySchema,
  properties: FacilitiesDetailPropertiesSchema,
});

export const FacilitiesDetailResponseSchema = z.object({
  feature: FacilitiesDetailFeatureSchema,
  meta: ResponseMetaSchema,
});
