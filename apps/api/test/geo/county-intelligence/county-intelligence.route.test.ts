import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { CountyScore } from "@map-migration/http-contracts";

const queryCountyScoresMock =
  mock<
    (args: { countyIds: readonly string[] }) => Promise<
      | {
          readonly ok: true;
          readonly value: {
            readonly blockedCountyIds: readonly string[];
            readonly dataVersion: string;
            readonly deferredCountyIds: readonly string[];
            readonly rows: readonly CountyScore[];
            readonly missingCountyIds: readonly string[];
            readonly requestedCountyIds: readonly string[];
          };
        }
      | {
          readonly ok: false;
          readonly value:
            | {
                readonly reason: "source_unavailable";
                readonly error: unknown;
              }
            | {
                readonly reason: "query_failed";
                readonly error: unknown;
              }
            | {
                readonly reason: "mapping_failed";
                readonly error: unknown;
              };
        }
    >
  >();
const queryCountyScoresStatusMock =
  mock<
    () => Promise<
      | {
          readonly ok: true;
          readonly value: {
            readonly datasetAvailable: boolean;
            readonly publicationRunId: string | null;
            readonly publishedAt: string | null;
            readonly methodologyId: string | null;
            readonly dataVersion: string | null;
            readonly inputDataVersion: string | null;
            readonly formulaVersion: string | null;
            readonly rowCount: number;
            readonly sourceCountyCount: number;
            readonly rankedCountyCount: number;
            readonly deferredCountyCount: number;
            readonly blockedCountyCount: number;
            readonly highConfidenceCount: number;
            readonly mediumConfidenceCount: number;
            readonly lowConfidenceCount: number;
            readonly freshCountyCount: number;
            readonly availableFeatureFamilies: readonly string[];
            readonly missingFeatureFamilies: readonly string[];
            readonly featureCoverage: {
              readonly demand: boolean;
              readonly gridFriction: boolean;
              readonly history: boolean;
              readonly infrastructure: boolean;
              readonly marketSeams: boolean;
              readonly narratives: boolean;
              readonly policy: boolean;
              readonly supplyTimeline: boolean;
            };
          };
        }
      | {
          readonly ok: false;
          readonly value:
            | {
                readonly reason: "source_unavailable";
                readonly error: unknown;
              }
            | {
                readonly reason: "query_failed";
                readonly error: unknown;
              }
            | {
                readonly reason: "mapping_failed";
                readonly error: unknown;
              };
        }
    >
  >();

mock.module("../../../src/geo/county-intelligence/county-intelligence.service", () => ({
  queryCountyScores: queryCountyScoresMock,
  queryCountyScoresStatus: queryCountyScoresStatusMock,
}));

const { createApiApp } = await import("@/app");

afterAll(() => {
  mock.restore();
});

function createDeferredCountyRow(): CountyScore {
  return {
    countyFips: "06085",
    countyName: "Santa Clara",
    stateAbbrev: "CA",
    rankStatus: "deferred",
    attractivenessTier: "deferred",
    confidenceBadge: "low",
    marketPressureIndex: null,
    demandPressureScore: 82.4,
    supplyTimelineScore: null,
    gridFrictionScore: null,
    policyConstraintScore: null,
    freshnessScore: 91,
    lastUpdatedAt: "2026-03-07T00:00:00.000Z",
    sourceVolatility: "high",
    narrativeSummary: "Demand pressure is visible, but queue and policy baselines are missing.",
    topDrivers: [],
    deferredReasonCodes: ["MISSING_QUEUE_BASELINE", "MISSING_POLICY_BASELINE"],
    whatChanged30d: [],
    whatChanged60d: [],
    whatChanged90d: [],
    pillarValueStates: {
      demand: "observed",
      gridFriction: "unknown",
      infrastructure: "derived",
      policy: "unknown",
      supplyTimeline: "unknown",
    },
    expectedMw0To24m: 180,
    expectedMw24To60m: 70,
    recentCommissionedMw24m: 45,
    demandMomentumQoq: 0.32,
    providerEntryCount12m: 1,
    expectedSupplyMw0To36m: null,
    expectedSupplyMw36To60m: null,
    signedIaMw: null,
    queueMwActive: null,
    queueProjectCountActive: null,
    medianDaysInQueueActive: null,
    pastDueShare: null,
    marketWithdrawalPrior: null,
    congestionProxyScore: null,
    plannedUpgradeCount: null,
    heatmapSignalFlag: null,
    policyMomentumScore: null,
    moratoriumStatus: "unknown",
    publicSentimentScore: null,
    policyEventCount: null,
    countyTaggedEventShare: null,
    policyMappingConfidence: null,
    transmissionMiles69kvPlus: null,
    transmissionMiles230kvPlus: null,
    gasPipelinePresenceFlag: null,
    gasPipelineMileageCounty: null,
    fiberPresenceFlag: null,
    primaryMarketId: "silicon-valley",
    isSeamCounty: false,
    formulaVersion: "county-market-pressure-v1",
    inputDataVersion: "inputs-v1",
  };
}

