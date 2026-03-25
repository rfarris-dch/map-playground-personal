/**
 * County intelligence debug and admin shapes.
 *
 * Split from county-intelligence-http.ts. These are operator/debug
 * tooling contracts — coverage, resolution, and detailed debug schemas.
 */
import { z } from "zod";
import { ResponseMetaSchema } from "./api-response-meta.js";
import {
  CountyConfidenceBadgeSchema,
  CountyFipsSchema,
  CountyScoreSchema,
} from "./county-intelligence-http.js";
import { parseCommaSeparated } from "./_query-parsing.js";

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

export const CountyScoresCoverageFieldSchema = z.object({
  fieldName: z.string().min(1),
  populatedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
});

export const CountyScoresCoverageByOperatorSchema = z.object({
  avgRtCongestionComponentCount: z.number().int().nonnegative(),
  countyCount: z.number().int().nonnegative(),
  meteoZoneCount: z.number().int().nonnegative(),
  operatorWeatherZoneCount: z.number().int().nonnegative(),
  operatorZoneLabelCount: z.number().int().nonnegative(),
  p95ShadowPriceCount: z.number().int().nonnegative(),
  primaryTduOrUtilityCount: z.number().int().nonnegative(),
  wholesaleOperator: z.string().min(1),
});

export const CountyScoresCoverageResponseSchema = z.object({
  publicationRunId: z.string().min(1).nullable(),
  dataVersion: z.string().min(1).nullable(),
  rowCount: z.number().int().nonnegative(),
  fields: z.array(CountyScoresCoverageFieldSchema),
  byWholesaleOperator: z.array(CountyScoresCoverageByOperatorSchema),
  meta: ResponseMetaSchema,
});

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export const CountyScoresResolutionSourceSchema = z.object({
  sourceSystem: z.string().min(1),
  totalProjects: z.number().int().nonnegative(),
  unresolvedProjects: z.number().int().nonnegative(),
  totalSnapshots: z.number().int().nonnegative(),
  unresolvedSnapshots: z.number().int().nonnegative(),
  directResolutionCount: z.number().int().nonnegative(),
  derivedResolutionCount: z.number().int().nonnegative(),
  manualResolutionCount: z.number().int().nonnegative(),
  lowConfidenceResolutionCount: z.number().int().nonnegative(),
  samplePoiLabels: z.array(z.string().min(1)),
  sampleLocationLabels: z.array(z.string().min(1)),
  sampleSnapshotPoiLabels: z.array(z.string().min(1)),
  sampleSnapshotLocationLabels: z.array(z.string().min(1)),
});

export const CountyScoresResolutionResponseSchema = z.object({
  publicationRunId: z.string().min(1).nullable(),
  dataVersion: z.string().min(1).nullable(),
  effectiveDate: z.string().date().nullable(),
  unresolvedProjectCount: z.number().int().nonnegative(),
  unresolvedSnapshotCount: z.number().int().nonnegative(),
  bySource: z.array(CountyScoresResolutionSourceSchema),
  meta: ResponseMetaSchema,
});

// ---------------------------------------------------------------------------
// Debug
// ---------------------------------------------------------------------------

export const CountyScoresDebugRequestSchema = z.object({
  countyIds: z.preprocess(parseCommaSeparated, z.array(CountyFipsSchema).min(1).max(50)),
});

export const CountyOperatorZoneDebugSchema = z.object({
  allocationShare: z.number().min(0).max(1),
  operatorZoneConfidence: CountyConfidenceBadgeSchema.nullable(),
  operatorZoneLabel: z.string().min(1),
  operatorZoneType: z.string().min(1),
  resolutionMethod: z.string().min(1),
  sourceAsOfDate: z.string().date().nullable(),
  wholesaleOperator: z.string().min(1),
});

export const CountyQueueResolutionDebugSchema = z.object({
  allocationShare: z.number().min(0).max(1),
  countyFips: CountyFipsSchema,
  projectId: z.string().min(1),
  queuePoiLabel: z.string().min(1).nullable(),
  resolverConfidence: z.string().min(1),
  resolverType: z.string().min(1),
  sourceLocationLabel: z.string().min(1).nullable(),
  sourceSystem: z.string().min(1),
  stateAbbrev: z.string().length(2).nullable(),
});

export const CountyQueuePoiReferenceDebugSchema = z.object({
  countyFips: CountyFipsSchema,
  operatorZoneLabel: z.string().min(1).nullable(),
  operatorZoneType: z.string().min(1).nullable(),
  queuePoiLabel: z.string().min(1),
  resolutionMethod: z.string().min(1),
  resolverConfidence: z.string().min(1),
  sourceAsOfDate: z.string().date().nullable(),
  sourceSystem: z.string().min(1),
  stateAbbrev: z.string().length(2).nullable(),
});

export const CountyCongestionSnapshotDebugSchema = z.object({
  avgRtCongestionComponent: z.number().finite().nullable(),
  negativePriceHourShare: z.number().min(0).max(1).nullable(),
  p95ShadowPrice: z.number().finite().nullable(),
  sourceAsOfDate: z.string().date().nullable(),
});

export const CountyScoresDebugCountySchema = z.object({
  congestionSnapshot: CountyCongestionSnapshotDebugSchema.nullable(),
  countyFips: CountyFipsSchema,
  operatorZones: z.array(CountyOperatorZoneDebugSchema),
  queuePoiReferences: z.array(CountyQueuePoiReferenceDebugSchema),
  queueResolutions: z.array(CountyQueueResolutionDebugSchema),
  score: CountyScoreSchema.nullable(),
});

export const CountyScoresDebugResponseSchema = z.object({
  publicationRunId: z.string().min(1).nullable(),
  dataVersion: z.string().min(1).nullable(),
  counties: z.array(CountyScoresDebugCountySchema),
  meta: ResponseMetaSchema,
});

export type CountyScoresCoverageField = z.infer<typeof CountyScoresCoverageFieldSchema>;
export type CountyScoresCoverageByOperator = z.infer<typeof CountyScoresCoverageByOperatorSchema>;
export type CountyScoresCoverageResponse = z.infer<typeof CountyScoresCoverageResponseSchema>;
export type CountyScoresResolutionSource = z.infer<typeof CountyScoresResolutionSourceSchema>;
export type CountyScoresResolutionResponse = z.infer<typeof CountyScoresResolutionResponseSchema>;
export type CountyScoresDebugRequest = z.infer<typeof CountyScoresDebugRequestSchema>;
export type CountyOperatorZoneDebug = z.infer<typeof CountyOperatorZoneDebugSchema>;
export type CountyQueueResolutionDebug = z.infer<typeof CountyQueueResolutionDebugSchema>;
export type CountyQueuePoiReferenceDebug = z.infer<typeof CountyQueuePoiReferenceDebugSchema>;
export type CountyCongestionSnapshotDebug = z.infer<typeof CountyCongestionSnapshotDebugSchema>;
export type CountyScoresDebugCounty = z.infer<typeof CountyScoresDebugCountySchema>;
export type CountyScoresDebugResponse = z.infer<typeof CountyScoresDebugResponseSchema>;
