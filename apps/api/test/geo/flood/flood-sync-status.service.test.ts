import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const runQueryMock = mock(async () => []);

mock.module("@/db/postgres", () => ({
  runQuery: runQueryMock,
}));

const { getFloodSyncStatusSnapshot } = await import(
  "../../../src/geo/flood/flood-sync-status.service"
);

function writeJson(path: string, value: Record<string, unknown>): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("flood sync status service", () => {
  let snapshotRoot: string;

  beforeEach(() => {
    runQueryMock.mockReset();
    runQueryMock.mockResolvedValue([]);
    snapshotRoot = mkdtempSync(join(tmpdir(), "flood-sync-status-"));
    process.env.ENVIRONMENTAL_FLOOD_SNAPSHOT_ROOT = snapshotRoot;
  });

  afterEach(() => {
    process.env.ENVIRONMENTAL_FLOOD_SNAPSHOT_ROOT = undefined;
    rmSync(snapshotRoot, { force: true, recursive: true });
  });

  afterAll(() => {
    mock.restore();
  });

  it("ignores a stale running marker when a newer completed run is published", async () => {
    const staleRunDir = join(snapshotRoot, "stale-run");
    const completedRunDir = join(snapshotRoot, "completed-run");
    mkdirSync(staleRunDir, { recursive: true });
    mkdirSync(completedRunDir, { recursive: true });

    writeJson(join(staleRunDir, "run-config.json"), {
      createdAt: "2026-03-10T10:00:00Z",
      runId: "stale-run",
    });
    writeJson(join(staleRunDir, "active-run.json"), {
      isRunning: true,
      phase: "loading",
      reason: "manual",
      runId: "stale-run",
      startedAt: "2026-03-10T10:00:00Z",
      updatedAt: "2026-03-10T10:01:00Z",
    });

    writeJson(join(completedRunDir, "run-config.json"), {
      createdAt: "2026-03-10T11:00:00Z",
      runId: "completed-run",
    });
    writeJson(join(completedRunDir, "run-summary.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      featureCount: 42,
      runId: "completed-run",
    });
    writeJson(join(completedRunDir, "publish-complete.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      phase: "publishing",
      runId: "completed-run",
      summary: "manifest-published",
    });
    writeJson(join(snapshotRoot, "latest.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      dataset: "environmental-flood",
      runDir: completedRunDir,
      runId: "completed-run",
    });

    const snapshot = await getFloodSyncStatusSnapshot();

    expect(snapshot.run.runId).toBe("completed-run");
    expect(snapshot.run.phase).toBe("completed");
    expect(snapshot.run.isRunning).toBe(false);
    expect(snapshot.latestRunId).toBe("completed-run");
  });

  it("keeps a fresh running marker as the active run", async () => {
    const runningRunDir = join(snapshotRoot, "running-run");
    const completedRunDir = join(snapshotRoot, "completed-run");
    mkdirSync(runningRunDir, { recursive: true });
    mkdirSync(completedRunDir, { recursive: true });

    const nowIso = new Date().toISOString();

    writeJson(join(runningRunDir, "run-config.json"), {
      createdAt: nowIso,
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "active-run.json"), {
      isRunning: true,
      phase: "loading",
      reason: "manual",
      runId: "running-run",
      startedAt: nowIso,
      summary: "flood-load staging rows=5000 stage=128MB",
      updatedAt: nowIso,
    });

    writeJson(join(completedRunDir, "run-config.json"), {
      createdAt: "2026-03-10T11:00:00Z",
      runId: "completed-run",
    });
    writeJson(join(completedRunDir, "run-summary.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      featureCount: 42,
      runId: "completed-run",
    });
    writeJson(join(completedRunDir, "publish-complete.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      phase: "publishing",
      runId: "completed-run",
      summary: "manifest-published",
    });
    writeJson(join(snapshotRoot, "latest.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      dataset: "environmental-flood",
      runDir: completedRunDir,
      runId: "completed-run",
    });

    const snapshot = await getFloodSyncStatusSnapshot();

    expect(snapshot.run.runId).toBe("running-run");
    expect(snapshot.run.phase).toBe("loading");
    expect(snapshot.run.isRunning).toBe(true);
    expect(snapshot.latestRunId).toBe("completed-run");
  });

  it("uses normalize-progress written counts for active normalize runs", async () => {
    const runningRunDir = join(snapshotRoot, "running-run");
    const completedRunDir = join(snapshotRoot, "completed-run");
    mkdirSync(join(runningRunDir, "normalized"), { recursive: true });
    mkdirSync(completedRunDir, { recursive: true });

    const nowIso = new Date().toISOString();
    writeFileSync(
      join(runningRunDir, "normalized", "flood-hazard.geojsonl"),
      `${"{}".repeat(2048)}\n`,
      "utf8"
    );

    writeJson(join(runningRunDir, "run-config.json"), {
      createdAt: nowIso,
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "run-summary.json"), {
      completedAt: nowIso,
      featureCount: 120,
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "active-run.json"), {
      isRunning: true,
      phase: "normalizing",
      reason: "manual",
      runId: "running-run",
      startedAt: nowIso,
      summary:
        "normalize written=90 processed=95 total=120 percent=75% lastObjectId=95 pageSize=500 skipped=5",
      updatedAt: nowIso,
    });
    writeJson(join(runningRunDir, "normalize-progress.json"), {
      geometryBatchSize: 12,
      lastObjectId: 95,
      outputBytes: 4096,
      pageSize: 500,
      processedCount: 95,
      skippedCount: 5,
      skippedObjectIds: [91, 92, 93, 94, 95],
      updatedAt: nowIso,
      writtenCount: 90,
    });

    writeJson(join(completedRunDir, "run-config.json"), {
      createdAt: "2026-03-10T11:00:00Z",
      runId: "completed-run",
    });
    writeJson(join(completedRunDir, "run-summary.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      featureCount: 42,
      runId: "completed-run",
    });
    writeJson(join(completedRunDir, "publish-complete.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      phase: "publishing",
      runId: "completed-run",
      summary: "manifest-published",
    });
    writeJson(join(snapshotRoot, "latest.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      dataset: "environmental-flood",
      runDir: completedRunDir,
      runId: "completed-run",
    });

    const snapshot = await getFloodSyncStatusSnapshot();
    const normalizeState = snapshot.run.states.find((stateRow) => stateRow.state === "normalize");

    expect(snapshot.run.runId).toBe("running-run");
    expect(snapshot.run.phase).toBe("extracting");
    expect(snapshot.run.writtenCount).toBe(90);
    expect(snapshot.latestRunId).toBe("completed-run");
    expect(normalizeState).toEqual({
      state: "normalize",
      expectedCount: 120,
      writtenCount: 90,
      pagesFetched: 1,
      lastSourceId: null,
      updatedAt: nowIso,
      isCompleted: false,
    });
  });

  it("keeps flood load expected counts during staging copy progress", async () => {
    const runningRunDir = join(snapshotRoot, "running-run");
    const completedRunDir = join(snapshotRoot, "completed-run");
    mkdirSync(runningRunDir, { recursive: true });
    mkdirSync(completedRunDir, { recursive: true });

    const nowIso = new Date().toISOString();

    runQueryMock
      .mockResolvedValueOnce([
        {
          bytes_processed: 1024,
          bytes_total: 2048,
          pid: 123,
          rel_name: "environmental_build.flood_hazard_stage",
          tuples_excluded: 0,
          tuples_processed: 6000,
        },
      ])
      .mockResolvedValueOnce([
        {
          stage_rows_inserted: 6000,
          stage_rows_live: 6000,
          stage_table_bytes: 128 * 1024 * 1024,
        },
      ]);

    writeJson(join(runningRunDir, "run-config.json"), {
      createdAt: nowIso,
      options: {
        normalizeStrategy: "direct-postgres",
      },
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "run-summary.json"), {
      completedAt: nowIso,
      featureCount: 120,
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "active-run.json"), {
      isRunning: true,
      phase: "loading",
      reason: "manual",
      runId: "running-run",
      startedAt: nowIso,
      summary: "flood-load staging rows=6000 stage=128MB",
      updatedAt: nowIso,
    });
    writeJson(join(runningRunDir, "normalize-progress.json"), {
      outputBytes: 0,
      outputKind: "direct-postgres",
      processedCount: 120,
      updatedAt: nowIso,
      writtenCount: 120,
    });
    writeJson(join(runningRunDir, "normalize-complete.json"), {
      completedAt: nowIso,
      phase: "normalizing",
      runId: "running-run",
      summary: "normalization-complete",
    });

    writeJson(join(completedRunDir, "run-config.json"), {
      createdAt: "2026-03-10T11:00:00Z",
      runId: "completed-run",
    });
    writeJson(join(completedRunDir, "run-summary.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      featureCount: 42,
      runId: "completed-run",
    });
    writeJson(join(completedRunDir, "publish-complete.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      phase: "publishing",
      runId: "completed-run",
      summary: "manifest-published",
    });
    writeJson(join(snapshotRoot, "latest.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      dataset: "environmental-flood",
      runDir: completedRunDir,
      runId: "completed-run",
    });

    const snapshot = await getFloodSyncStatusSnapshot();
    const loadState = snapshot.run.states.find((stateRow) => stateRow.state === "load");

    expect(snapshot.run.phase).toBe("loading");
    expect(snapshot.run.writtenCount).toBe(6000);
    expect(snapshot.run.expectedCount).toBe(120);
    expect(loadState?.expectedCount).toBe(120);
    expect(loadState?.writtenCount).toBe(6000);
  });

  it("prefers live copy tuples over stale stage stats during flood loading", async () => {
    const runningRunDir = join(snapshotRoot, "running-run");
    mkdirSync(runningRunDir, { recursive: true });

    const nowIso = new Date().toISOString();

    runQueryMock
      .mockResolvedValueOnce([
        {
          bytes_processed: 4096,
          bytes_total: 8192,
          pid: 456,
          rel_name: "environmental_build.flood_hazard_stage",
          tuples_excluded: 0,
          tuples_processed: 1005,
        },
      ])
      .mockResolvedValueOnce([
        {
          stage_rows_inserted: 0,
          stage_rows_live: 0,
          stage_table_bytes: 34 * 1024 * 1024,
        },
      ]);

    writeJson(join(runningRunDir, "run-config.json"), {
      createdAt: nowIso,
      options: {
        normalizeStrategy: "direct-postgres",
      },
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "run-summary.json"), {
      completedAt: nowIso,
      featureCount: 120,
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "active-run.json"), {
      isRunning: true,
      phase: "loading",
      reason: "manual",
      runId: "running-run",
      startedAt: nowIso,
      summary: "flood-load staging rows=0 stage=34MB",
      updatedAt: nowIso,
    });
    writeJson(join(runningRunDir, "normalize-progress.json"), {
      outputBytes: 0,
      outputKind: "direct-postgres",
      processedCount: 120,
      updatedAt: nowIso,
      writtenCount: 120,
    });
    writeJson(join(runningRunDir, "normalize-complete.json"), {
      completedAt: nowIso,
      phase: "normalizing",
      runId: "running-run",
      summary: "normalization-complete",
    });
    writeJson(join(runningRunDir, "load-progress.json"), {
      completedSourceIds: ["NFHL_01_20260220"],
      completedSourceRowCounts: {
        NFHL_01_20260220: 500_000,
      },
      currentSourceId: "NFHL_02_20250811",
      currentStateLabel: "02",
      loadedRowCount: 500_000,
      totalSourceCount: 51,
      updatedAt: nowIso,
    });

    const snapshot = await getFloodSyncStatusSnapshot();
    const loadState = snapshot.run.states.find((stateRow) => stateRow.state === "load");

    expect(snapshot.run.phase).toBe("loading");
    expect(snapshot.run.writtenCount).toBe(501_005);
    expect(snapshot.run.expectedCount).toBe(120);
    expect(loadState?.writtenCount).toBe(501_005);
  });

  it("uses cumulative completed rows plus live copy tuples during append-based flood loading", async () => {
    const runningRunDir = join(snapshotRoot, "running-run");
    mkdirSync(runningRunDir, { recursive: true });

    const nowIso = new Date().toISOString();

    runQueryMock
      .mockResolvedValueOnce([
        {
          bytes_processed: 8192,
          bytes_total: 16_384,
          pid: 789,
          rel_name: "environmental_build.flood_hazard_stage",
          tuples_excluded: 0,
          tuples_processed: 58_218,
        },
      ])
      .mockResolvedValueOnce([
        {
          stage_rows_inserted: 65_535,
          stage_rows_live: 65_535,
          stage_table_bytes: 2951 * 1024 * 1024,
        },
      ]);

    writeJson(join(runningRunDir, "run-config.json"), {
      createdAt: nowIso,
      options: {
        normalizeStrategy: "direct-postgres",
      },
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "run-summary.json"), {
      completedAt: nowIso,
      featureCount: 5_461_711,
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "active-run.json"), {
      isRunning: true,
      phase: "loading",
      reason: "manual",
      runId: "running-run",
      startedAt: nowIso,
      summary: "flood-load staging rows=65535 stage=2951MB",
      updatedAt: nowIso,
    });
    writeJson(join(runningRunDir, "normalize-progress.json"), {
      outputBytes: 0,
      outputKind: "direct-postgres",
      processedCount: 5_461_711,
      updatedAt: nowIso,
      writtenCount: 5_461_711,
    });
    writeJson(join(runningRunDir, "normalize-complete.json"), {
      completedAt: nowIso,
      phase: "normalizing",
      runId: "running-run",
      summary: "normalization-complete",
    });
    writeJson(join(runningRunDir, "load-progress.json"), {
      completedSourceIds: ["NFHL_01_20260220"],
      completedSourceRowCounts: {
        NFHL_01_20260220: 50_000,
      },
      currentSourceId: "NFHL_02_20250811",
      currentStateLabel: "02",
      loadedRowCount: 50_000,
      totalSourceCount: 51,
      updatedAt: nowIso,
    });

    const snapshot = await getFloodSyncStatusSnapshot();
    const loadState = snapshot.run.states.find((stateRow) => stateRow.state === "load");

    expect(snapshot.run.phase).toBe("loading");
    expect(snapshot.run.writtenCount).toBe(108_218);
    expect(loadState?.writtenCount).toBe(108_218);
  });

  it("surfaces flood build progress from the live runner log", async () => {
    const runningRunDir = join(snapshotRoot, "running-run");
    mkdirSync(runningRunDir, { recursive: true });

    const nowIso = new Date().toISOString();

    writeJson(join(runningRunDir, "run-config.json"), {
      createdAt: nowIso,
      options: {
        normalizeStrategy: "direct-postgres",
      },
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "run-summary.json"), {
      completedAt: nowIso,
      featureCount: 4_505_932,
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "active-run.json"), {
      isRunning: true,
      phase: "building",
      reason: "manual",
      runId: "running-run",
      startedAt: nowIso,
      summary: "tiles:building",
      updatedAt: nowIso,
    });
    writeJson(join(runningRunDir, "normalize-progress.json"), {
      outputBytes: 0,
      outputKind: "direct-postgres",
      processedCount: 4_505_932,
      updatedAt: nowIso,
      writtenCount: 4_505_932,
    });
    writeJson(join(runningRunDir, "normalize-complete.json"), {
      completedAt: nowIso,
      phase: "normalizing",
      runId: "running-run",
      summary: "normalization-complete",
    });
    writeJson(join(runningRunDir, "load-complete.json"), {
      completedAt: nowIso,
      phase: "loading",
      runId: "running-run",
      summary: "database-load-complete",
    });
    writeFileSync(
      join(runningRunDir, "runner.log"),
      [
        "[tiles] building environmental flood PMTiles",
        "[tiles] dataset=environmental-flood layer=flood-hazard z=0-14 threads=7",
        "Read 4.50 million features",
        "Reordering geometry: 99%",
        "  12.1%  2/0/1  ",
      ].join("\n"),
      "utf8"
    );

    const snapshot = await getFloodSyncStatusSnapshot();

    expect(snapshot.run.phase).toBe("building");
    expect(snapshot.run.summary).toContain("tiles:building");
    expect(snapshot.run.summary).toContain("phase=");
    expect(snapshot.run.progress?.tileBuild?.stage).toBe("build");
    expect(snapshot.run.progress?.tileBuild?.percent).toBeGreaterThan(60);
    expect(snapshot.run.progress?.tileBuild?.logBytes).toBeGreaterThan(0);
    expect(snapshot.run.progress?.tileBuild?.workDone).toBeGreaterThan(0);
  });

  it("uses tippecanoe json progress lines for streamed flood builds", async () => {
    const runningRunDir = join(snapshotRoot, "running-run");
    mkdirSync(runningRunDir, { recursive: true });

    const nowIso = new Date().toISOString();

    writeJson(join(runningRunDir, "run-config.json"), {
      createdAt: nowIso,
      options: {
        normalizeStrategy: "direct-postgres",
      },
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "run-summary.json"), {
      completedAt: nowIso,
      featureCount: 4_505_932,
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "active-run.json"), {
      isRunning: true,
      phase: "building",
      reason: "manual",
      runId: "running-run",
      startedAt: nowIso,
      summary: "tiles:building",
      updatedAt: nowIso,
    });
    writeJson(join(runningRunDir, "normalize-progress.json"), {
      outputBytes: 0,
      outputKind: "direct-postgres",
      processedCount: 4_505_932,
      updatedAt: nowIso,
      writtenCount: 4_505_932,
    });
    writeJson(join(runningRunDir, "normalize-complete.json"), {
      completedAt: nowIso,
      phase: "normalizing",
      runId: "running-run",
      summary: "normalization-complete",
    });
    writeJson(join(runningRunDir, "load-complete.json"), {
      completedAt: nowIso,
      phase: "loading",
      runId: "running-run",
      summary: "database-load-complete",
    });
    writeFileSync(
      join(runningRunDir, "runner.log"),
      [
        "[tiles] building environmental flood PMTiles",
        "[tiles] dataset=environmental-flood layer=flood-hazard z=0-14 threads=7",
        "[tiles] reduced-feature-count=1200",
        '{"progress":34.2}',
        '{"progress":68.4}',
        '{"progress":71.0}',
      ].join("\n"),
      "utf8"
    );

    const snapshot = await getFloodSyncStatusSnapshot();

    expect(snapshot.run.phase).toBe("building");
    expect(snapshot.run.isRunning).toBe(true);
    expect(snapshot.run.progress?.tileBuild?.percent).toBe(71);
    expect(snapshot.run.progress?.tileBuild?.workDone).toBeGreaterThan(0);
    expect(snapshot.run.progress?.tileBuild?.workTotal).toBe(1200);
  });

  it("uses reduced export row counts before tippecanoe progress is available", async () => {
    const runningRunDir = join(snapshotRoot, "running-run");
    mkdirSync(runningRunDir, { recursive: true });

    const nowIso = new Date().toISOString();

    writeJson(join(runningRunDir, "run-config.json"), {
      createdAt: nowIso,
      options: {
        normalizeStrategy: "direct-postgres",
      },
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "run-summary.json"), {
      completedAt: nowIso,
      featureCount: 4_505_932,
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "active-run.json"), {
      isRunning: true,
      phase: "building",
      reason: "manual",
      runId: "running-run",
      startedAt: nowIso,
      summary: "tiles:building",
      updatedAt: nowIso,
    });
    writeJson(join(runningRunDir, "normalize-progress.json"), {
      outputBytes: 0,
      outputKind: "direct-postgres",
      processedCount: 4_505_932,
      updatedAt: nowIso,
      writtenCount: 4_505_932,
    });
    writeJson(join(runningRunDir, "normalize-complete.json"), {
      completedAt: nowIso,
      phase: "normalizing",
      runId: "running-run",
      summary: "normalization-complete",
    });
    writeJson(join(runningRunDir, "load-complete.json"), {
      completedAt: nowIso,
      phase: "loading",
      runId: "running-run",
      summary: "database-load-complete",
    });
    writeFileSync(
      join(runningRunDir, "runner.log"),
      [
        "[tiles] building environmental flood PMTiles",
        "[tiles] dataset=environmental-flood layer=flood-hazard z=0-13 threads=7",
        "[tiles] build-mode=reduced-overlay subdivide=255",
        "[tiles] reduced-export-count=5000",
        "[tiles] reduced-export-count=125000",
      ].join("\n"),
      "utf8"
    );

    const snapshot = await getFloodSyncStatusSnapshot();

    expect(snapshot.run.phase).toBe("building");
    expect(snapshot.run.progress?.tileBuild?.workDone).toBe(125_000);
    expect(snapshot.run.progress?.tileBuild?.workTotal).toBeNull();
    expect(snapshot.run.summary).toContain("phase=reduced-export");
  });

  it("treats live reduced export copy progress as open-ended until reduced totals are known", async () => {
    const runningRunDir = join(snapshotRoot, "running-run");
    mkdirSync(runningRunDir, { recursive: true });

    const nowIso = new Date().toISOString();

    writeJson(join(runningRunDir, "run-config.json"), {
      createdAt: nowIso,
      options: {
        normalizeStrategy: "direct-postgres",
      },
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "run-summary.json"), {
      completedAt: nowIso,
      featureCount: 4_505_932,
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "active-run.json"), {
      isRunning: true,
      phase: "building",
      reason: "manual",
      runId: "running-run",
      startedAt: nowIso,
      summary: "tiles:building",
      updatedAt: nowIso,
    });
    writeJson(join(runningRunDir, "normalize-progress.json"), {
      outputBytes: 0,
      outputKind: "direct-postgres",
      processedCount: 4_505_932,
      updatedAt: nowIso,
      writtenCount: 4_505_932,
    });
    writeJson(join(runningRunDir, "normalize-complete.json"), {
      completedAt: nowIso,
      phase: "normalizing",
      runId: "running-run",
      summary: "normalization-complete",
    });
    writeJson(join(runningRunDir, "load-complete.json"), {
      completedAt: nowIso,
      phase: "loading",
      runId: "running-run",
      summary: "database-load-complete",
    });

    runQueryMock.mockImplementation((queryText: string) => {
      if (
        queryText.includes("pg_stat_progress_copy") &&
        queryText.includes("activity.query ILIKE $1")
      ) {
        return Promise.resolve([
          {
            bytes_processed: 277_493_885,
            bytes_total: 0,
            elapsed_seconds: 490,
            pid: 1753,
            tuples_processed: 64_029,
          },
        ]);
      }

      return Promise.resolve([]);
    });

    const snapshot = await getFloodSyncStatusSnapshot();

    expect(snapshot.run.phase).toBe("building");
    expect(snapshot.run.progress?.tileBuild?.workDone).toBe(64_029);
    expect(snapshot.run.progress?.tileBuild?.workTotal).toBeNull();
    expect(snapshot.run.progress?.tileBuild?.percent).toBeNull();
    expect(snapshot.run.summary).toContain("phase=reduced-export");
  });

  it("prefers fresh flood build log activity over a stale failed marker", async () => {
    const runningRunDir = join(snapshotRoot, "running-run");
    mkdirSync(runningRunDir, { recursive: true });

    const nowIso = new Date().toISOString();

    writeJson(join(runningRunDir, "run-config.json"), {
      createdAt: nowIso,
      options: {
        normalizeStrategy: "direct-postgres",
      },
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "run-summary.json"), {
      completedAt: nowIso,
      featureCount: 4_505_932,
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "active-run.json"), {
      isRunning: true,
      phase: "failed",
      reason: "manual",
      runId: "running-run",
      startedAt: "2026-03-11T16:05:20Z",
      summary: "tiles:building",
      updatedAt: "2026-03-12T09:00:00Z",
    });
    writeJson(join(runningRunDir, "normalize-progress.json"), {
      outputBytes: 0,
      outputKind: "direct-postgres",
      processedCount: 4_505_932,
      updatedAt: nowIso,
      writtenCount: 4_505_932,
    });
    writeJson(join(runningRunDir, "normalize-complete.json"), {
      completedAt: nowIso,
      phase: "normalizing",
      runId: "running-run",
      summary: "normalization-complete",
    });
    writeJson(join(runningRunDir, "load-complete.json"), {
      completedAt: nowIso,
      phase: "loading",
      runId: "running-run",
      summary: "database-load-complete",
    });
    writeFileSync(
      join(runningRunDir, "runner.log"),
      [
        "[tiles] building environmental flood PMTiles",
        "[tiles] dataset=environmental-flood layer=flood-hazard z=0-14 threads=7",
        '{"progress":12.5}',
      ].join("\n"),
      "utf8"
    );

    const snapshot = await getFloodSyncStatusSnapshot();

    expect(snapshot.run.phase).toBe("building");
    expect(snapshot.run.isRunning).toBe(true);
    expect(snapshot.run.exitCode).toBeNull();
    expect(snapshot.run.progress?.tileBuild?.percent).toBe(12.5);
  });

  it("surfaces a newer stale active run without overwriting the latest completed pointer", async () => {
    const staleRunDir = join(snapshotRoot, "stale-run");
    const completedRunDir = join(snapshotRoot, "completed-run");
    mkdirSync(staleRunDir, { recursive: true });
    mkdirSync(completedRunDir, { recursive: true });

    writeJson(join(staleRunDir, "run-config.json"), {
      createdAt: "2026-03-10T11:55:00Z",
      runId: "stale-run",
    });
    writeJson(join(staleRunDir, "active-run.json"), {
      isRunning: true,
      phase: "loading",
      reason: "manual",
      runId: "stale-run",
      startedAt: "2026-03-10T11:55:00Z",
      summary: "flood-load staging rows=8000 stage=128MB",
      updatedAt: "2026-03-10T11:58:00Z",
    });

    writeJson(join(completedRunDir, "run-config.json"), {
      createdAt: "2026-03-10T11:00:00Z",
      runId: "completed-run",
    });
    writeJson(join(completedRunDir, "run-summary.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      featureCount: 42,
      runId: "completed-run",
    });
    writeJson(join(completedRunDir, "publish-complete.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      phase: "publishing",
      runId: "completed-run",
      summary: "manifest-published",
    });
    writeJson(join(snapshotRoot, "latest.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      dataset: "environmental-flood",
      runDir: completedRunDir,
      runId: "completed-run",
    });

    const snapshot = await getFloodSyncStatusSnapshot();

    expect(snapshot.run.runId).toBe("stale-run");
    expect(snapshot.run.phase).toBe("failed");
    expect(snapshot.latestRunId).toBe("completed-run");
    expect(snapshot.latestRunCompletedAt).toBe("2026-03-10T11:30:00Z");
  });

  it("uses durable materialize progress totals when canonical finalization is batched", async () => {
    const runningRunDir = join(snapshotRoot, "running-run");
    mkdirSync(runningRunDir, { recursive: true });

    const nowIso = new Date().toISOString();

    runQueryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    writeJson(join(runningRunDir, "run-config.json"), {
      createdAt: nowIso,
      options: {
        normalizeStrategy: "direct-postgres",
      },
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "run-summary.json"), {
      completedAt: nowIso,
      featureCount: 5_461_711,
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "active-run.json"), {
      isRunning: true,
      phase: "loading",
      reason: "manual",
      runId: "running-run",
      startedAt: nowIso,
      summary: "canonical loaded=450593 total=4505932 percent=10% range=1-10103 mode=materialize",
      updatedAt: nowIso,
    });
    writeJson(join(runningRunDir, "normalize-progress.json"), {
      outputBytes: 0,
      outputKind: "direct-postgres",
      processedCount: 5_461_711,
      updatedAt: nowIso,
      writtenCount: 5_461_711,
    });
    writeJson(join(runningRunDir, "normalize-complete.json"), {
      completedAt: nowIso,
      phase: "normalizing",
      runId: "running-run",
      summary: "normalization-complete",
    });
    writeJson(join(runningRunDir, "load-progress.json"), {
      completedSourceIds: ["NFHL_01_20260220"],
      completedSourceRowCounts: {
        NFHL_01_20260220: 68_994,
      },
      currentSourceId: null,
      currentStateLabel: null,
      loadedRowCount: 4_505_932,
      materializeExpectedCount: 4_505_932,
      materializeProcessedRowCount: 450_593,
      materializeRangeEnd: 10_103,
      totalSourceCount: 51,
      updatedAt: nowIso,
    });

    const snapshot = await getFloodSyncStatusSnapshot();
    const loadState = snapshot.run.states.find((stateRow) => stateRow.state === "load");

    expect(snapshot.run.phase).toBe("loading");
    expect(snapshot.run.expectedCount).toBe(4_505_932);
    expect(snapshot.run.writtenCount).toBe(450_593);
    expect(loadState?.expectedCount).toBe(4_505_932);
    expect(loadState?.writtenCount).toBe(450_593);
  });

  it("fails a fresh normalize run when progress is ahead of durable bytes", async () => {
    const runningRunDir = join(snapshotRoot, "running-run");
    const completedRunDir = join(snapshotRoot, "completed-run");
    mkdirSync(join(runningRunDir, "normalized"), { recursive: true });
    mkdirSync(completedRunDir, { recursive: true });

    const nowIso = new Date().toISOString();
    writeFileSync(join(runningRunDir, "normalized", "flood-hazard.geojsonl"), "{}\n", "utf8");

    writeJson(join(runningRunDir, "run-config.json"), {
      createdAt: nowIso,
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "run-summary.json"), {
      completedAt: nowIso,
      featureCount: 120,
      runId: "running-run",
    });
    writeJson(join(runningRunDir, "active-run.json"), {
      isRunning: true,
      phase: "normalizing",
      reason: "manual",
      runId: "running-run",
      startedAt: nowIso,
      summary:
        "normalize written=90 processed=95 total=120 percent=75% lastObjectId=95 pageSize=500 skipped=5",
      updatedAt: nowIso,
    });
    writeJson(join(runningRunDir, "normalize-progress.json"), {
      geometryBatchSize: 12,
      lastObjectId: 95,
      outputBytes: 4096,
      pageSize: 500,
      processedCount: 95,
      skippedCount: 5,
      skippedObjectIds: [91, 92, 93, 94, 95],
      updatedAt: nowIso,
      writtenCount: 90,
    });

    writeJson(join(completedRunDir, "run-config.json"), {
      createdAt: "2026-03-10T11:00:00Z",
      runId: "completed-run",
    });
    writeJson(join(completedRunDir, "run-summary.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      featureCount: 42,
      runId: "completed-run",
    });
    writeJson(join(completedRunDir, "publish-complete.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      phase: "publishing",
      runId: "completed-run",
      summary: "manifest-published",
    });
    writeJson(join(snapshotRoot, "latest.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      dataset: "environmental-flood",
      runDir: completedRunDir,
      runId: "completed-run",
    });

    const snapshot = await getFloodSyncStatusSnapshot();

    expect(snapshot.run.runId).toBe("running-run");
    expect(snapshot.run.phase).toBe("failed");
    expect(snapshot.run.isRunning).toBe(false);
    expect(snapshot.run.summary).toContain("normalize integrity error");
    expect(snapshot.latestRunId).toBe("completed-run");
  });

  it("ignores malformed per-run snapshot json files during status reads", async () => {
    const completedRunDir = join(snapshotRoot, "completed-run");
    mkdirSync(completedRunDir, { recursive: true });

    writeJson(join(completedRunDir, "run-config.json"), {
      createdAt: "2026-03-10T11:00:00Z",
      runId: "completed-run",
    });
    writeJson(join(completedRunDir, "run-summary.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      featureCount: 42,
      runId: "completed-run",
    });
    writeJson(join(completedRunDir, "publish-complete.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      phase: "publishing",
      runId: "completed-run",
      summary: "manifest-published",
    });
    writeJson(join(snapshotRoot, "latest.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      dataset: "environmental-flood",
      runDir: completedRunDir,
      runId: "completed-run",
    });
    writeFileSync(join(completedRunDir, "load-progress.json"), "{invalid", "utf8");

    const snapshot = await getFloodSyncStatusSnapshot();

    expect(snapshot.status).toBe("ok");
    expect(snapshot.run.runId).toBe("completed-run");
    expect(snapshot.latestRunId).toBe("completed-run");
  });

  it("degrades when flood copy progress queries fail", async () => {
    const completedRunDir = join(snapshotRoot, "completed-run");
    mkdirSync(completedRunDir, { recursive: true });

    runQueryMock.mockRejectedValueOnce(new Error("pg_stat_progress_copy unavailable"));

    writeJson(join(completedRunDir, "run-config.json"), {
      createdAt: "2026-03-10T11:00:00Z",
      runId: "completed-run",
    });
    writeJson(join(completedRunDir, "run-summary.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      featureCount: 42,
      runId: "completed-run",
    });
    writeJson(join(completedRunDir, "publish-complete.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      phase: "publishing",
      runId: "completed-run",
      summary: "manifest-published",
    });
    writeJson(join(snapshotRoot, "latest.json"), {
      completedAt: "2026-03-10T11:30:00Z",
      dataset: "environmental-flood",
      runDir: completedRunDir,
      runId: "completed-run",
    });

    const snapshot = await getFloodSyncStatusSnapshot();

    expect(snapshot.status).toBe("ok");
    expect(snapshot.run.runId).toBe("completed-run");
    expect(snapshot.run.phase).toBe("completed");
    expect(snapshot.latestRunId).toBe("completed-run");
  });
});
