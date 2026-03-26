import { FacilityPerspectiveSchema } from "@map-migration/geo-kernel/facility-perspective";
import { PointGeometrySchema, PolygonGeometrySchema } from "@map-migration/geo-kernel/geometry";
import { z } from "zod";
import { FacilityCorePropertiesSchema } from "./_facility-core.js";
import {
  BboxQuerySchema,
  queryIntegerWithDefault,
  trimmedEnumWithDefault,
  trimQueryValue,
} from "./_query-parsing.js";
import { ResponseMetaSchema } from "./api-response-meta.js";

// ---------------------------------------------------------------------------
// Bbox feature — loosened optionality for bbox results where some fields
// may be absent from the projection.
// ---------------------------------------------------------------------------

export const FacilitiesPropertiesSchema = FacilityCorePropertiesSchema.extend({
  countyFips: z.string().nullable().optional(),
  squareFootage: z.number().nullable().optional(),
  facilityCode: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
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

/**
 * FIX: default limit aligned to ApiQueryDefaults.facilities.bboxLimit (50_000).
 * Previously defaulted to 2000 while the config said 50_000.
 * FIX: datasetVersion now modeled in the request schema (was only in route builder).
 */
export const FacilitiesBboxRequestSchema = z.object({
  bbox: BboxQuerySchema,
  datasetVersion: z.preprocess(trimQueryValue, z.string().min(1)).optional(),
  perspective: trimmedEnumWithDefault(FacilityPerspectiveSchema, "colocation"),
  limit: queryIntegerWithDefault(50_000, { min: 1, max: 100_000 }),
});

export const FacilitiesDatasetManifestEntrySchema = z.object({
  version: z.string().min(1),
  warmProfileVersion: z.string().min(1).optional(),
});

export const FacilitiesDatasetManifestSchema = z.object({
  dataset: z.literal("facilities"),
  publishedAt: z.string().datetime(),
  current: FacilitiesDatasetManifestEntrySchema,
  previous: FacilitiesDatasetManifestEntrySchema.optional(),
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

/**
 * Selection summary uses the HTTP perspective subset since response shapes
 * are structurally keyed to colocation + hyperscale only.
 */
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

// ---------------------------------------------------------------------------
// Detail — all core fields required-nullable (canonical shape).
// ---------------------------------------------------------------------------

export const FacilitiesDetailPropertiesSchema = FacilityCorePropertiesSchema.extend({
  countyFips: z.string(),
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
  facilityId: z.preprocess(trimQueryValue, z.string().min(1)),
});

/**
 * FIX: datasetVersion now modeled in the request schema (was only in route builder via `v`).
 */
export const FacilitiesDetailRequestSchema = z.object({
  perspective: trimmedEnumWithDefault(FacilityPerspectiveSchema, "colocation"),
  datasetVersion: z.preprocess(trimQueryValue, z.string().min(1)).optional(),
});

export type FacilitiesFeature = z.infer<typeof FacilitiesFeatureSchema>;
export type FacilitiesFeatureCollection = z.infer<typeof FacilitiesFeatureCollectionSchema>;
export type FacilitiesBboxRequest = z.infer<typeof FacilitiesBboxRequestSchema>;
export type FacilitiesDatasetManifest = z.infer<typeof FacilitiesDatasetManifestSchema>;
export type FacilitiesSelectionRequest = z.infer<typeof FacilitiesSelectionRequestSchema>;
export type FacilitiesSelectionResponse = z.infer<typeof FacilitiesSelectionResponseSchema>;
export type FacilitiesDetailFeature = z.infer<typeof FacilitiesDetailFeatureSchema>;
export type FacilitiesDetailResponse = z.infer<typeof FacilitiesDetailResponseSchema>;
export type FacilityDetailPath = z.infer<typeof FacilityDetailPathSchema>;
export type FacilitiesDetailRequest = z.infer<typeof FacilitiesDetailRequestSchema>;
