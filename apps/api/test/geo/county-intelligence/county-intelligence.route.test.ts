import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type {
  CountyScoresCoverageResponse,
  CountyScoresDebugResponse,
  CountyScoresResolutionResponse,
} from "@map-migration/http-contracts/county-intelligence-debug-http";
import type {
  CountyScore,
  CountyScoresStatusResponse,
} from "@map-migration/http-contracts/county-intelligence-http";

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
          readonly value: Omit<CountyScoresStatusResponse, "meta">;
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
const queryCountyScoresCoverageMock =
  mock<
    () => Promise<
      | {
          readonly ok: true;
          readonly value: Omit<CountyScoresCoverageResponse, "meta">;
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
const queryCountyScoresResolutionMock =
  mock<
    () => Promise<
      | {
          readonly ok: true;
          readonly value: Omit<CountyScoresResolutionResponse, "meta">;
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
const queryCountyScoresDebugMock =
  mock<
    (args: { countyIds: readonly string[] }) => Promise<
      | {
          readonly ok: true;
          readonly value: Omit<CountyScoresDebugResponse, "meta">;
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
  queryCountyScoresCoverage: queryCountyScoresCoverageMock,
  queryCountyScoresDebug: queryCountyScoresDebugMock,
  queryCountyScores: queryCountyScoresMock,
  queryCountyScoresResolution: queryCountyScoresResolutionMock,
  queryCountyScoresStatus: queryCountyScoresStatusMock,
}));

const { createApiApp } = await import("@/app");

function requestLoopback(app: ReturnType<typeof createApiApp>, path: string): Promise<Response> {
  return app.request(new Request(`http://localhost${path}`));
}

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
    confidence: {
      evidenceConfidence: "high",
      methodConfidence: "unknown",
      coverageConfidence: "medium",
      freshnessState: "aging",
      suppressionState: "downgraded",
    },
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
    powerMarketContext: {
      balancingAuthority: null,
      loadZone: null,
      marketStructure: "unknown",
      meteoZone: null,
      operatorWeatherZone: null,
      operatorZoneConfidence: null,
      operatorZoneLabel: null,
      operatorZoneType: null,
      weatherZone: null,
      wholesaleOperator: null,
    },
    retailStructure: {
      competitiveAreaType: "unknown",
      primaryTduOrUtility: null,
      retailChoiceStatus: "unknown",
      utilityContext: {
        dominantUtilityId: null,
        dominantUtilityName: null,
        retailChoicePenetrationShare: null,
        territoryType: null,
        utilities: [],
        utilityCount: null,
      },
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
    transmissionMiles138kvPlus: null,
    transmissionMiles230kvPlus: null,
    transmissionMiles345kvPlus: null,
    transmissionMiles500kvPlus: null,
    transmissionMiles765kvPlus: null,
    transmissionContext: {
      miles138kvPlus: null,
      miles230kvPlus: null,
      miles345kvPlus: null,
      miles500kvPlus: null,
      miles69kvPlus: null,
      miles765kvPlus: null,
    },
    gasPipelinePresenceFlag: null,
    gasPipelineMileageCounty: null,
    fiberPresenceFlag: null,
    primaryMarketId: "silicon-valley",
    isBorderCounty: false,
    isSeamCounty: false,
    queueStorageMw: null,
    queueSolarMw: null,
    queueWindMw: null,
    queueAvgAgeDays: null,
    queueWithdrawalRate: null,
    recentOnlineMw: null,
    avgRtCongestionComponent: null,
    p95ShadowPrice: null,
    negativePriceHourShare: null,
    topConstraints: [],
    interconnectionQueue: {
      activeMw: null,
      avgAgeDays: null,
      medianDaysInQueueActive: null,
      projectCountActive: null,
      recentOnlineMw: null,
      solarMw: null,
      storageMw: null,
      windMw: null,
      withdrawalRate: null,
    },
    congestionContext: {
      avgRtCongestionComponent: null,
      congestionProxyScore: null,
      negativePriceHourShare: null,
      p95ShadowPrice: null,
      topConstraints: [],
    },
    sourceProvenance: {
      congestion: null,
      interconnectionQueue: null,
      operatingFootprints: null,
      retailStructure: null,
      transmission: null,
      utilityTerritories: null,
      wholesaleMarkets: null,
    },
    publicationRunId: "county-market-pressure-20260307T000000Z",
    formulaVersion: "county-market-pressure-v1",
    inputDataVersion: "inputs-v1",
  };
}

