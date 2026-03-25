import { AreaOfInterestSchema } from "@map-migration/geo-kernel/area-of-interest";
import { GeometrySchema } from "@map-migration/geo-kernel/geometry";
import { z } from "zod";
import { trimQueryValue } from "./_query-parsing.js";
import { ResponseMetaSchema } from "./api-response-meta.js";

export const ParcelGeometryModeSchema = z.enum(["none", "centroid", "simplified", "full"]);
export const ParcelProfileSchema = z.literal("analysis_v1");

/**
 * Matches the discriminant values of geo-kernel's AreaOfInterestSchema.
 * Kept as an explicit enum so the contract is self-documenting.
 */
export const ParcelAoiTypeSchema = z.enum(["bbox", "polygon", "county", "tileSet"]);

export const ParcelLineageSchema = z.object({
  source: z.string(),
  sourceOid: z.number().int().nonnegative().nullable(),
  ingestionRunId: z.string().nullable(),
  sourceUpdatedAt: z.string().datetime().nullable(),
});

export const ParcelFeaturePropertiesSchema = z.object({
  parcelId: z.string(),
  state2: z.string().length(2).nullable(),
  geoid: z.string().nullable(),
  attrs: z.record(z.string(), z.unknown()),
});

export const ParcelFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string(),
  geometry: GeometrySchema.nullable(),
  properties: ParcelFeaturePropertiesSchema,
  lineage: ParcelLineageSchema,
});

export const ParcelResponseMetaSchema = ResponseMetaSchema.extend({
  profile: ParcelProfileSchema,
  includeGeometry: ParcelGeometryModeSchema,
  aoiType: ParcelAoiTypeSchema.optional(),
  nextCursor: z.string().nullable().optional(),
});

export const ParcelDetailResponseSchema = z.object({
  feature: ParcelFeatureSchema,
  meta: ParcelResponseMetaSchema,
});

export const ParcelDetailPathSchema = z.object({
  parcelId: z.preprocess(trimQueryValue, z.string().min(1)),
});

export const ParcelDetailRequestSchema = z.object({
  profile: z.preprocess(trimQueryValue, ParcelProfileSchema).default("analysis_v1"),
  includeGeometry: z.preprocess(trimQueryValue, ParcelGeometryModeSchema).default("full"),
});

export const ParcelsFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(ParcelFeatureSchema),
  meta: ParcelResponseMetaSchema,
});

export const ParcelLookupRequestSchema = z.object({
  parcelIds: z.array(z.string().min(1)).min(1).max(1000),
  profile: ParcelProfileSchema.default("analysis_v1"),
  includeGeometry: ParcelGeometryModeSchema.default("none"),
});

export const ParcelEnrichRequestSchema = z.object({
  aoi: AreaOfInterestSchema,
  profile: ParcelProfileSchema.default("analysis_v1"),
  includeGeometry: ParcelGeometryModeSchema.default("centroid"),
  pageSize: z.number().int().positive().max(100_000).default(20_000),
  cursor: z.string().nullable().optional(),
  format: z.enum(["json"]).default("json"),
});

// ---------------------------------------------------------------------------
// Parcel sync status — re-exports from sync-run-http for backwards compat.
// The canonical sync schemas now live in sync-run-http.ts.
// ---------------------------------------------------------------------------

export {
  SyncPhaseSchema as ParcelSyncPhaseSchema,
  SyncRunReasonSchema as ParcelSyncRunReasonSchema,
  SyncStateProgressSchema as ParcelSyncStateProgressSchema,
  SyncDbLoadProgressSchema as ParcelSyncDbLoadProgressSchema,
  SyncTileBuildProgressSchema as ParcelSyncTileBuildProgressSchema,
  SyncProgressSchema as ParcelSyncProgressSchema,
  SyncRunStatusSchema as ParcelSyncRunStatusSchema,
  SyncStatusResponseSchema as ParcelsSyncStatusResponseSchema,
  type SyncPhase as ParcelSyncPhase,
  type SyncRunReason as ParcelSyncRunReason,
  type SyncStateProgress as ParcelSyncStateProgress,
  type SyncDbLoadProgress as ParcelSyncDbLoadProgress,
  type SyncTileBuildProgress as ParcelSyncTileBuildProgress,
  type SyncProgress as ParcelSyncProgress,
  type SyncRunStatus as ParcelSyncRunStatus,
  type SyncStatusResponse as ParcelsSyncStatusResponse,
} from "./sync-run-http.js";

export type ParcelGeometryMode = z.infer<typeof ParcelGeometryModeSchema>;
export type ParcelProfile = z.infer<typeof ParcelProfileSchema>;
export type ParcelResponseMeta = z.infer<typeof ParcelResponseMetaSchema>;
export type ParcelFeature = z.infer<typeof ParcelFeatureSchema>;
export type ParcelDetailResponse = z.infer<typeof ParcelDetailResponseSchema>;
export type ParcelDetailPath = z.infer<typeof ParcelDetailPathSchema>;
export type ParcelDetailRequest = z.infer<typeof ParcelDetailRequestSchema>;
export type ParcelsFeatureCollection = z.infer<typeof ParcelsFeatureCollectionSchema>;
export type ParcelLookupRequest = z.infer<typeof ParcelLookupRequestSchema>;
export type ParcelEnrichRequest = z.infer<typeof ParcelEnrichRequestSchema>;
