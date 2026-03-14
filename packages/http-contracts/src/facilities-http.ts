import {
  CommissionedSemanticSchema,
  LeaseOrOwnSchema,
} from "@map-migration/geo-kernel/commissioned-semantic";
import { FacilityPerspectiveSchema } from "@map-migration/geo-kernel/facility-perspective";
import {
  BBoxSchema,
  PointGeometrySchema,
  PolygonGeometrySchema,
  parseBboxParam,
} from "@map-migration/geo-kernel/geometry";
import { z } from "zod";
import { ResponseMetaSchema } from "./api-response-meta.js";

function trimValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseBboxQuery(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const parsed = parseBboxParam(value);
  return parsed ?? value;
}

function parsePositiveInteger(value: unknown): unknown {
  const normalized = trimValue(value);
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

export const FacilitiesBboxRequestSchema = z.object({
  bbox: z.preprocess(parseBboxQuery, BBoxSchema),
  perspective: z.preprocess(trimValue, FacilityPerspectiveSchema).default("colocation"),
  limit: z.preprocess(parsePositiveInteger, z.number().int().positive().max(100_000)).default(2000),
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

export const FacilityDetailPathSchema = z.object({
  facilityId: z.preprocess(trimValue, z.string().min(1)),
});

export const FacilitiesDetailRequestSchema = z.object({
  perspective: z.preprocess(trimValue, FacilityPerspectiveSchema).default("colocation"),
});

export type FacilitiesFeature = z.infer<typeof FacilitiesFeatureSchema>;
export type FacilitiesFeatureCollection = z.infer<typeof FacilitiesFeatureCollectionSchema>;
export type FacilitiesBboxRequest = z.infer<typeof FacilitiesBboxRequestSchema>;
export type FacilitiesSelectionRequest = z.infer<typeof FacilitiesSelectionRequestSchema>;
export type FacilitiesSelectionResponse = z.infer<typeof FacilitiesSelectionResponseSchema>;
export type FacilitiesDetailFeature = z.infer<typeof FacilitiesDetailFeatureSchema>;
export type FacilitiesDetailResponse = z.infer<typeof FacilitiesDetailResponseSchema>;
export type FacilityDetailPath = z.infer<typeof FacilityDetailPathSchema>;
export type FacilitiesDetailRequest = z.infer<typeof FacilitiesDetailRequestSchema>;
