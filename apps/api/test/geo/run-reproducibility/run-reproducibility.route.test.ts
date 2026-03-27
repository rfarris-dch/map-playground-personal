import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type {
  RunReproducibilityDiffResponse,
  RunReproducibilityResponse,
} from "@map-migration/http-contracts/run-reproducibility-http";

const queryRunReproducibilityMock =
  mock<
    (args: {
      readonly runId: string;
      readonly runKind: "analysis" | "publication" | "replay";
      readonly surfaceScope: "corridor" | "county" | "parcel";
    }) => Promise<Omit<RunReproducibilityResponse, "meta"> | null>
  >();
const queryRunReproducibilityDiffMock =
  mock<
    (args: {
      readonly leftRunId: string;
      readonly rightRunId: string;
      readonly runKind: "analysis" | "publication" | "replay";
      readonly surfaceScope: "corridor" | "county" | "parcel";
    }) => Promise<Omit<RunReproducibilityDiffResponse, "meta"> | null>
  >();

mock.module("../../../src/geo/run-reproducibility/run-reproducibility.service", () => ({
  queryRunReproducibility: queryRunReproducibilityMock,
  queryRunReproducibilityDiff: queryRunReproducibilityDiffMock,
}));

const { createApiApp } = await import("@/app");

function requestLoopback(app: ReturnType<typeof createApiApp>, path: string): Promise<Response> {
  return app.request(new Request(`http://localhost${path}`));
}

function createSummary(runId: string, runKind: "analysis" | "publication" | "replay") {
  return {
    configHash: "config-hash",
    dataVersion: "2026-03-26",
    effectiveDate: "2026-03-26",
    envelopeHash: "envelope-hash",
    envelopeVersion: "run-envelope-v1",
    formulaVersion: "county-scores-alpha-v1",
    ingestionSnapshotCount: 3,
    inputStateHash: "input-state-hash",
    methodologyId: "county-intelligence-alpha-v1",
    modelVersion: "county-scores-alpha-v1",
    outputHash: "output-hash",
    registryVersion: "registry-v1-20260326T233000Z",
    replayabilityTier: "strict" as const,
    replayedFromRunId: runKind === "replay" ? "county-run-001" : null,
    runId,
    runKind,
    runRecordedAt: "2026-03-27T00:52:03.884Z",
    sourceVersionCount: 28,
    status: runKind === "replay" ? ("replayed" as const) : ("completed" as const),
    surfaceScope: "county" as const,
  };
}

function createEnvelope(runId: string, runKind: "analysis" | "publication" | "replay") {
  const summary = createSummary(runId, runKind);
  return {
    artifactRefsJson: [
      {
        artifactKind: "run-envelope",
        fileHash: "artifact-hash",
        filePath: "/tmp/run-envelope.json",
        relativePath: "var/run-reproducibility/county/run-envelope.json",
      },
    ],
    codeHash: "code-hash",
    codeRefsJson: [
      {
        fileHash: "code-ref-hash",
        filePath: "/Users/robertfarris/map/scripts/refresh-county-scores.ts",
        relativePath: "scripts/refresh-county-scores.ts",
      },
    ],
    configHash: summary.configHash,
    configJson: {
      dataVersion: summary.dataVersion,
      surfaceScope: "county",
    },
    createdAt: "2026-03-27T00:52:03.884Z",
    dataVersion: summary.dataVersion,
    downstreamObjectsJson: ["score/county_market_pressure_primary"],
    effectiveDate: summary.effectiveDate,
    envelopeHash: summary.envelopeHash,
    envelopeVersion: summary.envelopeVersion,
    formulaVersion: summary.formulaVersion,
    ingestionSnapshotIdsJson: ["20260326T203709Z", runId, "county-replay-pack"],
    inputStateHash: summary.inputStateHash,
    methodologyId: summary.methodologyId,
    modelVersion: summary.modelVersion,
    month: "2026-03-01",
    notesJson: {
      countyPowerRunId: "20260326T203709Z",
    },
    outputCountsJson: {
      score_snapshot_count: 3221,
    },
    outputHash: summary.outputHash,
    outputTablesJson: ["analytics.fact_market_analysis_score_snapshot"],
    registryVersion: summary.registryVersion,
    replayabilityTier: summary.replayabilityTier,
    replayedFromRunId: summary.replayedFromRunId,
    runId,
    runKind,
    runRecordedAt: summary.runRecordedAt,
    sourceVersionIdsJson: ["internal-facility-site:v1", "internal-hyperscale-site:v1"],
    status: summary.status,
    surfaceScope: "county",
    updatedAt: "2026-03-27T00:52:03.884Z",
  };
}

