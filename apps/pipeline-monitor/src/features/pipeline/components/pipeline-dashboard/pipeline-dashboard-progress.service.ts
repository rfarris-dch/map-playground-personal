import { formatPercent } from "../../pipeline.service";
import type {
  PipelineDashboardRun,
  PipelineDashboardRunProgress,
  PipelineDashboardState,
} from "./pipeline-dashboard.types";

interface RunProgressAccumulator {
  readonly expectedCount: number;
  readonly hasExpectedGap: boolean;
  readonly statesCompleted: number;
  readonly statesTotal: number;
  readonly writtenCount: number;
}

export function isStateCompleted(stateRow: unknown): boolean {
  if (typeof stateRow !== "object" || stateRow === null) {
    return false;
  }

  return Reflect.get(stateRow, "isCompleted") === true;
}

export function normalizeExpectedForDisplay(
  expectedCount: number | null,
  writtenCount: number,
  isCompleted: boolean
): number | null {
  if (typeof expectedCount !== "number") {
    return null;
  }

  if (isCompleted && expectedCount > writtenCount) {
    return writtenCount;
  }

  return expectedCount;
}

export function computeStateCompletionPercent(args: {
  readonly expectedForDisplay: number | null;
  readonly isCompleted: boolean;
  readonly isRunning: boolean;
  readonly pollingIntervalMs: number;
  readonly updatedAgeMs: number | null;
  readonly writtenCount: number;
}): number | null {
  if (args.expectedForDisplay === null) {
    return null;
  }

  if (args.expectedForDisplay === 0) {
    return 100;
  }

  const bounded = formatPercent(args.writtenCount, args.expectedForDisplay);
  const recentUpdateWindowMs = Math.max(args.pollingIntervalMs * 5, 30_000);
  if (
    !args.isCompleted &&
    bounded === 100 &&
    args.isRunning &&
    args.expectedForDisplay > 0 &&
    args.writtenCount > 0 &&
    args.updatedAgeMs !== null &&
    args.updatedAgeMs <= recentUpdateWindowMs
  ) {
    return 99;
  }

  return bounded;
}

function toRunProgressAccumulator(
  accumulator: RunProgressAccumulator,
  stateRow: PipelineDashboardState
): RunProgressAccumulator {
  const expectedForDisplay = normalizeExpectedForDisplay(
    stateRow.expectedCount,
    stateRow.writtenCount,
    isStateCompleted(stateRow)
  );

  const hasExpectedGap = accumulator.hasExpectedGap || expectedForDisplay === null;
  const expectedCount =
    expectedForDisplay === null
      ? accumulator.expectedCount
      : accumulator.expectedCount + expectedForDisplay;
  const stateComplete =
    isStateCompleted(stateRow) ||
    (expectedForDisplay !== null && stateRow.writtenCount >= expectedForDisplay)
      ? 1
      : 0;

  return {
    writtenCount: accumulator.writtenCount + stateRow.writtenCount,
    expectedCount,
    statesCompleted: accumulator.statesCompleted + stateComplete,
    statesTotal: accumulator.statesTotal + 1,
    hasExpectedGap,
  };
}

export function deriveRunProgress(
  run: PipelineDashboardRun | null
): PipelineDashboardRunProgress | null {
  if (run === null) {
    return null;
  }

  const aggregated = run.states.reduce<RunProgressAccumulator>(toRunProgressAccumulator, {
    writtenCount: 0,
    expectedCount: 0,
    statesCompleted: 0,
    statesTotal: 0,
    hasExpectedGap: false,
  });

  return {
    writtenCount: aggregated.writtenCount,
    expectedCount: aggregated.hasExpectedGap ? null : aggregated.expectedCount,
    statesCompleted: aggregated.statesCompleted,
    statesTotal: aggregated.statesTotal,
  };
}
