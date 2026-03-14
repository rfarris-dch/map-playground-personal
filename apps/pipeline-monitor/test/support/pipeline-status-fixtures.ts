import {
  type ParcelSyncPhase,
  type ParcelSyncStateProgress,
  type PipelineStatusResponse,
  getPipelineDatasetDescriptor,
  PIPELINE_PLATFORM,
} from "@map-migration/http-contracts";
import type {
  PipelineStatusFetchResult,
  PipelineStatusPayload,
} from "../../src/features/pipeline/pipeline.types";

interface PipelineResponseOptions {
  readonly dataset?: PipelineStatusResponse["dataset"]["dataset"];
  readonly generatedAt?: string;
  readonly isRunning?: boolean;
  readonly phase?: ParcelSyncPhase;
  readonly progress?: PipelineStatusResponse["run"]["progress"];
  readonly requestId?: string;
  readonly runId?: string | null;
  readonly states?: readonly ParcelSyncStateProgress[];
  readonly summary?: string | null;
}

interface PipelineStateOptions {
  readonly expectedCount?: number | null;
  readonly isCompleted?: boolean;
  readonly pagesFetched?: number;
  readonly state?: string;
  readonly updatedAt?: string | null;
  readonly writtenCount?: number;
}

export function createPipelineState(options: PipelineStateOptions = {}): ParcelSyncStateProgress {
  return {
    expectedCount: options.expectedCount ?? 100,
    isCompleted: options.isCompleted ?? false,
    lastSourceId: 1,
    pagesFetched: options.pagesFetched ?? 1,
    state: options.state ?? "extract",
    updatedAt: options.updatedAt ?? "2026-03-08T12:00:00.000Z",
    writtenCount: options.writtenCount ?? 10,
  };
}

export function createPipelineStatusResponse(
  options: PipelineResponseOptions = {}
): PipelineStatusResponse {
  const states = options.states ? [...options.states] : [createPipelineState()];
  const dataset = options.dataset ?? "parcels";

  let writtenCount = 0;
  let expectedCount = 0;
  let hasExpectedCount = true;
  let statesCompleted = 0;

  for (const state of states) {
    writtenCount += state.writtenCount;
    if (state.expectedCount === null) {
      hasExpectedCount = false;
    } else {
      expectedCount += state.expectedCount;
    }

    if (state.isCompleted === true) {
      statesCompleted += 1;
    }
  }

  return {
    dataset: getPipelineDatasetDescriptor(dataset),
    enabled: true,
    generatedAt: options.generatedAt ?? "2026-03-08T12:00:00.000Z",
    intervalMs: 3000,
    latestRunCompletedAt: null,
    latestRunId: options.runId ?? "run-1",
    mode: "external",
    platform: PIPELINE_PLATFORM,
    requireStartupSuccess: true,
    run: {
      durationMs: options.isRunning === false ? 3000 : null,
      endedAt: options.isRunning === false ? "2026-03-08T12:00:03.000Z" : null,
      exitCode: options.isRunning === false ? 0 : null,
      expectedCount: hasExpectedCount ? expectedCount : null,
      isRunning: options.isRunning ?? true,
      logTail: [],
      phase: options.phase ?? "extracting",
      progress: options.progress,
      reason: "interval",
      runId: options.runId ?? "run-1",
      startedAt: "2026-03-08T12:00:00.000Z",
      states,
      statesCompleted,
      statesTotal: states.length,
      summary: options.summary ?? null,
      writtenCount,
    },
    snapshotRoot: "/tmp/parcels-sync",
    status: "ok",
  };
}

export function createPipelineStatusPayload(
  options: PipelineResponseOptions = {}
): PipelineStatusPayload {
  return {
    requestId: options.requestId ?? "req-success",
    response: createPipelineStatusResponse(options),
  };
}

export function createPipelineStatusFetchSuccess(
  options: PipelineResponseOptions = {}
): PipelineStatusFetchResult {
  return {
    ok: true,
    payload: createPipelineStatusPayload(options),
  };
}
