import { z } from "zod";

export const AppPerformanceCounterSnapshotSchema = z.object({
  count: z.number().nonnegative(),
  key: z.string().min(1),
  lastRecordedAt: z.string().datetime(),
  lastValue: z.number(),
  name: z.string().min(1),
  tags: z.record(z.string()),
});

export const AppPerformanceMeasurementSnapshotSchema = z.object({
  average: z.number(),
  count: z.number().nonnegative(),
  key: z.string().min(1),
  lastRecordedAt: z.string().datetime(),
  lastValue: z.number(),
  max: z.number(),
  min: z.number(),
  name: z.string().min(1),
  tags: z.record(z.string()),
  total: z.number(),
});

export const AppPerformanceSnapshotSchema = z.object({
  counters: z.record(AppPerformanceCounterSnapshotSchema),
  generatedAt: z.string().datetime(),
  lastResetAt: z.string().datetime(),
  measurements: z.record(AppPerformanceMeasurementSnapshotSchema),
  status: z.literal("ok"),
});

export const AppPerformanceExportRequestSchema = z.object({
  pathname: z.string().min(1),
  sampledAt: z.string().datetime(),
  sessionId: z.string().min(1),
  snapshot: AppPerformanceSnapshotSchema,
  userAgent: z.string().min(1).optional(),
  visibilityState: z.string().min(1).optional(),
});

export const AppPerformanceIngestStateSchema = z.object({
  exportCount: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
  lastReceivedAt: z.string().datetime().nullable(),
  latest: AppPerformanceExportRequestSchema.nullable(),
  status: z.literal("ok"),
});

export type AppPerformanceCounterSnapshot = z.infer<typeof AppPerformanceCounterSnapshotSchema>;
export type AppPerformanceMeasurementSnapshot = z.infer<
  typeof AppPerformanceMeasurementSnapshotSchema
>;
export type AppPerformanceSnapshot = z.infer<typeof AppPerformanceSnapshotSchema>;
export type AppPerformanceExportRequest = z.infer<typeof AppPerformanceExportRequestSchema>;
export type AppPerformanceIngestState = z.infer<typeof AppPerformanceIngestStateSchema>;
