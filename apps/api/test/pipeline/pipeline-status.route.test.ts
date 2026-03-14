import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { getPipelineDatasetDescriptor, PIPELINE_PLATFORM } from "@map-migration/http-contracts";

const getPipelineStatusResponseMock =
  mock<
    (dataset: "parcels" | "flood" | "hydro-basins") => Promise<{
      readonly dataset: ReturnType<typeof getPipelineDatasetDescriptor>;
      readonly enabled: boolean;
      readonly generatedAt: string;
      readonly intervalMs: number;
      readonly latestRunCompletedAt: string | null;
      readonly latestRunId: string | null;
      readonly mode: "external";
      readonly platform: typeof PIPELINE_PLATFORM;
      readonly requireStartupSuccess: boolean;
      readonly run: {
        readonly durationMs: number | null;
        readonly endedAt: string | null;
        readonly exitCode: number | null;
        readonly expectedCount: number | null;
        readonly isRunning: boolean;
        readonly logTail: readonly string[];
        readonly phase: "building";
        readonly progress: {
          readonly schemaVersion: 1;
          readonly phase: "building";
          readonly tileBuild: {
            readonly stage: "build";
            readonly logBytes: number;
          };
        } | null;
        readonly reason: "manual";
        readonly runId: string | null;
        readonly startedAt: string | null;
        readonly states: readonly [];
        readonly statesCompleted: number;
        readonly statesTotal: number;
        readonly summary: string | null;
        readonly writtenCount: number;
      };
      readonly snapshotRoot: string;
      readonly status: "ok";
    }>
  >();

mock.module("../../src/pipeline/pipeline-status.service", () => ({
  getPipelineStatusPayload: () =>
    Promise.resolve({
      status: "ok",
      generatedAt: "2026-03-13T12:00:00.000Z",
      enabled: true,
      mode: "external",
      intervalMs: 3000,
      requireStartupSuccess: false,
      snapshotRoot: "/tmp/fallback",
      latestRunId: null,
      latestRunCompletedAt: null,
      run: {
        runId: null,
        reason: "manual",
        phase: "idle",
        isRunning: false,
        startedAt: null,
        endedAt: null,
        durationMs: null,
        exitCode: null,
        summary: null,
        progress: null,
        states: [],
        statesCompleted: 0,
        statesTotal: 0,
        writtenCount: 0,
        expectedCount: null,
        logTail: [],
      },
    }),
  getPipelineStatusResponse: getPipelineStatusResponseMock,
}));

const { createApiApp } = await import("@/app");

afterAll(() => {
  mock.restore();
});

describe("pipeline status route", () => {
  beforeEach(() => {
    getPipelineStatusResponseMock.mockReset();
  });

  it("returns generic pipeline status for hydro basins", async () => {
    getPipelineStatusResponseMock.mockResolvedValue({
      dataset: getPipelineDatasetDescriptor("hydro-basins"),
      enabled: true,
      generatedAt: "2026-03-13T12:00:00.000Z",
      intervalMs: 3000,
      latestRunCompletedAt: "2026-03-13T11:50:00.000Z",
      latestRunId: "hydro-20260313",
      mode: "external",
      platform: PIPELINE_PLATFORM,
      requireStartupSuccess: false,
      run: {
        durationMs: null,
        endedAt: null,
        exitCode: null,
        expectedCount: 5,
        isRunning: true,
        logTail: ["build started"],
        phase: "building",
        progress: {
          schemaVersion: 1,
          phase: "building",
          tileBuild: {
            stage: "build",
            logBytes: 1024,
          },
        },
        reason: "manual",
        runId: "hydro-20260313",
        startedAt: "2026-03-13T11:55:00.000Z",
        states: [],
        statesCompleted: 3,
        statesTotal: 5,
        summary: "tiles:building",
        writtenCount: 3,
      },
      snapshotRoot: "/tmp/environmental-hydro-basins",
      status: "ok",
    });

    const app = createApiApp();
    const response = await app.request("/api/pipelines/hydro-basins/status");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.dataset.dataset).toBe("hydro-basins");
    expect(payload.dataset.displayName).toBe("Hydro Basins");
    expect(payload.platform.orchestration).toBe("dagster");
  });
});
