import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { CountyScore } from "@map-migration/http-contracts/county-intelligence-http";

mock.restore();

const listCountyScoresMock = mock<(countyIds: readonly string[]) => Promise<readonly unknown[]>>();
const mapCountyScoreRowMock = mock<(row: unknown) => CountyScore>();
const getCountyScoresStatusSnapshotMock = mock<() => Promise<unknown>>();

mock.module("@/geo/county-intelligence/county-intelligence.repo", () => ({
  getCountyScoresStatusSnapshot: getCountyScoresStatusSnapshotMock,
  listCountyScores: listCountyScoresMock,
}));

mock.module("@/geo/county-intelligence/county-intelligence.mapper", () => ({
  mapCountyScoreRow: mapCountyScoreRowMock,
}));

const { queryCountyScores, queryCountyScoresStatus } = await import(
  "@/geo/county-intelligence/county-intelligence.service"
);

afterAll(() => {
  mock.restore();
});

function createPublishedStatusRow() {
  return {
    publication_run_id: "county-market-pressure-20260307T000000Z",
    publication_status: "published",
    published_at: "2026-03-07T00:00:00.000Z",
    methodology_id: "county-market-pressure-v1",
    data_version: "2026-03-06",
    input_data_version: "dc_pipeline=2026-03-07",
    formula_version: "county-market-pressure-v1",
    row_count: 3221,
    source_county_count: 3221,
    ranked_county_count: 0,
    deferred_county_count: 3221,
    blocked_county_count: 0,
    high_confidence_count: 0,
    medium_confidence_count: 0,
    low_confidence_count: 3221,
    fresh_county_count: 3221,
    available_feature_families: [
      "demand",
      "history",
      "infrastructure",
      "market_seams",
      "narratives",
    ],
    missing_feature_families: ["grid_friction", "policy", "supply_timeline"],
  };
}

