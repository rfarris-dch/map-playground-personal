import type {
  ParcelsSyncConfig,
  ParcelsSyncRunReason,
  ParcelsSyncRunResult,
  ParcelsSyncStatusSnapshot,
} from "../parcels-sync.types";
import type { MutableParcelsSyncStatusSnapshot } from "./parcels-sync-runtime.types";
import { updateRunStateFromLine } from "./run-progress-parsing.service";
import {
  appendRunLogLine,
  createParcelsSyncStatusStore,
  refreshRunFromFilesystem,
  snapshotStatus,
  startRunStatus,
  updateConfigStatus,
} from "./run-status-mutations.service";

interface RunFinalization {
  readonly endedAt: string;
  readonly summary: string;
}

export class ParcelsSyncStatusStore {
  private readonly status: MutableParcelsSyncStatusSnapshot;

  constructor(config: ParcelsSyncConfig) {
    this.status = createParcelsSyncStatusStore(config);
  }

  refreshFromFilesystem(): void {
    refreshRunFromFilesystem(this.status);
  }

  updateConfig(config: ParcelsSyncConfig): void {
    updateConfigStatus(this.status, config);
  }

  snapshot(): ParcelsSyncStatusSnapshot {
    return snapshotStatus(this.status);
  }

  startRun(reason: ParcelsSyncRunReason, runId: string): void {
    startRunStatus(this.status, reason, runId);
  }

  applyOutputLine(line: string): void {
    appendRunLogLine(this.status.run, line);
    updateRunStateFromLine(this.status.run, line);
  }

  finalizeRun(result: ParcelsSyncRunResult, finalization: RunFinalization): void {
    this.status.run.durationMs = result.durationMs;
    this.status.run.exitCode = result.exitCode;
    this.status.run.endedAt = finalization.endedAt;
    this.status.run.summary = finalization.summary;
    this.status.run.isRunning = false;
  }

  markRunSucceeded(): void {
    this.status.run.phase = "completed";
    this.status.latestRunId = this.status.run.runId;
    this.status.latestRunCompletedAt = this.status.run.endedAt;
  }

  markRunFailed(summary: string): void {
    this.status.run.phase = "failed";
    this.status.run.summary = summary;
    this.status.run.endedAt = new Date().toISOString();
    this.status.run.isRunning = false;
  }

  markRunStopped(): void {
    this.status.run.isRunning = false;
  }
}
