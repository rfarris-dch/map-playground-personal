import type {
  LoadRunEnvelopeResult,
  RunInputSnapshotDiff,
  RunReproducibilityDiff,
  RunReproducibilityFieldDiff,
  RunSourceSnapshotDiff,
} from "./run-reproducibility.types";
import { stableStringify } from "./run-reproducibility-hash";

function fieldDiff(
  field: string,
  leftValue: unknown,
  rightValue: unknown
): RunReproducibilityFieldDiff {
  return {
    field,
    leftValue,
    rightValue,
  };
}

function valuesEqual(leftValue: unknown, rightValue: unknown): boolean {
  return stableStringify(leftValue) === stableStringify(rightValue);
}

function buildTopLevelDiffs(
  left: LoadRunEnvelopeResult,
  right: LoadRunEnvelopeResult
): readonly RunReproducibilityFieldDiff[] {
  const diffs: RunReproducibilityFieldDiff[] = [];
  const fields: ReadonlyArray<readonly [string, unknown, unknown]> = [
    ["status", left.envelope.status, right.envelope.status],
    ["registryVersion", left.envelope.registryVersion, right.envelope.registryVersion],
    ["modelVersion", left.envelope.modelVersion, right.envelope.modelVersion],
    ["formulaVersion", left.envelope.formulaVersion, right.envelope.formulaVersion],
    ["methodologyId", left.envelope.methodologyId, right.envelope.methodologyId],
    ["dataVersion", left.envelope.dataVersion, right.envelope.dataVersion],
    ["effectiveDate", left.envelope.effectiveDate, right.envelope.effectiveDate],
    ["month", left.envelope.month, right.envelope.month],
    ["replayabilityTier", left.envelope.replayabilityTier, right.envelope.replayabilityTier],
    ["configHash", left.envelope.configHash, right.envelope.configHash],
    ["codeHash", left.envelope.codeHash, right.envelope.codeHash],
    ["inputStateHash", left.envelope.inputStateHash, right.envelope.inputStateHash],
    ["envelopeHash", left.envelope.envelopeHash, right.envelope.envelopeHash],
    ["outputHash", left.envelope.outputHash, right.envelope.outputHash],
  ];

  for (const [field, leftValue, rightValue] of fields) {
    if (!valuesEqual(leftValue, rightValue)) {
      diffs.push(fieldDiff(field, leftValue, rightValue));
    }
  }

  return diffs;
}

