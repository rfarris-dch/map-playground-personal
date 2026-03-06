import { describe, expect, it } from "bun:test";
import { ParcelsSyncStatusStore } from "@/sync/parcels-sync/status-store.service";
import type { ParcelsSyncConfig } from "@/sync/parcels-sync.types";

function buildConfig(): ParcelsSyncConfig {
  return {
    enabled: true,
    intervalMs: 60_000,
    mode: "in-process",
    projectRoot: "/tmp/project",
    requireStartupSuccess: false,
    snapshotRoot: "/tmp/snapshots",
    syncScriptPath: "/tmp/sync.sh",
  };
}

describe("parcels sync status store", () => {
  it("marks failed phase on nonzero run finalization", () => {
    const store = new ParcelsSyncStatusStore(buildConfig());
    store.startRun("interval", "run-1");

    store.finalizeRun(
      {
        durationMs: 42,
        exitCode: 1,
        stderr: "failed",
        stdout: "",
      },
      {
        endedAt: "2026-03-06T00:00:00Z",
        summary: "exit=1",
      }
    );

    const snapshot = store.snapshot();
    expect(snapshot.run.phase).toBe("failed");
    expect(snapshot.run.isRunning).toBe(false);
    expect(snapshot.run.endedAt).toBe("2026-03-06T00:00:00Z");
    expect(snapshot.run.summary).toBe("exit=1");
  });
});
