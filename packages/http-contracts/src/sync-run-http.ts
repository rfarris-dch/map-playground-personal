/**
 * Generic sync/pipeline run status schemas.
 *
 * Extracted from parcels-http so that pipeline-http can compose these
 * without reversing the dependency direction. Both parcels and pipeline
 * status responses extend SyncRunStatusSchema.
 */
import { z } from "zod";

export const SyncPhaseSchema = z.enum([
  "idle",
  "extracting",
  "loading",
  "building",
  "publishing",
  "completed",
  "failed",
]);

export const SyncRunReasonSchema = z.enum(["startup", "interval", "manual", "unknown"]);

export const SyncStateProgressSchema = z.object({
  state: z.string().min(1),
  expectedCount: z.number().int().nonnegative().nullable(),
  writtenCount: z.number().int().nonnegative(),
  pagesFetched: z.number().int().nonnegative(),
  lastSourceId: z.number().int().nullable(),
  updatedAt: z.string().datetime().nullable(),
  isCompleted: z.boolean().optional(),
});

export const SyncDbLoadProgressSchema = z.object({
  stepKey: z.string().min(1),
  percent: z.number().min(0).max(100).nullable().optional(),
  loadedFiles: z.number().int().nonnegative().nullable().optional(),
  totalFiles: z.number().int().positive().nullable().optional(),
  currentFile: z.string().nullable().optional(),
  completedStates: z.number().int().nonnegative().nullable().optional(),
  totalStates: z.number().int().nonnegative().nullable().optional(),
  activeWorkers: z.array(z.string().min(1)).optional(),
});

export const SyncTileBuildProgressSchema = z.object({
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

export const SyncProgressSchema = z.object({
  schemaVersion: z.literal(1),
  phase: SyncPhaseSchema,
  dbLoad: SyncDbLoadProgressSchema.optional(),
  tileBuild: SyncTileBuildProgressSchema.optional(),
});

export const SyncRunStatusSchema = z.object({
  runId: z.string().nullable(),
  reason: SyncRunReasonSchema.nullable(),
  phase: SyncPhaseSchema,
  isRunning: z.boolean(),
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  exitCode: z.number().int().nullable(),
  summary: z.string().nullable(),
  progress: SyncProgressSchema.nullable().optional(),
  states: z.array(SyncStateProgressSchema),
  statesCompleted: z.number().int().nonnegative(),
  statesTotal: z.number().int().nonnegative(),
  writtenCount: z.number().int().nonnegative(),
  expectedCount: z.number().int().nonnegative().nullable(),
  logTail: z.array(z.string()),
});

export const SyncStatusResponseSchema = z.object({
  status: z.literal("ok"),
  generatedAt: z.string().datetime(),
  enabled: z.boolean(),
  mode: z.enum(["external", "in-process"]),
  intervalMs: z.number().int().positive(),
  requireStartupSuccess: z.boolean(),
  snapshotRoot: z.string().min(1),
  latestRunId: z.string().nullable(),
  latestRunCompletedAt: z.string().datetime().nullable(),
  run: SyncRunStatusSchema,
});

export type SyncPhase = z.infer<typeof SyncPhaseSchema>;
export type SyncRunReason = z.infer<typeof SyncRunReasonSchema>;
export type SyncStateProgress = z.infer<typeof SyncStateProgressSchema>;
export type SyncDbLoadProgress = z.infer<typeof SyncDbLoadProgressSchema>;
export type SyncTileBuildProgress = z.infer<typeof SyncTileBuildProgressSchema>;
export type SyncProgress = z.infer<typeof SyncProgressSchema>;
export type SyncRunStatus = z.infer<typeof SyncRunStatusSchema>;
export type SyncStatusResponse = z.infer<typeof SyncStatusResponseSchema>;