function buildSourceSnapshotDiffs(
  left: LoadRunEnvelopeResult,
  right: LoadRunEnvelopeResult
): readonly RunSourceSnapshotDiff[] {
  const leftBySourceId = new Map(
    left.sourceSnapshots.map((snapshot) => [snapshot.sourceId, snapshot])
  );
  const rightBySourceId = new Map(
    right.sourceSnapshots.map((snapshot) => [snapshot.sourceId, snapshot])
  );
  const sourceIds = [...new Set([...leftBySourceId.keys(), ...rightBySourceId.keys()])].sort(
    (a, b) => a.localeCompare(b)
  );
  const diffs: RunSourceSnapshotDiff[] = [];

  for (const sourceId of sourceIds) {
    const leftSnapshot = leftBySourceId.get(sourceId);
    const rightSnapshot = rightBySourceId.get(sourceId);
    if (leftSnapshot === undefined && rightSnapshot !== undefined) {
      diffs.push({
        changeType: "added",
        details: [fieldDiff("sourceSnapshot", null, rightSnapshot)],
        sourceId,
      });
      continue;
    }

    if (leftSnapshot !== undefined && rightSnapshot === undefined) {
      diffs.push({
        changeType: "removed",
        details: [fieldDiff("sourceSnapshot", leftSnapshot, null)],
        sourceId,
      });
      continue;
    }

    if (leftSnapshot === undefined || rightSnapshot === undefined) {
      continue;
    }

    const details: RunReproducibilityFieldDiff[] = [];
    const fields: ReadonlyArray<readonly [string, unknown, unknown]> = [
      ["sourceVersionId", leftSnapshot.sourceVersionId, rightSnapshot.sourceVersionId],
      [
        "providerVersionLabel",
        leftSnapshot.providerVersionLabel,
        rightSnapshot.providerVersionLabel,
      ],
      ["sourceAsOfDate", leftSnapshot.sourceAsOfDate, rightSnapshot.sourceAsOfDate],
      ["freshnessAsOf", leftSnapshot.freshnessAsOf, rightSnapshot.freshnessAsOf],
      ["stalenessState", leftSnapshot.stalenessState, rightSnapshot.stalenessState],
      ["ingestionHealth", leftSnapshot.ingestionHealth, rightSnapshot.ingestionHealth],
      ["accessStatus", leftSnapshot.accessStatus, rightSnapshot.accessStatus],
      ["runtimeAlertState", leftSnapshot.runtimeAlertState, rightSnapshot.runtimeAlertState],
      [
        "lastSuccessfulIngestAt",
        leftSnapshot.lastSuccessfulIngestAt,
        rightSnapshot.lastSuccessfulIngestAt,
      ],
      [
        "latestProviderUpdateSeenAt",
        leftSnapshot.latestProviderUpdateSeenAt,
        rightSnapshot.latestProviderUpdateSeenAt,
      ],
      ["recordCount", leftSnapshot.recordCount, rightSnapshot.recordCount],
      [
        "completenessObserved",
        leftSnapshot.completenessObserved,
        rightSnapshot.completenessObserved,
      ],
      [
        "geographicCoverageObserved",
        leftSnapshot.geographicCoverageObserved,
        rightSnapshot.geographicCoverageObserved,
      ],
      [
        "licenseExpirationDate",
        leftSnapshot.licenseExpirationDate,
        rightSnapshot.licenseExpirationDate,
      ],
      ["runtimeStateHash", leftSnapshot.runtimeStateHash, rightSnapshot.runtimeStateHash],
    ];

    for (const [field, leftValue, rightValue] of fields) {
      if (!valuesEqual(leftValue, rightValue)) {
        details.push(fieldDiff(field, leftValue, rightValue));
      }
    }

    if (details.length > 0) {
      diffs.push({
        changeType: "changed",
        details,
        sourceId,
      });
    }
  }

  return diffs;
}

function buildInputSnapshotKey(snapshotKind: string, snapshotId: string): string {
  return `${snapshotKind}:${snapshotId}`;
}

function buildChangedInputSnapshotDiff(
  leftSnapshot: LoadRunEnvelopeResult["inputSnapshots"][number],
  rightSnapshot: LoadRunEnvelopeResult["inputSnapshots"][number],
  snapshotId: string,
  snapshotKind: string
): RunInputSnapshotDiff | null {
  const details: RunReproducibilityFieldDiff[] = [];
  const fields: ReadonlyArray<readonly [string, unknown, unknown]> = [
    ["sourceId", leftSnapshot.sourceId, rightSnapshot.sourceId],
    ["sourceVersionId", leftSnapshot.sourceVersionId, rightSnapshot.sourceVersionId],
    ["manifestPath", leftSnapshot.manifestPath, rightSnapshot.manifestPath],
    ["manifestHash", leftSnapshot.manifestHash, rightSnapshot.manifestHash],
    ["storageUri", leftSnapshot.storageUri, rightSnapshot.storageUri],
    ["effectiveDate", leftSnapshot.effectiveDate, rightSnapshot.effectiveDate],
    ["dataVersion", leftSnapshot.dataVersion, rightSnapshot.dataVersion],
    ["replayMode", leftSnapshot.replayMode, rightSnapshot.replayMode],
    ["detailsJson", leftSnapshot.detailsJson, rightSnapshot.detailsJson],
  ];

  for (const [field, leftValue, rightValue] of fields) {
    if (!valuesEqual(leftValue, rightValue)) {
      details.push(fieldDiff(field, leftValue, rightValue));
    }
  }

  if (details.length === 0) {
    return null;
  }

  return {
    changeType: "changed",
    details,
    snapshotId,
    snapshotKind,
  };
}