describe("county scores route", () => {
  beforeEach(() => {
    queryCountyScoresMock.mockReset();
    queryCountyScoresStatusMock.mockReset();
  });

  it("returns 400 when countyIds is missing", async () => {
    const app = createApiApp();

    const response = await app.request("/api/geo/counties/scores");
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("INVALID_COUNTY_IDS");
  });

  it("returns 400 when countyIds includes malformed ids", async () => {
    const app = createApiApp();

    const response = await app.request("/api/geo/counties/scores?countyIds=06085,abc");
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("INVALID_COUNTY_IDS");
  });

  it("returns county scores with missing county ids summary", async () => {
    const app = createApiApp();
    queryCountyScoresMock.mockResolvedValue({
      ok: true,
      value: {
        blockedCountyIds: [],
        dataVersion: "2026-03-07",
        deferredCountyIds: ["06085"],
        rows: [createDeferredCountyRow()],
        missingCountyIds: ["48113"],
        requestedCountyIds: ["06085", "48113"],
      },
    });

    const response = await app.request("/api/geo/counties/scores?countyIds=06085,48113");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.rows).toHaveLength(1);
    expect(payload.summary.missingCountyIds).toEqual(["48113"]);
    expect(payload.summary.deferredCountyIds).toEqual(["06085"]);
    expect(payload.summary.blockedCountyIds).toEqual([]);
    expect(payload.meta.dataVersion).toBe("2026-03-07");
    expect(payload.meta.recordCount).toBe(1);
  });

  it("returns 503 when the county score dataset is unavailable", async () => {
    const app = createApiApp();
    queryCountyScoresMock.mockResolvedValue({
      ok: false,
      value: {
        reason: "source_unavailable",
        error: new Error('relation "analytics.county_market_pressure_current" does not exist'),
      },
    });

    const response = await app.request("/api/geo/counties/scores?countyIds=06085");
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe("COUNTY_SCORES_SOURCE_UNAVAILABLE");
  });

  it("returns 503 when the county score query fails", async () => {
    const app = createApiApp();
    queryCountyScoresMock.mockResolvedValue({
      ok: false,
      value: {
        reason: "query_failed",
        error: new Error("db down"),
      },
    });

    const response = await app.request("/api/geo/counties/scores?countyIds=06085");
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe("COUNTY_SCORES_QUERY_FAILED");
  });

  it("returns county score dataset status", async () => {
    const app = createApiApp();
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: true,
      value: {
        datasetAvailable: true,
        publicationRunId: "county-market-pressure-20260307T000000Z",
        publishedAt: "2026-03-07T00:00:00.000Z",
        methodologyId: "county-market-pressure-v1",
        dataVersion: "2026-03-07",
        inputDataVersion: "dc_pipeline=2026-03-07",
        formulaVersion: "county-market-pressure-v1",
        rowCount: 3221,
        sourceCountyCount: 3221,
        rankedCountyCount: 0,
        deferredCountyCount: 3221,
        blockedCountyCount: 0,
        highConfidenceCount: 0,
        mediumConfidenceCount: 0,
        lowConfidenceCount: 3221,
        freshCountyCount: 3221,
        availableFeatureFamilies: [
          "demand",
          "history",
          "infrastructure",
          "market_seams",
          "narratives",
        ],
        missingFeatureFamilies: ["grid_friction", "policy", "supply_timeline"],
        featureCoverage: {
          demand: true,
          gridFriction: false,
          history: true,
          infrastructure: true,
          marketSeams: true,
          narratives: true,
          policy: false,
          supplyTimeline: false,
        },
      },
    });

    const response = await app.request("/api/geo/counties/scores/status");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.datasetAvailable).toBe(true);
    expect(payload.meta.dataVersion).toBe("2026-03-07");
    expect(payload.rowCount).toBe(3221);
    expect(payload.availableFeatureFamilies).toEqual([
      "demand",
      "history",
      "infrastructure",
      "market_seams",
      "narratives",
    ]);
    expect(payload.featureCoverage.demand).toBe(true);
  });

  it("returns unpublished meta version when county status has no publication", async () => {
    const app = createApiApp();
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: true,
      value: {
        datasetAvailable: false,
        publicationRunId: null,
        publishedAt: null,
        methodologyId: null,
        dataVersion: null,
        inputDataVersion: null,
        formulaVersion: null,
        rowCount: 0,
        sourceCountyCount: 3221,
        rankedCountyCount: 0,
        deferredCountyCount: 0,
        blockedCountyCount: 0,
        highConfidenceCount: 0,
        mediumConfidenceCount: 0,
        lowConfidenceCount: 0,
        freshCountyCount: 0,
        availableFeatureFamilies: [],
        missingFeatureFamilies: [],
        featureCoverage: {
          demand: false,
          gridFriction: false,
          history: false,
          infrastructure: false,
          marketSeams: false,
          narratives: false,
          policy: false,
          supplyTimeline: false,
        },
      },
    });

    const response = await app.request("/api/geo/counties/scores/status");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.meta.dataVersion).toBe("unpublished");
    expect(payload.datasetAvailable).toBe(false);
  });

  it("returns 503 when county score status is unavailable", async () => {
    const app = createApiApp();
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: false,
      value: {
        reason: "source_unavailable",
        error: new Error('relation "analytics.fact_publication" does not exist'),
      },
    });

    const response = await app.request("/api/geo/counties/scores/status");
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe("COUNTY_SCORES_STATUS_SOURCE_UNAVAILABLE");
  });
});
