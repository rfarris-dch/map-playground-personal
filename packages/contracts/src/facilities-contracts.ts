import { z } from "zod";
import {
  CommissionedSemanticSchema,
  FacilityPerspectiveSchema,
  LeaseOrOwnSchema,
  PointGeometrySchema,
  ResponseMetaSchema,
} from "./shared-contracts";

export const FacilitiesPropertiesSchema = z.object({
  perspective: FacilityPerspectiveSchema,
  facilityId: z.string(),
  providerId: z.string(),
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

export type FacilitiesFeature = z.infer<typeof FacilitiesFeatureSchema>;
export type FacilitiesFeatureCollection = z.infer<typeof FacilitiesFeatureCollectionSchema>;

export const FacilitiesDetailPropertiesSchema = z.object({
  perspective: FacilityPerspectiveSchema,
  facilityId: z.string(),
  providerId: z.string(),
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

export type FacilitiesDetailFeature = z.infer<typeof FacilitiesDetailFeatureSchema>;
export type FacilitiesDetailResponse = z.infer<typeof FacilitiesDetailResponseSchema>;
