import { z } from "zod";
import { ResponseMetaSchema } from "./api-response-meta.js";

export const RunSurfaceScopeSchema = z.enum(["county", "corridor", "parcel"]);
export const RunKindSchema = z.enum(["publication", "analysis", "replay"]);
export const RunReplayabilityTierSchema = z.enum(["strict", "best_effort", "not_replayable"]);
export const RunInputReplayModeSchema = z.enum([
  "strict_input",
  "self_snapshot",
  "best_effort_pointer",
]);
export const RunReproducibilityStatusSchema = z.enum(["completed", "failed", "replayed"]);

export const RunCodeReferenceSchema = z.object({
  fileHash: z.string().min(1),
  filePath: z.string().min(1),
  relativePath: z.string().min(1),
});

export const RunArtifactReferenceSchema = z.object({
  artifactKind: z.string().min(1),
  fileHash: z.string().min(1).nullable(),
  filePath: z.string().min(1),
  relativePath: z.string().min(1),
});

export const RunFieldDiffSchema = z.object({
  field: z.string().min(1),
  leftValue: z.unknown(),
  rightValue: z.unknown(),
});

export const RunSourceSnapshotSchema = z.object({
  accessStatus: z
    .enum(["accessible", "cached_only", "lost_access", "pending_renewal", "planned"])
    .nullable(),
  completenessObserved: z.number().finite().nullable(),
  detailsJson: z.record(z.string(), z.unknown()),
  freshnessAsOf: z.string().datetime().nullable(),
  geographicCoverageObserved: z.number().finite().nullable(),
  ingestionHealth: z.enum(["healthy", "degraded", "failed", "not_run"]).nullable(),
  lastSuccessfulIngestAt: z.string().datetime().nullable(),
  latestProviderUpdateSeenAt: z.string().datetime().nullable(),
  licenseExpirationDate: z.string().min(1).nullable(),
  providerVersionLabel: z.string().min(1).nullable(),
  recordCount: z.number().int().nonnegative().nullable(),
  runtimeAlertState: z.enum(["none", "warning", "blocking", "investigating"]).nullable(),
  runtimeStateHash: z.string().min(1),
  sourceAsOfDate: z.string().min(1).nullable(),
  sourceId: z.string().min(1),
  sourceVersionId: z.string().min(1).nullable(),
  stalenessState: z.enum(["fresh", "aging", "stale", "critical", "unknown"]).nullable(),
});

export const RunInputSnapshotSchema = z.object({
  dataVersion: z.string().min(1).nullable(),
  detailsJson: z.record(z.string(), z.unknown()),
  effectiveDate: z.string().min(1).nullable(),
  manifestHash: z.string().min(1).nullable(),
  manifestPath: z.string().min(1).nullable(),
  replayMode: RunInputReplayModeSchema,
  snapshotId: z.string().min(1),
  snapshotKind: z.string().min(1),
  sourceId: z.string().min(1).nullable(),
  sourceVersionId: z.string().min(1).nullable(),
  storageUri: z.string().min(1).nullable(),
});

export const RunReproducibilitySummarySchema = z.object({
  configHash: z.string().min(1),
  dataVersion: z.string().min(1).nullable(),
  effectiveDate: z.string().min(1).nullable(),
  envelopeHash: z.string().min(1),
  envelopeVersion: z.string().min(1),
  formulaVersion: z.string().min(1).nullable(),
  ingestionSnapshotCount: z.number().int().nonnegative(),
  inputStateHash: z.string().min(1),
  methodologyId: z.string().min(1).nullable(),
  modelVersion: z.string().min(1).nullable(),
  outputHash: z.string().min(1).nullable(),
  registryVersion: z.string().min(1).nullable(),
  replayabilityTier: RunReplayabilityTierSchema,
  replayedFromRunId: z.string().min(1).nullable(),
  runId: z.string().min(1),
  runKind: RunKindSchema,
  runRecordedAt: z.string().datetime(),
  sourceVersionCount: z.number().int().nonnegative(),
  status: RunReproducibilityStatusSchema,
  surfaceScope: RunSurfaceScopeSchema,
});

