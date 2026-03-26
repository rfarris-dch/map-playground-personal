import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getPipelineDatasetDescriptor,
  type PipelineDataset,
} from "@map-migration/http-contracts/pipeline-http";
import {
  type SyncStatusResponse,
  SyncStatusResponseSchema,
} from "@map-migration/http-contracts/sync-run-http";
import { defaultSnapshotRootForDataset } from "@map-migration/ops/etl/project-paths";
import { readLatestPointer } from "@/sync/parcels-sync/snapshot-read.service";

const CACHE_TTL_MS = 5000;
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const PIPELINE_RUNNER_STATUS_FILE_NAME = "pipeline-runner-status.json";

const statusCache = new Map<
  string,
  {
    readonly expiresAt: number;
    readonly value: SyncStatusResponse;
  }
>();

function resolveSnapshotRoot(dataset: PipelineDataset): string {
  if (dataset === "flood") {
    return resolve(PROJECT_ROOT, defaultSnapshotRootForDataset("environmental-flood"));
  }

  if (dataset === "hydro-basins") {
    return resolve(PROJECT_ROOT, defaultSnapshotRootForDataset("environmental-hydro-basins"));
  }

  return resolve(PROJECT_ROOT, defaultSnapshotRootForDataset("parcels"));
}

function buildIdleStatus(dataset: PipelineDataset, snapshotRoot: string): SyncStatusResponse {
  const latestPointer = readLatestPointer(snapshotRoot);
  const assetChainStates = getPipelineDatasetDescriptor(dataset).assetChain.map((assetKey) => ({
    state: assetKey,
    expectedCount: 1,
    writtenCount: 0,
    pagesFetched: 0,
    lastSourceId: null,
    updatedAt: null,
    isCompleted: false,
  }));

  return {
    status: "ok",
    generatedAt: new Date().toISOString(),
    enabled: true,
    mode: "external",
    intervalMs: 3000,
    requireStartupSuccess: false,
    snapshotRoot,
    latestRunId: latestPointer.runId,
    latestRunCompletedAt: latestPointer.updatedAt,
    run: {
      runId: latestPointer.runId,
      reason: null,
      phase: "idle",
      isRunning: false,
      startedAt: null,
      endedAt: null,
      durationMs: null,
      exitCode: null,
      summary: null,
      progress: {
        schemaVersion: 1,
        phase: "idle",
      },
      states: assetChainStates,
      statesCompleted: 0,
      statesTotal: assetChainStates.length,
      writtenCount: 0,
      expectedCount: assetChainStates.length,
      logTail: [],
    },
  };
}

export function getPipelineRunnerStatusSnapshot(dataset: PipelineDataset) {
  const cached = statusCache.get(dataset);
  if (cached !== undefined && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  const snapshotRoot = resolveSnapshotRoot(dataset);
  const statusPath = join(snapshotRoot, PIPELINE_RUNNER_STATUS_FILE_NAME);
  let value = buildIdleStatus(dataset, snapshotRoot);

  if (existsSync(statusPath)) {
    try {
      value = SyncStatusResponseSchema.parse(JSON.parse(readFileSync(statusPath, "utf8")));
    } catch {
      value = buildIdleStatus(dataset, snapshotRoot);
    }
  }

  statusCache.set(dataset, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}
