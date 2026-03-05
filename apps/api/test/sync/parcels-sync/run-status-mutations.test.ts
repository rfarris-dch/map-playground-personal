import { describe, expect, it } from "bun:test";
import { updateRunStateFromLine } from "@/sync/parcels-sync/run-progress-parsing.service";
import {
  createInitialRunStatus,
  createParcelsSyncStatusStore,
  reconcileRunStatus,
  setRunPhase,
  startRunStatus,
} from "@/sync/parcels-sync/run-status-mutations.service";

describe("parcels sync run status mutations", () => {
  it("starts a run in extracting phase with running invariants", () => {
    const status = createParcelsSyncStatusStore({
      enabled: true,
      intervalMs: 60_000,
      mode: "in-process",
      projectRoot: "/tmp/project",
      requireStartupSuccess: false,
      snapshotRoot: "/tmp/snapshots",
      syncScriptPath: "/tmp/sync.sh",
    });

    startRunStatus(status, "startup", "run-1");

    expect(status.run.runId).toBe("run-1");
    expect(status.run.phase).toBe("extracting");
    expect(status.run.isRunning).toBe(true);
    expect(status.run.progress?.phase).toBe("extracting");
  });

  it("normalizes illegal terminal/running combinations", () => {
    const run = createInitialRunStatus();
    run.phase = "completed";
    run.isRunning = true;
    run.exitCode = 2;
    run.progress = {
      schemaVersion: 1,
      phase: "extracting",
    };

    reconcileRunStatus(run);

    expect(run.isRunning).toBe(false);
    expect(run.exitCode).toBeNull();
    expect(run.progress?.phase).toBe("completed");
  });

  it("keeps progress payload while moving between running phases", () => {
    const run = createInitialRunStatus();
    run.isRunning = true;
    run.phase = "building";
    run.progress = {
      schemaVersion: 1,
      phase: "building",
      dbLoad: {
        activeWorkers: ["ca"],
        completedStates: 1,
        currentFile: "ca.ndjson",
        loadedFiles: 1,
        percent: 10,
        stepKey: "load",
        totalFiles: 10,
        totalStates: 50,
      },
    };

    setRunPhase(run, "publishing");

    expect(run.phase).toBe("publishing");
    expect(run.isRunning).toBe(true);
    expect(run.progress?.phase).toBe("publishing");
    expect(run.progress?.dbLoad?.activeWorkers).toEqual(["ca"]);
  });

  it("treats refresh complete log line as a terminal phase", () => {
    const run = createInitialRunStatus();
    run.isRunning = true;
    run.phase = "publishing";
    run.progress = {
      schemaVersion: 1,
      phase: "publishing",
    };

    updateRunStateFromLine(run, "[parcels] refresh complete");

    expect(run.phase).toBe("completed");
    expect(run.isRunning).toBe(false);
    expect(run.progress?.phase).toBe("completed");
  });
});
