import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const getFloodSyncStatusSnapshotMock =
  mock<
    () => Promise<{
      readonly status: "ok";
      readonly generatedAt: string;
      readonly enabled: boolean;
      readonly mode: "external";
      readonly intervalMs: number;
      readonly requireStartupSuccess: boolean;
      readonly snapshotRoot: string;
      readonly latestRunId: string | null;
      readonly latestRunCompletedAt: string | null;
      readonly run: {
        readonly runId: string | null;
        readonly reason: "manual";
        readonly phase: "loading";
        readonly isRunning: boolean;
        readonly startedAt: string | null;
        readonly endedAt: string | null;
        readonly durationMs: number | null;
        readonly exitCode: number | null;
        readonly summary: string | null;
        readonly progress: {
          readonly schemaVersion: 1;
          readonly phase: "loading";
          readonly dbLoad: {
            readonly stepKey: "staging";
            readonly percent: number | null;
            readonly loadedFiles: number;
            readonly totalFiles: number;
            readonly currentFile: string | null;
            readonly completedStates: number | null;
            readonly totalStates: number | null;
            readonly activeWorkers: readonly string[];
          };
        };
        readonly states: readonly [
          {
            readonly state: "extract";
            readonly expectedCount: number;
            readonly writtenCount: number;
            readonly pagesFetched: number;
            readonly lastSourceId: null;
            readonly updatedAt: string | null;
            readonly isCompleted: boolean;
          },
        ];
        readonly statesCompleted: number;
        readonly statesTotal: number;
        readonly writtenCount: number;
        readonly expectedCount: number | null;
        readonly logTail: readonly string[];
      };
    }>
  >();

mock.module("../../../src/geo/flood/flood-sync-status.service", () => ({
  getFloodSyncStatusSnapshot: getFloodSyncStatusSnapshotMock,
}));

const { createApiApp } = await import("@/app");

afterAll(() => {
  mock.restore();
});

describe("flood sync status route", () => {
  beforeEach(() => {
    getFloodSyncStatusSnapshotMock.mockReset();
  });

  it("returns flood monitor status with the shared sync-status schema", async () => {
    getFloodSyncStatusSnapshotMock.mockResolvedValue({
      status: "ok",
      generatedAt: "2026-03-09T23:00:00.000Z",
      enabled: true,
      mode: "external",
      intervalMs: 3000,
      requireStartupSuccess: false,
      snapshotRoot: "/tmp/environmental-flood",
      latestRunId: "full-us-real-flood-20260307",
      latestRunCompletedAt: "2026-03-08T00:57:50.000Z",
      run: {
        runId: "full-us-real-flood-20260307",
        reason: "manual",
        phase: "loading",
        isRunning: true,
        startedAt: "2026-03-09T21:00:00.000Z",
        endedAt: null,
        durationMs: null,
        exitCode: null,
        summary: "flood-load staging rows=120000 stage=512MB",
        progress: {
          schemaVersion: 1,
          phase: "loading",
          dbLoad: {
            stepKey: "staging",
            percent: null,
            loadedFiles: 1,
            totalFiles: 1,
            currentFile: "/tmp/source.mbtiles",
            completedStates: null,
            totalStates: null,
            activeWorkers: ["environmental_build.flood_hazard_stage"],
          },
        },
        states: [
          {
            state: "extract",
            expectedCount: 1,
            writtenCount: 1,
            pagesFetched: 1,
            lastSourceId: null,
            updatedAt: "2026-03-09T21:00:01.000Z",
            isCompleted: true,
          },
        ],
        statesCompleted: 1,
        statesTotal: 1,
        writtenCount: 120_000,
        expectedCount: null,
        logTail: [],
      },
    });

    const app = createApiApp();
    const response = await app.request("/api/geo/flood/sync/status");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.run.phase).toBe("loading");
    expect(payload.run.progress.dbLoad.percent).toBeNull();
    expect(payload.latestRunId).toBe("full-us-real-flood-20260307");
  });
});