describe("run reproducibility route", () => {
  beforeEach(() => {
    queryRunReproducibilityMock.mockReset();
    queryRunReproducibilityDiffMock.mockReset();
  });

  afterAll(() => {
    mock.restore();
  });

  it("returns a run reproducibility envelope", async () => {
    const app = createApiApp();
    queryRunReproducibilityMock.mockResolvedValue({
      envelope: createEnvelope("county-run-001", "publication"),
      inputSnapshots: [
        {
          dataVersion: "2026-03-26",
          detailsJson: {
            tableCount: 4,
          },
          effectiveDate: "2026-03-26",
          manifestHash: "manifest-hash",
          manifestPath: "/tmp/replay-pack-manifest.json",
          replayMode: "strict_input",
          snapshotId: "county-replay-pack",
          snapshotKind: "boundary_replay_pack",
          sourceId: null,
          sourceVersionId: null,
          storageUri: "var/run-reproducibility/county/run/replay-pack",
        },
      ],
      sourceSnapshots: [
        {
          accessStatus: "accessible",
          completenessObserved: 1,
          detailsJson: {},
          freshnessAsOf: "2026-03-26T00:00:00.000Z",
          geographicCoverageObserved: 1,
          ingestionHealth: "healthy",
          lastSuccessfulIngestAt: "2026-03-26T00:00:00.000Z",
          latestProviderUpdateSeenAt: "2026-03-26T00:00:00.000Z",
          licenseExpirationDate: null,
          providerVersionLabel: "v1",
          recordCount: 3221,
          runtimeAlertState: "none",
          runtimeStateHash: "runtime-state-hash",
          sourceAsOfDate: "2026-03-26",
          sourceId: "census-county-adjacency-2025",
          sourceVersionId: "census-county-adjacency-2025:v1",
          stalenessState: "fresh",
        },
      ],
      summary: createSummary("county-run-001", "publication"),
    });

    const response = await requestLoopback(
      app,
      "/api/geo/run-reproducibility?surfaceScope=county&runKind=publication&runId=county-run-001"
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.summary.runId).toBe("county-run-001");
    expect(payload.summary.replayabilityTier).toBe("strict");
    expect(payload.sourceSnapshots).toHaveLength(1);
    expect(payload.meta.recordCount).toBe(1);
  });

  it("returns a run reproducibility diff", async () => {
    const app = createApiApp();
    queryRunReproducibilityDiffMock.mockResolvedValue({
      inputSnapshotDiffs: [
        {
          changeType: "changed",
          details: [
            {
              field: "manifestHash",
              leftValue: "left-manifest",
              rightValue: "right-manifest",
            },
          ],
          snapshotId: "county-replay-pack",
          snapshotKind: "boundary_replay_pack",
        },
      ],
      left: createSummary("county-run-001", "publication"),
      right: createSummary("county-run-002", "publication"),
      sourceSnapshotDiffs: [
        {
          changeType: "changed",
          details: [
            {
              field: "sourceVersionId",
              leftValue: "source-a:v1",
              rightValue: "source-a:v2",
            },
          ],
          sourceId: "source-a",
        },
      ],
      topLevelDiffs: [
        {
          field: "configHash",
          leftValue: "config-a",
          rightValue: "config-b",
        },
      ],
    });

    const response = await requestLoopback(
      app,
      "/api/geo/run-reproducibility/diff?surfaceScope=county&runKind=publication&leftRunId=county-run-001&rightRunId=county-run-002"
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.left.runId).toBe("county-run-001");
    expect(payload.right.runId).toBe("county-run-002");
    expect(payload.topLevelDiffs).toHaveLength(1);
    expect(payload.sourceSnapshotDiffs).toHaveLength(1);
    expect(payload.inputSnapshotDiffs).toHaveLength(1);
  });
});
