import { z } from "zod";
import {
  CommissionedSemanticSchema,
  FacilityPerspectiveSchema,
  LeaseOrOwnSchema,
  PointGeometrySchema,
  PolygonGeometrySchema,
} from "@map-migration/geo-kernel";
import { ResponseMetaSchema } from "./api-response-meta.js";

export const FacilitiesPropertiesSchema = z.object({
  perspective: FacilityPerspectiveSchema,
  facilityId: z.string(),
  facilityName: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  countyFips: z.string(),
  stateAbbrev: z.string().nullable(),
  commissionedPowerMw: z.number().nullable(),
  plannedPowerMw: z.number().nullable(),
  underConstructionPowerMw: z.number().nullable(),
  availablePowerMw: z.number().nullable(),
  squareFootage: z.number().nullable(),
  commissionedSemantic: CommissionedSemanticSchema,
  leaseOrOwn: LeaseOrOwnSchema.nullable(),
  statusLabel: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
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
  stateAbbrev: z.string().nullable(),
  commissionedSemantic: CommissionedSemanticSchema,
  leaseOrOwn: LeaseOrOwnSchema.nullable(),
  commissionedPowerMw: z.number().nullable(),
  plannedPowerMw: z.number().nullable(),
  underConstructionPowerMw: z.number().nullable(),
  availablePowerMw: z.number().nullable(),
  squareFootage: z.number().nullable(),
  statusLabel: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
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

export type FacilitiesFeature = z.infer<typeof FacilitiesFeatureSchema>;
export type FacilitiesFeatureCollection = z.infer<typeof FacilitiesFeatureCollectionSchema>;
export type FacilitiesSelectionRequest = z.infer<typeof FacilitiesSelectionRequestSchema>;
export type FacilitiesSelectionResponse = z.infer<typeof FacilitiesSelectionResponseSchema>;
export type FacilitiesDetailFeature = z.infer<typeof FacilitiesDetailFeatureSchema>;
export type FacilitiesDetailResponse = z.infer<typeof FacilitiesDetailResponseSchema>;
