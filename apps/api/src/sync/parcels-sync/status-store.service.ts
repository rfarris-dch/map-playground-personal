import type { MutableParcelsSyncStatusSnapshot } from "@/sync/parcels-sync/parcels-sync-runtime.types";
import { updateRunStateFromLine } from "@/sync/parcels-sync/run-progress-parsing.service";
import {
  appendRunLogLine,
  createParcelsSyncStatusStore,
  reconcileRunStatus,
  refreshRunFromFilesystem,
  setRunPhase,
  snapshotStatus,
  startRunStatus,
  updateConfigStatus,
} from "@/sync/parcels-sync/run-status-mutations.service";
import type {
  ParcelsSyncConfig,
  ParcelsSyncRunReason,
  ParcelsSyncRunResult,
  ParcelsSyncStatusSnapshot,
} from "@/sync/parcels-sync.types";
import type { RunFinalization } from "./status-store.service.types";

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
    reconcileRunStatus(this.status.run);
  }

  markRunSucceeded(): void {
    setRunPhase(this.status.run, "completed");
    this.status.latestRunId = this.status.run.runId;
    this.status.latestRunCompletedAt = this.status.run.endedAt;
  }

  markRunFailed(summary: string): void {
    setRunPhase(this.status.run, "failed");
    this.status.run.summary = summary;
    this.status.run.endedAt = new Date().toISOString();
    reconcileRunStatus(this.status.run);
  }

  markRunStopped(): void {
    this.status.run.isRunning = false;
    reconcileRunStatus(this.status.run);
  }
}
