import { z } from "zod";

export const FacilitiesPerformanceMeasurementSchema = z.object({
  average: z.number(),
  count: z.number().int().nonnegative(),
  last: z.number(),
  max: z.number(),
  min: z.number(),
  total: z.number(),
});

export const FacilitiesPerformancePerspectiveSchema = z.object({
  abortedCount: z.number().int().nonnegative(),
  boundDatasetVersion: z.string().nullable(),
  completedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  lastInteractionType: z.string().nullable(),
  lastCanonicalBboxKey: z.string().nullable(),
  lastEffectiveLimit: z.number().int().nullable(),
  lastRowCount: z.number().int().nullable(),
  lastTruncated: z.boolean().nullable(),
  lastViewMode: z.string().nullable(),
  lastViewportKey: z.string().nullable(),
  lastZoomBucket: z.number().nullable(),
  mappingTimeMs: FacilitiesPerformanceMeasurementSchema,
  requestedDatasetVersion: z.string().nullable(),
  requestCount: z.number().int().nonnegative(),
  responseBytes: FacilitiesPerformanceMeasurementSchema,
  routeLatencyMs: FacilitiesPerformanceMeasurementSchema,
  sqlTimeMs: FacilitiesPerformanceMeasurementSchema,
});

export const FacilitiesPerformanceSnapshotSchema = z.object({
  bbox: z.object({
    perspectives: z.record(FacilitiesPerformancePerspectiveSchema),
  }),
  cache: z.object({
    configured: z.boolean(),
    hitCount: z.number().int().nonnegative(),
    missCount: z.number().int().nonnegative(),
    redisUnavailableCount: z.number().int().nonnegative(),
    singleflightJoinedCount: z.number().int().nonnegative(),
    staleCount: z.number().int().nonnegative(),
    valueBytes: FacilitiesPerformanceMeasurementSchema,
    writeSkippedPayloadTooLargeCount: z.number().int().nonnegative(),
  }),
  db: z.object({
    clientAbortCount: z.number().int().nonnegative(),
    queueWaitMs: FacilitiesPerformanceMeasurementSchema,
    statementTimeoutCount: z.number().int().nonnegative(),
  }),
  generatedAt: z.string().datetime(),
  lastResetAt: z.string().datetime(),
  status: z.literal("ok"),
});

export type FacilitiesPerformanceSnapshot = z.infer<typeof FacilitiesPerformanceSnapshotSchema>;
