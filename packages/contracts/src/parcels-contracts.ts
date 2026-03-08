import { z } from "zod";
import {
  BBoxSchema,
  GeometrySchema,
  PolygonGeometrySchema,
  ResponseMetaSchema,
} from "./shared-contracts";

export const ParcelGeometryModeSchema = z.enum(["none", "centroid", "simplified", "full"]);
// Profile currently represents caller intent metadata and does not yet alter payload shaping.
export const ParcelProfileSchema = z.enum(["analysis_v1", "full_170"]);
export const ParcelAoiTypeSchema = z.enum(["bbox", "polygon", "county", "tileSet"]);

export const ParcelAoiBboxSchema = z.object({
  type: z.literal("bbox"),
  bbox: BBoxSchema,
});

export const ParcelAoiPolygonSchema = z.object({
  type: z.literal("polygon"),
  geometry: PolygonGeometrySchema,
});

export const ParcelAoiCountySchema = z.object({
  type: z.literal("county"),
  geoid: z.string().min(1),
});

export const ParcelAoiTileCoordinateSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

export const ParcelAoiTileSetSchema = z.object({
  type: z.literal("tileSet"),
  z: z.number().int().min(0).max(22),
  tiles: z.array(ParcelAoiTileCoordinateSchema).min(1),
});

export const ParcelAoiSchema = z
  .discriminatedUnion("type", [
    ParcelAoiBboxSchema,
    ParcelAoiPolygonSchema,
    ParcelAoiCountySchema,
    ParcelAoiTileSetSchema,
  ])
  .superRefine((aoi, ctx) => {
    if (aoi.type !== "tileSet") {
      return;
    }

    const tileCount = 2 ** aoi.z;
    for (let index = 0; index < aoi.tiles.length; index += 1) {
      const tile = aoi.tiles[index];
      if (typeof tile === "undefined") {
        continue;
      }

      if (tile.x >= tileCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `tile x must be in [0, ${String(tileCount - 1)}] for z=${String(aoi.z)}`,
          path: ["tiles", index, "x"],
        });
      }

      if (tile.y >= tileCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `tile y must be in [0, ${String(tileCount - 1)}] for z=${String(aoi.z)}`,
          path: ["tiles", index, "y"],
        });
      }
    }
  });

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
  attrs: z.record(z.unknown()),
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

export const ParcelsFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(ParcelFeatureSchema),
  meta: ParcelResponseMetaSchema,
});

export const ParcelLookupRequestSchema = z.object({
  parcelIds: z.array(z.string().min(1)).min(1).max(10_000),
  profile: ParcelProfileSchema.default("analysis_v1"),
  includeGeometry: ParcelGeometryModeSchema.default("none"),
});

export const ParcelEnrichRequestSchema = z.object({
  aoi: ParcelAoiSchema,
  profile: ParcelProfileSchema.default("analysis_v1"),
  includeGeometry: ParcelGeometryModeSchema.default("centroid"),
  pageSize: z.number().int().positive().max(100_000).default(20_000),
  cursor: z.string().nullable().optional(),
  format: z.enum(["json"]).default("json"),
});

export const ParcelSyncPhaseSchema = z.enum([
  "idle",
  "extracting",
  "loading",
  "building",
  "publishing",
  "completed",
  "failed",
]);

export const ParcelSyncRunReasonSchema = z.enum(["startup", "interval", "manual", "unknown"]);

export const ParcelSyncStateProgressSchema = z.object({
  state: z.string().min(1),
  expectedCount: z.number().int().nonnegative().nullable(),
  writtenCount: z.number().int().nonnegative(),
  pagesFetched: z.number().int().nonnegative(),
  lastSourceId: z.number().int().nullable(),
  updatedAt: z.string().datetime().nullable(),
  isCompleted: z.boolean().optional(),
});

export const ParcelSyncDbLoadProgressSchema = z.object({
  stepKey: z.string().min(1),
  percent: z.number().min(0).max(100).nullable().optional(),
  loadedFiles: z.number().int().nonnegative().nullable().optional(),
  totalFiles: z.number().int().positive().nullable().optional(),
  currentFile: z.string().nullable().optional(),
  completedStates: z.number().int().nonnegative().nullable().optional(),
  totalStates: z.number().int().nonnegative().nullable().optional(),
  activeWorkers: z.array(z.string().min(1)).optional(),
});

