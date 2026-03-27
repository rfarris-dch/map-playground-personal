import {
  loadRunReproducibilityEnvelope,
  readRunReproducibilitySummary,
} from "@map-migration/ops/etl/run-reproducibility";
import { diffRunReproducibilityEnvelopes } from "@map-migration/ops/etl/run-reproducibility-diff";
import type {
  LoadRunEnvelopeResult,
  RunReproducibilityDiff,
  RunReproducibilityKind,
  RunReproducibilitySummaryRecord,
  RunReproducibilitySurfaceScope,
} from "@map-migration/ops/etl/run-reproducibility-types";

export interface LoadRunEnvelopeWithSummaryResult {
  readonly envelope: LoadRunEnvelopeResult;
  readonly summary: RunReproducibilitySummaryRecord;
}

export async function loadRunEnvelopeWithSummary(args: {
  readonly runId: string;
  readonly runKind: RunReproducibilityKind;
  readonly surfaceScope: RunReproducibilitySurfaceScope;
}): Promise<LoadRunEnvelopeWithSummaryResult | null> {
  const envelope = await loadRunReproducibilityEnvelope(
    args.surfaceScope,
    args.runKind,
    args.runId
  );
  if (envelope === null) {
    return null;
  }

  const summary = await readRunReproducibilitySummary(args.surfaceScope, args.runKind, args.runId);
  if (summary === null) {
    throw new Error(
      `missing run reproducibility summary for ${args.surfaceScope}/${args.runKind}/${args.runId}`
    );
  }

  return {
    envelope,
    summary,
  };
}

export async function loadRunReproducibilityDiff(args: {
  readonly leftRunId: string;
  readonly rightRunId: string;
  readonly runKind: RunReproducibilityKind;
  readonly surfaceScope: RunReproducibilitySurfaceScope;
}): Promise<RunReproducibilityDiff | null> {
  const left = await loadRunReproducibilityEnvelope(
    args.surfaceScope,
    args.runKind,
    args.leftRunId
  );
  if (left === null) {
    return null;
  }

  const right = await loadRunReproducibilityEnvelope(
    args.surfaceScope,
    args.runKind,
    args.rightRunId
  );
  if (right === null) {
    return null;
  }

  return diffRunReproducibilityEnvelopes(left, right);
}
