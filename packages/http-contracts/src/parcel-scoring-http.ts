/**
 * Parcel scoring and proximity contracts.
 *
 * Split from analysis-contracts.ts — these are the actual spatial analysis
 * HTTP request/response shapes for scoring and proximity operations.
 */
import { AreaOfInterestSchema } from "@map-migration/geo-kernel/area-of-interest";
import { FacilityPerspectiveSchema } from "@map-migration/geo-kernel/facility-perspective";
import { GeometrySchema } from "@map-migration/geo-kernel/geometry";
import { z } from "zod";
import { ApiErrorResponseSchema } from "./api-error.js";
import { ResponseMetaSchema } from "./api-response-meta.js";
import { ParcelFeatureSchema } from "./parcels-http.js";

export const ParcelScoreConstraintSchema = z.object({
  key: z.string().min(1),
  passed: z.boolean(),
  reason: z.string().min(1).optional(),
});

export const ParcelScoreComponentSchema = z.object({
  key: z.string().min(1),
  weight: z.number(),
  rawValue: z.unknown(),
  normalizedValue: z.number(),
  contribution: z.number(),
  confidence: z.number(),
});

export const ScoredParcelSchema = z.object({
  parcel: ParcelFeatureSchema,
  scoreTotal: z.number(),
  confidenceScore: z.number(),
  constraints: z.array(ParcelScoreConstraintSchema),
  components: z.array(ParcelScoreComponentSchema),
  provenance: z.object({
    modelId: z.string().min(1),
    modelVersion: z.number().int().nonnegative(),
    ingestionRunId: z.string().min(1),
    boundarySetId: z.string().min(1).optional(),
    boundarySetVersion: z.number().int().nonnegative().optional(),
  }),
});

export const ParcelScoreRequestSchema = z.object({
  aoi: AreaOfInterestSchema,
  modelId: z.string().min(1),
  modelVersion: z.number().int().nonnegative(),
  overrides: z.record(z.string(), z.unknown()).optional(),
});

export const ParcelScoreResponseSchema = z.object({
  status: z.literal("ok"),
  results: z.array(ScoredParcelSchema),
  meta: ResponseMetaSchema,
});

export const ProximityTargetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("parcel"),
    parcelId: z.string().min(1),
  }),
  z.object({
    type: z.literal("facility"),
    facilityId: z.string().min(1),
    perspective: FacilityPerspectiveSchema,
  }),
  z.object({
    type: z.literal("geometry"),
    geometry: GeometrySchema,
  }),
]);

export const ProximityNeighborTypeSchema = z.enum([
  "power_substation",
  "fiber_metro",
  "fiber_longhaul",
  "facility_colocation",
  "facility_hyperscale",
]);

export const ProximityRequestSchema = z.object({
  target: ProximityTargetSchema,
  neighborTypes: z.array(ProximityNeighborTypeSchema).min(1),
  limit: z.number().int().positive().max(50).default(5),
});

export const ProximityNeighborSchema = z.object({
  neighborType: ProximityNeighborTypeSchema,
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  distanceMeters: z.number().nonnegative(),
  bearingDegrees: z.number(),
  confidence: z.number().optional(),
});

export const ProximityResponseSchema = z.object({
  status: z.literal("ok"),
  neighbors: z.array(ProximityNeighborSchema),
  meta: ResponseMetaSchema,
});

export const AnalysisErrorResponseSchema = ApiErrorResponseSchema;

export type ParcelScoreConstraint = z.infer<typeof ParcelScoreConstraintSchema>;
export type ParcelScoreComponent = z.infer<typeof ParcelScoreComponentSchema>;
export type ScoredParcel = z.infer<typeof ScoredParcelSchema>;
export type ParcelScoreRequest = z.infer<typeof ParcelScoreRequestSchema>;
export type ParcelScoreResponse = z.infer<typeof ParcelScoreResponseSchema>;
export type ProximityTarget = z.infer<typeof ProximityTargetSchema>;
export type ProximityNeighborType = z.infer<typeof ProximityNeighborTypeSchema>;
export type ProximityRequest = z.infer<typeof ProximityRequestSchema>;
export type ProximityNeighbor = z.infer<typeof ProximityNeighborSchema>;
export type ProximityResponse = z.infer<typeof ProximityResponseSchema>;
export type AnalysisErrorResponse = z.infer<typeof AnalysisErrorResponseSchema>;