function buildInputSnapshotDiffs(
  left: LoadRunEnvelopeResult,
  right: LoadRunEnvelopeResult
): readonly RunInputSnapshotDiff[] {
  const leftByKey = new Map(
    left.inputSnapshots.map((snapshot) => [
      buildInputSnapshotKey(snapshot.snapshotKind, snapshot.snapshotId),
      snapshot,
    ])
  );
  const rightByKey = new Map(
    right.inputSnapshots.map((snapshot) => [
      buildInputSnapshotKey(snapshot.snapshotKind, snapshot.snapshotId),
      snapshot,
    ])
  );
  const snapshotKeys = [...new Set([...leftByKey.keys(), ...rightByKey.keys()])].sort((a, b) =>
    a.localeCompare(b)
  );
  const diffs: RunInputSnapshotDiff[] = [];

  for (const snapshotKey of snapshotKeys) {
    const leftSnapshot = leftByKey.get(snapshotKey);
    const rightSnapshot = rightByKey.get(snapshotKey);
    const snapshotKind = leftSnapshot?.snapshotKind ?? rightSnapshot?.snapshotKind;
    const snapshotId = leftSnapshot?.snapshotId ?? rightSnapshot?.snapshotId;
    if (snapshotKind === undefined || snapshotId === undefined) {
      continue;
    }
    if (leftSnapshot === undefined && rightSnapshot !== undefined) {
      diffs.push({
        changeType: "added",
        details: [fieldDiff("inputSnapshot", null, rightSnapshot)],
        snapshotId,
        snapshotKind,
      });
      continue;
    }

    if (leftSnapshot !== undefined && rightSnapshot === undefined) {
      diffs.push({
        changeType: "removed",
        details: [fieldDiff("inputSnapshot", leftSnapshot, null)],
        snapshotId,
        snapshotKind,
      });
      continue;
    }

    if (leftSnapshot === undefined || rightSnapshot === undefined) {
      continue;
    }

    const changedDiff = buildChangedInputSnapshotDiff(
      leftSnapshot,
      rightSnapshot,
      snapshotId,
      snapshotKind
    );
    if (changedDiff !== null) {
      diffs.push(changedDiff);
    }
  }

  return diffs;
}

export function diffRunReproducibilityEnvelopes(
  left: LoadRunEnvelopeResult,
  right: LoadRunEnvelopeResult
): RunReproducibilityDiff {
  return {
    inputSnapshotDiffs: buildInputSnapshotDiffs(left, right),
    left: {
      configHash: left.envelope.configHash,
      dataVersion: left.envelope.dataVersion,
      effectiveDate: left.envelope.effectiveDate,
      envelopeHash: left.envelope.envelopeHash,
      envelopeVersion: left.envelope.envelopeVersion,
      formulaVersion: left.envelope.formulaVersion,
      ingestionSnapshotCount: left.inputSnapshots.length,
      inputStateHash: left.envelope.inputStateHash,
      methodologyId: left.envelope.methodologyId,
      modelVersion: left.envelope.modelVersion,
      outputHash: left.envelope.outputHash,
      registryVersion: left.envelope.registryVersion,
      replayabilityTier: left.envelope.replayabilityTier,
      replayedFromRunId: left.envelope.replayedFromRunId,
      runId: left.envelope.runId,
      runKind: left.envelope.runKind,
      runRecordedAt: left.envelope.runRecordedAt,
      sourceVersionCount: left.sourceSnapshots.length,
      status: left.envelope.status,
      surfaceScope: left.envelope.surfaceScope,
    },
    right: {
      configHash: right.envelope.configHash,
      dataVersion: right.envelope.dataVersion,
      effectiveDate: right.envelope.effectiveDate,
      envelopeHash: right.envelope.envelopeHash,
      envelopeVersion: right.envelope.envelopeVersion,
      formulaVersion: right.envelope.formulaVersion,
      ingestionSnapshotCount: right.inputSnapshots.length,
      inputStateHash: right.envelope.inputStateHash,
      methodologyId: right.envelope.methodologyId,
      modelVersion: right.envelope.modelVersion,
      outputHash: right.envelope.outputHash,
      registryVersion: right.envelope.registryVersion,
      replayabilityTier: right.envelope.replayabilityTier,
      replayedFromRunId: right.envelope.replayedFromRunId,
      runId: right.envelope.runId,
      runKind: right.envelope.runKind,
      runRecordedAt: right.envelope.runRecordedAt,
      sourceVersionCount: right.sourceSnapshots.length,
      status: right.envelope.status,
      surfaceScope: right.envelope.surfaceScope,
    },
    sourceSnapshotDiffs: buildSourceSnapshotDiffs(left, right),
    topLevelDiffs: buildTopLevelDiffs(left, right),
  };
}