function createDeferredCountyRow(
  countyFips: string,
  countyName: string,
  stateAbbrev: string
): CountyScore {
  return {
    countyFips,
    countyName,
    stateAbbrev,
    rankStatus: "deferred",
    attractivenessTier: "deferred",
    confidenceBadge: "low",
    marketPressureIndex: null,
    demandPressureScore: countyFips === "06085" ? 82.4 : 70.1,
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
    expectedMw0To24m: countyFips === "06085" ? 180 : 120,
    expectedMw24To60m: countyFips === "06085" ? 70 : 60,
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

describe("queryCountyScores", () => {
  beforeEach(() => {
    getCountyScoresStatusSnapshotMock.mockReset();
    listCountyScoresMock.mockReset();
    mapCountyScoreRowMock.mockReset();
    getCountyScoresStatusSnapshotMock.mockResolvedValue(createPublishedStatusRow());
  });

  it("returns sorted mapped rows and county summary buckets", async () => {
    listCountyScoresMock.mockResolvedValue([
      {
        county_fips: "06085",
        publication_run_id: "county-market-pressure-20260307T000000Z",
        has_county_reference: true,
        has_county_score: true,
      },
      {
        county_fips: "48113",
        publication_run_id: "county-market-pressure-20260307T000000Z",
        has_county_reference: true,
        has_county_score: true,
      },
      {
        county_fips: "01001",
        publication_run_id: null,
        has_county_reference: false,
        has_county_score: false,
      },
    ]);
    mapCountyScoreRowMock
      .mockReturnValueOnce(createDeferredCountyRow("06085", "Santa Clara", "CA"))
      .mockReturnValueOnce(createDeferredCountyRow("48113", "Dallas", "TX"));

    const result = await queryCountyScores({
      countyIds: ["06085", "48113", "06085", "01001"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful county score query");
    }

    expect(result.value.dataVersion).toBe("2026-03-06");
    expect(result.value.requestedCountyIds).toEqual(["06085", "48113", "01001"]);
    expect(result.value.rows.map((row) => row.countyFips)).toEqual(["06085", "48113"]);
    expect(result.value.missingCountyIds).toEqual(["01001"]);
    expect(result.value.deferredCountyIds).toEqual(["06085", "48113"]);
    expect(result.value.blockedCountyIds).toEqual([]);
  });

  it("returns query_failed when the repository rejects", async () => {
    listCountyScoresMock.mockRejectedValue(new Error("db down"));

    const result = await queryCountyScores({
      countyIds: ["06085"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected failed county score query");
    }

    expect(result.value.reason).toBe("query_failed");
  });

  it("returns source_unavailable when the dataset relation is missing", async () => {
    listCountyScoresMock.mockRejectedValue(
      new Error('relation "analytics.county_market_pressure_current" does not exist')
    );

    const result = await queryCountyScores({
      countyIds: ["06085"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected unavailable county score dataset");
    }

    expect(result.value.reason).toBe("source_unavailable");
  });

  it("returns mapping_failed when the mapper throws", async () => {
    listCountyScoresMock.mockResolvedValue([
      {
        county_fips: "06085",
        publication_run_id: "county-market-pressure-20260307T000000Z",
        has_county_reference: true,
        has_county_score: true,
      },
    ]);
    mapCountyScoreRowMock.mockImplementation(() => {
      throw new Error("invalid row");
    });

    const result = await queryCountyScores({
      countyIds: ["06085"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected failed county score mapping");
    }

    expect(result.value.reason).toBe("mapping_failed");
  });

  it("returns source_unavailable when no published county intelligence exists", async () => {
    getCountyScoresStatusSnapshotMock.mockResolvedValue({
      publication_run_id: null,
      publication_status: null,
      published_at: null,
      methodology_id: null,
      data_version: null,
      input_data_version: null,
      formula_version: null,
      row_count: 0,
      source_county_count: 3221,
      ranked_county_count: 0,
      deferred_county_count: 0,
      blocked_county_count: 0,
      high_confidence_count: 0,
      medium_confidence_count: 0,
      low_confidence_count: 0,
      fresh_county_count: 0,
      available_feature_families: [],
      missing_feature_families: [],
    });
    listCountyScoresMock.mockResolvedValue([
      {
        county_fips: "06085",
        publication_run_id: "county-market-pressure-20260307T000000Z",
        has_county_reference: true,
        has_county_score: true,
      },
    ]);

    const result = await queryCountyScores({
      countyIds: ["06085"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected unavailable county intelligence publication");
    }

    expect(result.value.reason).toBe("source_unavailable");
  });

  it("returns county score dataset status when publication metadata exists", async () => {
    getCountyScoresStatusSnapshotMock.mockResolvedValue(createPublishedStatusRow());

    const result = await queryCountyScoresStatus();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful county score status query");
    }

    expect(result.value.datasetAvailable).toBe(true);
    expect(result.value.publicationRunId).toBe("county-market-pressure-20260307T000000Z");
    expect(result.value.methodologyId).toBe("county-market-pressure-v1");
    expect(result.value.rowCount).toBe(3221);
    expect(result.value.availableFeatureFamilies).toEqual([
      "demand",
      "history",
      "infrastructure",
      "market_seams",
      "narratives",
    ]);
    expect(result.value.featureCoverage.demand).toBe(true);
    expect(result.value.featureCoverage.gridFriction).toBe(false);
    expect(result.value.missingFeatureFamilies).toEqual([
      "grid_friction",
      "policy",
      "supply_timeline",
    ]);
  });

  it("returns source_unavailable when county score status relations are missing", async () => {
    getCountyScoresStatusSnapshotMock.mockRejectedValue(
      new Error('relation "analytics.fact_publication" does not exist')
    );

    const result = await queryCountyScoresStatus();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected unavailable county score status dataset");
    }

    expect(result.value.reason).toBe("source_unavailable");
  });
});