export const ParcelSyncTileBuildProgressSchema = z.object({
  stage: z.enum(["build", "convert", "ready"]),
  percent: z.number().min(0).max(100).nullable().optional(),
  logBytes: z.number().int().nonnegative().nullable().optional(),
  readFeatures: z.number().int().nonnegative().nullable().optional(),
  totalFeatures: z.number().int().nonnegative().nullable().optional(),
  workDone: z.number().int().nonnegative().nullable().optional(),
  workLeft: z.number().int().nonnegative().nullable().optional(),
  workTotal: z.number().int().nonnegative().nullable().optional(),
  convertPercent: z.number().min(0).max(100).nullable().optional(),
  convertDone: z.number().int().nonnegative().nullable().optional(),
  convertTotal: z.number().int().nonnegative().nullable().optional(),
  convertAttempt: z.number().int().positive().nullable().optional(),
  convertAttemptTotal: z.number().int().positive().nullable().optional(),
});

export const ParcelSyncProgressSchema = z.object({
  schemaVersion: z.literal(1),
  phase: ParcelSyncPhaseSchema,
  dbLoad: ParcelSyncDbLoadProgressSchema.optional(),
  tileBuild: ParcelSyncTileBuildProgressSchema.optional(),
});

export const ParcelSyncRunStatusSchema = z.object({
  runId: z.string().nullable(),
  reason: ParcelSyncRunReasonSchema.nullable(),
  phase: ParcelSyncPhaseSchema,
  isRunning: z.boolean(),
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  exitCode: z.number().int().nullable(),
  summary: z.string().nullable(),
  progress: ParcelSyncProgressSchema.nullable().optional(),
  states: z.array(ParcelSyncStateProgressSchema),
  statesCompleted: z.number().int().nonnegative(),
  statesTotal: z.number().int().nonnegative(),
  writtenCount: z.number().int().nonnegative(),
  expectedCount: z.number().int().nonnegative().nullable(),
  logTail: z.array(z.string()),
});

export const ParcelsSyncStatusResponseSchema = z.object({
  status: z.literal("ok"),
  generatedAt: z.string().datetime(),
  enabled: z.boolean(),
  mode: z.enum(["external", "in-process"]),
  intervalMs: z.number().int().positive(),
  requireStartupSuccess: z.boolean(),
  snapshotRoot: z.string().min(1),
  latestRunId: z.string().nullable(),
  latestRunCompletedAt: z.string().datetime().nullable(),
  run: ParcelSyncRunStatusSchema,
});

export type ParcelGeometryMode = z.infer<typeof ParcelGeometryModeSchema>;
export type ParcelProfile = z.infer<typeof ParcelProfileSchema>;
export type ParcelAoi = z.infer<typeof ParcelAoiSchema>;
export type ParcelResponseMeta = z.infer<typeof ParcelResponseMetaSchema>;
export type ParcelFeature = z.infer<typeof ParcelFeatureSchema>;
export type ParcelDetailResponse = z.infer<typeof ParcelDetailResponseSchema>;
export type ParcelsFeatureCollection = z.infer<typeof ParcelsFeatureCollectionSchema>;
export type ParcelLookupRequest = z.infer<typeof ParcelLookupRequestSchema>;
export type ParcelEnrichRequest = z.infer<typeof ParcelEnrichRequestSchema>;
export type ParcelSyncPhase = z.infer<typeof ParcelSyncPhaseSchema>;
export type ParcelSyncRunReason = z.infer<typeof ParcelSyncRunReasonSchema>;
export type ParcelSyncStateProgress = z.infer<typeof ParcelSyncStateProgressSchema>;
export type ParcelSyncDbLoadProgress = z.infer<typeof ParcelSyncDbLoadProgressSchema>;
export type ParcelSyncTileBuildProgress = z.infer<typeof ParcelSyncTileBuildProgressSchema>;
export type ParcelSyncProgress = z.infer<typeof ParcelSyncProgressSchema>;
export type ParcelSyncRunStatus = z.infer<typeof ParcelSyncRunStatusSchema>;
export type ParcelsSyncStatusResponse = z.infer<typeof ParcelsSyncStatusResponseSchema>;