function createFeatureCoverage(
  overrides?: Partial<Omit<CountyScoresStatusResponse, "meta">["featureCoverage"]>
): Omit<CountyScoresStatusResponse, "meta">["featureCoverage"] {
  return {
    congestion: false,
    demand: false,
    gridFriction: false,
    history: false,
    infrastructure: false,
    interconnectionQueue: false,
    marketSeams: false,
    narratives: false,
    operatingFootprints: false,
    policy: false,
    retailStructure: false,
    supplyTimeline: false,
    transmission: false,
    utilityTerritories: false,
    wholesaleMarkets: false,
    ...overrides,
  };
}

describe("county scores route", () => {
  beforeEach(() => {
    queryCountyScoresCoverageMock.mockReset();
    queryCountyScoresDebugMock.mockReset();
    queryCountyScoresMock.mockReset();
    queryCountyScoresResolutionMock.mockReset();
    queryCountyScoresStatusMock.mockReset();
  });

  it("returns 400 when countyIds is missing", async () => {
    const app = createApiApp();

    const response = await requestLoopback(app, "/api/geo/counties/scores");
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("INVALID_COUNTY_IDS");
  });

  it("returns 400 when countyIds includes malformed ids", async () => {
    const app = createApiApp();

    const response = await requestLoopback(app, "/api/geo/counties/scores?countyIds=06085,abc");
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

    const response = await requestLoopback(app, "/api/geo/counties/scores?countyIds=06085,48113");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.rows).toHaveLength(1);
    expect(payload.summary.missingCountyIds).toEqual(["48113"]);
    expect(payload.summary.deferredCountyIds).toEqual(["06085"]);
    expect(payload.summary.blockedCountyIds).toEqual([]);
    expect(payload.meta.dataVersion).toBe("2026-03-07");
    expect(payload.meta.recordCount).toBe(1);
    expect(payload.rows[0].publicationRunId).toBe("county-market-pressure-20260307T000000Z");
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

    const response = await requestLoopback(app, "/api/geo/counties/scores?countyIds=06085");
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

    const response = await requestLoopback(app, "/api/geo/counties/scores?countyIds=06085");
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
        registryVersion: "registry-v1-20260326T160000Z",
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
        freshnessStateCounts: {
          fresh: 3221,
          aging: 0,
          stale: 0,
          critical: 0,
          unknown: 0,
        },
        suppressionStateCounts: {
          none: 0,
          downgraded: 3221,
          reviewRequired: 0,
          suppressed: 0,
        },
        availableFeatureFamilies: [
          "demand",
          "history",
          "infrastructure",
          "market_seams",
          "narratives",
        ],
        missingFeatureFamilies: ["grid_friction", "policy", "supply_timeline"],
        featureCoverage: createFeatureCoverage({
          demand: true,
          history: true,
          infrastructure: true,
          marketSeams: true,
          narratives: true,
        }),
        reproducibilityAvailable: true,
        replayabilityTier: "strict",
        configHash: "config-hash",
        envelopeHash: "envelope-hash",
        sourceVersionCount: 12,
        ingestionSnapshotCount: 3,
        replayedFromRunId: null,
      },
    });

    const response = await requestLoopback(app, "/api/geo/counties/scores/status");
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

  it("returns county field coverage diagnostics", async () => {
    const app = createApiApp();
    queryCountyScoresCoverageMock.mockResolvedValue({
      ok: true,
      value: {
        publicationRunId: "county-market-pressure-20260324T000000Z",
        dataVersion: "2026-03-24",
        rowCount: 3221,
        fields: [
          {
            fieldName: "operatorZoneLabel",
            populatedCount: 1719,
            totalCount: 3221,
          },
        ],
        byWholesaleOperator: [
          {
            avgRtCongestionComponentCount: 550,
            countyCount: 550,
            meteoZoneCount: 550,
            operatorWeatherZoneCount: 0,
            operatorZoneLabelCount: 503,
            p95ShadowPriceCount: 550,
            primaryTduOrUtilityCount: 550,
            wholesaleOperator: "PJM",
          },
        ],
      },
    });

    const response = await requestLoopback(app, "/api/geo/counties/scores/coverage");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.rowCount).toBe(3221);
    expect(payload.fields[0].fieldName).toBe("operatorZoneLabel");
    expect(payload.byWholesaleOperator[0].wholesaleOperator).toBe("PJM");
  });

  it("returns county queue resolution diagnostics with snapshot samples", async () => {
    const app = createApiApp();
    queryCountyScoresResolutionMock.mockResolvedValue({
      ok: true,
      value: {
        publicationRunId: "county-market-pressure-20260324T000000Z",
        dataVersion: "2026-03-24",
        effectiveDate: "2026-03-24",
        unresolvedProjectCount: 901,
        unresolvedSnapshotCount: 901,
        bySource: [
          {
            sourceSystem: "pjm_planning_queue",
            totalProjects: 9251,
            unresolvedProjects: 901,
            totalSnapshots: 8241,
            unresolvedSnapshots: 901,
            directResolutionCount: 300,
            derivedResolutionCount: 1200,
            manualResolutionCount: 12,
            lowConfidenceResolutionCount: 42,
            samplePoiLabels: ["MASON 500"],
            sampleLocationLabels: ["Project 123"],
            sampleSnapshotPoiLabels: ["MASON 500"],
            sampleSnapshotLocationLabels: ["Project 123"],
          },
        ],
      },
    });

    const response = await requestLoopback(app, "/api/geo/counties/scores/resolution");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.unresolvedProjectCount).toBe(901);
    expect(payload.bySource[0].sampleSnapshotPoiLabels).toEqual(["MASON 500"]);
  });

  it("returns county debug diagnostics", async () => {
    const app = createApiApp();
    queryCountyScoresDebugMock.mockResolvedValue({
      ok: true,
      value: {
        publicationRunId: "county-market-pressure-20260324T000000Z",
        dataVersion: "2026-03-24",
        counties: [
          {
            countyFips: "06085",
            congestionSnapshot: {
              avgRtCongestionComponent: 4.2,
              negativePriceHourShare: 0.01,
              p95ShadowPrice: 55.3,
              sourceAsOfDate: "2026-03-24",
            },
            operatorZones: [],
            queuePoiReferences: [],
            queueResolutions: [],
            score: createDeferredCountyRow(),
          },
        ],
      },
    });

    const response = await requestLoopback(app, "/api/geo/counties/scores/debug?countyIds=06085");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.counties).toHaveLength(1);
    expect(payload.counties[0].countyFips).toBe("06085");
  });

  it("returns unpublished meta version when county status has no publication", async () => {
    const app = createApiApp();
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: true,
      value: {
        datasetAvailable: false,
        publicationRunId: null,
        registryVersion: null,
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
        freshnessStateCounts: {
          fresh: 0,
          aging: 0,
          stale: 0,
          critical: 0,
          unknown: 0,
        },
        suppressionStateCounts: {
          none: 0,
          downgraded: 0,
          reviewRequired: 0,
          suppressed: 0,
        },
        availableFeatureFamilies: [],
        missingFeatureFamilies: [],
        featureCoverage: createFeatureCoverage(),
        reproducibilityAvailable: false,
        replayabilityTier: null,
        configHash: null,
        envelopeHash: null,
        sourceVersionCount: 0,
        ingestionSnapshotCount: 0,
        replayedFromRunId: null,
      },
    });

    const response = await requestLoopback(app, "/api/geo/counties/scores/status");
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

    const response = await requestLoopback(app, "/api/geo/counties/scores/status");
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe("COUNTY_SCORES_STATUS_SOURCE_UNAVAILABLE");
  });
});
