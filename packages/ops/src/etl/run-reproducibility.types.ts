import type {
  BunSqlClient,
  SourceRegistryAccessStatus,
  SourceRegistryIngestionHealth,
  SourceRegistryRuntimeAlertState,
  SourceRegistryStalenessState,
} from "./source-registry.types";

export type RunReproducibilitySurfaceScope = "county" | "corridor" | "parcel";
export type RunReproducibilityKind = "analysis" | "publication" | "replay";
export type RunReproducibilityStatus = "completed" | "failed" | "replayed";
export type RunReplayabilityTier = "best_effort" | "not_replayable" | "strict";
export type RunInputReplayMode = "best_effort_pointer" | "self_snapshot" | "strict_input";
export type RunEnvelopeVersion = "run-envelope-v1";

export interface RunCodeReference {
  readonly fileHash: string;
  readonly filePath: string;
  readonly relativePath: string;
}

export interface RunArtifactReference {
  readonly artifactKind: string;
  readonly fileHash: string | null;
  readonly filePath: string;
  readonly relativePath: string;
}

export interface RunInputSnapshotRecord {
  readonly dataVersion: string | null;
  readonly detailsJson: Record<string, unknown>;
  readonly effectiveDate: string | null;
  readonly manifestHash: string | null;
  readonly manifestPath: string | null;
  readonly replayMode: RunInputReplayMode;
  readonly snapshotId: string;
  readonly snapshotKind: string;
  readonly sourceId: string | null;
  readonly sourceVersionId: string | null;
  readonly storageUri: string | null;
}

export interface RunSourceSnapshotRecord {
  readonly accessStatus: SourceRegistryAccessStatus | null;
  readonly completenessObserved: number | null;
  readonly detailsJson: Record<string, unknown>;
  readonly freshnessAsOf: string | null;
  readonly geographicCoverageObserved: number | null;
  readonly ingestionHealth: SourceRegistryIngestionHealth | null;
  readonly lastSuccessfulIngestAt: string | null;
  readonly latestProviderUpdateSeenAt: string | null;
  readonly licenseExpirationDate: string | null;
  readonly providerVersionLabel: string | null;
  readonly recordCount: number | null;
  readonly runtimeAlertState: SourceRegistryRuntimeAlertState | null;
  readonly runtimeStateHash: string;
  readonly sourceAsOfDate: string | null;
  readonly sourceId: string;
  readonly sourceVersionId: string | null;
  readonly stalenessState: SourceRegistryStalenessState | null;
}

export interface RunEnvelopeRecord {
  readonly artifactRefsJson: readonly RunArtifactReference[];
  readonly codeHash: string;
  readonly codeRefsJson: readonly RunCodeReference[];
  readonly configHash: string;
  readonly configJson: Record<string, unknown>;
  readonly createdAt: string | null;
  readonly dataVersion: string | null;
  readonly downstreamObjectsJson: readonly string[];
  readonly effectiveDate: string | null;
  readonly envelopeHash: string;
  readonly envelopeVersion: RunEnvelopeVersion;
  readonly formulaVersion: string | null;
  readonly ingestionSnapshotIdsJson: readonly string[];
  readonly inputStateHash: string;
  readonly methodologyId: string | null;
  readonly modelVersion: string | null;
  readonly month: string | null;
  readonly notesJson: Record<string, unknown>;
  readonly outputCountsJson: Record<string, unknown>;
  readonly outputHash: string | null;
  readonly outputTablesJson: readonly string[];
  readonly registryVersion: string | null;
  readonly replayabilityTier: RunReplayabilityTier;
  readonly replayedFromRunId: string | null;
  readonly runId: string;
  readonly runKind: RunReproducibilityKind;
  readonly runRecordedAt: string;
  readonly sourceVersionIdsJson: readonly string[];
  readonly status: RunReproducibilityStatus;
  readonly surfaceScope: RunReproducibilitySurfaceScope;
  readonly updatedAt: string | null;
}

export interface PersistRunEnvelopeArgs {
  readonly envelope: RunEnvelopeRecord;
  readonly inputSnapshots: readonly RunInputSnapshotRecord[];
  readonly sourceSnapshots: readonly RunSourceSnapshotRecord[];
  readonly sqlClient?: BunSqlClient;
}

export interface RunReproducibilitySummaryRecord {
  readonly configHash: string;
  readonly dataVersion: string | null;
  readonly effectiveDate: string | null;
  readonly envelopeHash: string;
  readonly envelopeVersion: string;
  readonly formulaVersion: string | null;
  readonly ingestionSnapshotCount: number;
  readonly inputStateHash: string;
  readonly methodologyId: string | null;
  readonly modelVersion: string | null;
  readonly outputHash: string | null;
  readonly registryVersion: string | null;
  readonly replayabilityTier: RunReplayabilityTier;
  readonly replayedFromRunId: string | null;
  readonly runId: string;
  readonly runKind: RunReproducibilityKind;
  readonly runRecordedAt: string;
  readonly sourceVersionCount: number;
  readonly status: RunReproducibilityStatus;
  readonly surfaceScope: RunReproducibilitySurfaceScope;
}

export interface RunReproducibilityFieldDiff {
  readonly field: string;
  readonly leftValue: unknown;
  readonly rightValue: unknown;
}

export interface RunSourceSnapshotDiff {
  readonly changeType: "added" | "changed" | "removed";
  readonly details: readonly RunReproducibilityFieldDiff[];
  readonly sourceId: string;
}

export interface RunInputSnapshotDiff {
  readonly changeType: "added" | "changed" | "removed";
  readonly details: readonly RunReproducibilityFieldDiff[];
  readonly snapshotId: string;
  readonly snapshotKind: string;
}

export interface RunReproducibilityDiff {
  readonly inputSnapshotDiffs: readonly RunInputSnapshotDiff[];
  readonly left: RunReproducibilitySummaryRecord;
  readonly right: RunReproducibilitySummaryRecord;
  readonly sourceSnapshotDiffs: readonly RunSourceSnapshotDiff[];
  readonly topLevelDiffs: readonly RunReproducibilityFieldDiff[];
}

export interface LoadRunEnvelopeResult {
  readonly envelope: RunEnvelopeRecord;
  readonly inputSnapshots: readonly RunInputSnapshotRecord[];
  readonly sourceSnapshots: readonly RunSourceSnapshotRecord[];
}
