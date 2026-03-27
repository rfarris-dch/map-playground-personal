import type {
  RunReproducibilityDiffRequest,
  RunReproducibilityDiffResponse,
  RunReproducibilityRequest,
  RunReproducibilityResponse,
} from "@map-migration/http-contracts/run-reproducibility-http";
import { loadRunEnvelopeWithSummary, loadRunReproducibilityDiff } from "./run-reproducibility.repo";

export async function queryRunReproducibility(
  request: RunReproducibilityRequest
): Promise<Omit<RunReproducibilityResponse, "meta"> | null> {
  const result = await loadRunEnvelopeWithSummary(request);
  if (result === null) {
    return null;
  }

  return {
    envelope: {
      ...result.envelope.envelope,
      artifactRefsJson: [...result.envelope.envelope.artifactRefsJson],
      codeRefsJson: [...result.envelope.envelope.codeRefsJson],
      downstreamObjectsJson: [...result.envelope.envelope.downstreamObjectsJson],
      ingestionSnapshotIdsJson: [...result.envelope.envelope.ingestionSnapshotIdsJson],
      outputTablesJson: [...result.envelope.envelope.outputTablesJson],
      sourceVersionIdsJson: [...result.envelope.envelope.sourceVersionIdsJson],
    },
    inputSnapshots: result.envelope.inputSnapshots.map((snapshot) => ({ ...snapshot })),
    sourceSnapshots: result.envelope.sourceSnapshots.map((snapshot) => ({ ...snapshot })),
    summary: result.summary,
  };
}

export async function queryRunReproducibilityDiff(
  request: RunReproducibilityDiffRequest
): Promise<Omit<RunReproducibilityDiffResponse, "meta"> | null> {
  const diff = await loadRunReproducibilityDiff(request);
  if (diff === null) {
    return null;
  }

  return {
    inputSnapshotDiffs: diff.inputSnapshotDiffs.map((entry) => ({
      ...entry,
      details: [...entry.details],
    })),
    left: diff.left,
    right: diff.right,
    sourceSnapshotDiffs: diff.sourceSnapshotDiffs.map((entry) => ({
      ...entry,
      details: [...entry.details],
    })),
    topLevelDiffs: [...diff.topLevelDiffs],
  };
}