export const RunReproducibilityEnvelopeSchema = z.object({
  artifactRefsJson: z.array(RunArtifactReferenceSchema),
  codeHash: z.string().min(1),
  codeRefsJson: z.array(RunCodeReferenceSchema),
  configHash: z.string().min(1),
  configJson: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime().nullable(),
  dataVersion: z.string().min(1).nullable(),
  downstreamObjectsJson: z.array(z.string().min(1)),
  effectiveDate: z.string().min(1).nullable(),
  envelopeHash: z.string().min(1),
  envelopeVersion: z.string().min(1),
  formulaVersion: z.string().min(1).nullable(),
  ingestionSnapshotIdsJson: z.array(z.string().min(1)),
  inputStateHash: z.string().min(1),
  methodologyId: z.string().min(1).nullable(),
  modelVersion: z.string().min(1).nullable(),
  month: z.string().min(1).nullable(),
  notesJson: z.record(z.string(), z.unknown()),
  outputCountsJson: z.record(z.string(), z.unknown()),
  outputHash: z.string().min(1).nullable(),
  outputTablesJson: z.array(z.string().min(1)),
  registryVersion: z.string().min(1).nullable(),
  replayabilityTier: RunReplayabilityTierSchema,
  replayedFromRunId: z.string().min(1).nullable(),
  runId: z.string().min(1),
  runKind: RunKindSchema,
  runRecordedAt: z.string().datetime(),
  sourceVersionIdsJson: z.array(z.string().min(1)),
  status: RunReproducibilityStatusSchema,
  surfaceScope: RunSurfaceScopeSchema,
  updatedAt: z.string().datetime().nullable(),
});

export const RunReproducibilityRequestSchema = z.object({
  runId: z.string().min(1),
  runKind: RunKindSchema.default("publication"),
  surfaceScope: RunSurfaceScopeSchema.default("county"),
});

export const RunReproducibilityResponseSchema = z.object({
  envelope: RunReproducibilityEnvelopeSchema,
  inputSnapshots: z.array(RunInputSnapshotSchema),
  meta: ResponseMetaSchema,
  sourceSnapshots: z.array(RunSourceSnapshotSchema),
  summary: RunReproducibilitySummarySchema,
});

export const RunSourceSnapshotDiffSchema = z.object({
  changeType: z.enum(["added", "changed", "removed"]),
  details: z.array(RunFieldDiffSchema),
  sourceId: z.string().min(1),
});

export const RunInputSnapshotDiffSchema = z.object({
  changeType: z.enum(["added", "changed", "removed"]),
  details: z.array(RunFieldDiffSchema),
  snapshotId: z.string().min(1),
  snapshotKind: z.string().min(1),
});

export const RunReproducibilityDiffRequestSchema = z.object({
  leftRunId: z.string().min(1),
  rightRunId: z.string().min(1),
  runKind: RunKindSchema.default("publication"),
  surfaceScope: RunSurfaceScopeSchema.default("county"),
});

export const RunReproducibilityDiffResponseSchema = z.object({
  inputSnapshotDiffs: z.array(RunInputSnapshotDiffSchema),
  left: RunReproducibilitySummarySchema,
  meta: ResponseMetaSchema,
  right: RunReproducibilitySummarySchema,
  sourceSnapshotDiffs: z.array(RunSourceSnapshotDiffSchema),
  topLevelDiffs: z.array(RunFieldDiffSchema),
});

export type RunReproducibilityRequest = z.infer<typeof RunReproducibilityRequestSchema>;
export type RunReproducibilityResponse = z.infer<typeof RunReproducibilityResponseSchema>;
export type RunReproducibilityDiffRequest = z.infer<typeof RunReproducibilityDiffRequestSchema>;
export type RunReproducibilityDiffResponse = z.infer<typeof RunReproducibilityDiffResponseSchema>;
export type RunReproducibilitySummary = z.infer<typeof RunReproducibilitySummarySchema>;
