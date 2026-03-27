import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { CountyScore } from "@map-migration/http-contracts/county-intelligence-http";

mock.restore();

const listCountyScoresMock = mock<(countyIds: readonly string[]) => Promise<readonly unknown[]>>();
const mapCountyScoreRowMock = mock<(row: unknown) => CountyScore>();
const getCountyScoresStatusSnapshotMock = mock<() => Promise<unknown>>();
const listCountyScoresCoverageFieldsMock = mock<() => Promise<readonly unknown[]>>();
const listCountyScoresCoverageByOperatorMock = mock<() => Promise<readonly unknown[]>>();
const listCountyScoresResolutionBySourceMock = mock<() => Promise<readonly unknown[]>>();
const getCountyCatchmentConfidenceTraceMock = mock<() => Promise<unknown>>();
const getCountyConfidenceTraceMock = mock<() => Promise<unknown>>();
const listCountyCatchmentDebugMock =
  mock<(countyIds: readonly string[]) => Promise<readonly unknown[]>>();
const listCountyOperatorZoneDebugMock =
  mock<(countyIds: readonly string[]) => Promise<readonly unknown[]>>();
const listCountyQueueResolutionDebugMock =
  mock<(countyIds: readonly string[]) => Promise<readonly unknown[]>>();
const listCountyQueuePoiReferenceDebugMock =
  mock<(countyIds: readonly string[]) => Promise<readonly unknown[]>>();
const listCountyCongestionDebugMock =
  mock<(countyIds: readonly string[]) => Promise<readonly unknown[]>>();

mock.module("@/geo/county-intelligence/county-intelligence.repo", () => ({
  getCountyCatchmentConfidenceTrace: getCountyCatchmentConfidenceTraceMock,
  getCountyConfidenceTrace: getCountyConfidenceTraceMock,
  getCountyScoresStatusSnapshot: getCountyScoresStatusSnapshotMock,
  listCountyCatchmentDebug: listCountyCatchmentDebugMock,
  listCountyCongestionDebug: listCountyCongestionDebugMock,
  listCountyOperatorZoneDebug: listCountyOperatorZoneDebugMock,
  listCountyQueuePoiReferenceDebug: listCountyQueuePoiReferenceDebugMock,
  listCountyQueueResolutionDebug: listCountyQueueResolutionDebugMock,
  listCountyScores: listCountyScoresMock,
  listCountyScoresCoverageByOperator: listCountyScoresCoverageByOperatorMock,
  listCountyScoresCoverageFields: listCountyScoresCoverageFieldsMock,
  listCountyScoresResolutionBySource: listCountyScoresResolutionBySourceMock,
}));

mock.module("@/geo/county-intelligence/county-intelligence.mapper", () => ({
  mapCountyScoreRow: mapCountyScoreRowMock,
}));

const { queryCountyScores, queryCountyScoresDebug, queryCountyScoresStatus } = await import(
  "../../../src/geo/county-intelligence/county-intelligence.service.ts?county-service-test"
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
    registry_version: "registry-v1-20260326T160000Z",
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
    freshness_fresh_count: 3221,
    freshness_aging_count: 0,
    freshness_stale_count: 0,
    freshness_critical_count: 0,
    freshness_unknown_count: 0,
    suppression_none_count: 0,
    suppression_downgraded_count: 3221,
    suppression_review_required_count: 0,
    suppression_suppressed_count: 0,
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
    confidence: {
      evidenceConfidence: "high",
      methodConfidence: "unknown",
      coverageConfidence: "medium",
      freshnessState: "aging",
      suppressionState: "downgraded",
    },
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

describe("queryCountyScores", () => {
  beforeEach(() => {
    getCountyCatchmentConfidenceTraceMock.mockReset();
    getCountyConfidenceTraceMock.mockReset();
    getCountyScoresStatusSnapshotMock.mockReset();
    listCountyCatchmentDebugMock.mockReset();
    listCountyCongestionDebugMock.mockReset();
    listCountyOperatorZoneDebugMock.mockReset();
    listCountyQueuePoiReferenceDebugMock.mockReset();
    listCountyQueueResolutionDebugMock.mockReset();
    listCountyScoresMock.mockReset();
    mapCountyScoreRowMock.mockReset();
    getCountyCatchmentConfidenceTraceMock.mockResolvedValue(null);
    getCountyConfidenceTraceMock.mockResolvedValue(null);
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
    expect(result.value.rows[0]?.publicationRunId).toBe("county-market-pressure-20260307T000000Z");
    expect(result.value.missingCountyIds).toEqual(["01001"]);
    expect(result.value.deferredCountyIds).toEqual(["06085", "48113"]);
    expect(result.value.blockedCountyIds).toEqual([]);
  });

  it("hides suppressed county outputs from the primary API response", async () => {
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
    ]);
    mapCountyScoreRowMock
      .mockReturnValueOnce({
        ...createDeferredCountyRow("06085", "Santa Clara", "CA"),
        confidence: {
          ...createDeferredCountyRow("06085", "Santa Clara", "CA").confidence,
          suppressionState: "suppressed",
        },
      })
      .mockReturnValueOnce(createDeferredCountyRow("48113", "Dallas", "TX"));

    const result = await queryCountyScores({
      countyIds: ["06085", "48113"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful county score query");
    }

    expect(result.value.rows.map((row) => row.countyFips)).toEqual(["48113"]);
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

  it("returns county debug diagnostics with a populated confidence trace", async () => {
    listCountyScoresMock.mockResolvedValue([
      {
        county_fips: "06085",
        publication_run_id: "county-market-pressure-20260307T000000Z",
        has_county_reference: true,
        has_county_score: true,
      },
    ]);
    mapCountyScoreRowMock.mockReturnValue(createDeferredCountyRow("06085", "Santa Clara", "CA"));
    listCountyOperatorZoneDebugMock.mockResolvedValue([]);
    listCountyQueueResolutionDebugMock.mockResolvedValue([]);
    listCountyQueuePoiReferenceDebugMock.mockResolvedValue([]);
    listCountyCongestionDebugMock.mockResolvedValue([]);
    listCountyCatchmentDebugMock.mockResolvedValue([
      {
        county_fips: "06085",
        calibration_version: "county-catchment-spillover-v1",
        adjacency_source_id: "census-county-adjacency-2025",
        adjacency_source_version_id: "census-county-adjacency-2025-2025",
        neighbor_count: 6,
        shared_edge_neighbor_count: 4,
        point_touch_neighbor_count: 2,
        point_touch_reference_family: "competition-intensity",
        total_weight_mass: 4.1,
        point_touch_weight_share: 0.024_39,
      },
    ]);
    getCountyConfidenceTraceMock.mockResolvedValue({
      registry_version: "registry-v1-20260326T223000Z",
      downstream_object_type: "score",
      downstream_object_id: "county_market_pressure_primary",
      minimum_constitutive_confidence_cap: "high",
      minimum_truth_mode_cap: "full",
      worst_required_freshness_state: "aging",
      baseline_suppression_state: "downgraded",
      dependencies_json: [
        {
          sourceId: "eia-861",
          sourceName: "EIA 861",
          downstreamObjectType: "score",
          downstreamObjectId: "county_market_pressure_primary",
          roleInDownstream: "primary",
          requiredness: "required",
          precisionTier: "A",
          accessStatus: "accessible",
          stalenessState: "aging",
          effectiveFreshnessState: "aging",
          truthModeCap: "full",
          confidenceCap: "high",
          completenessObserved: 1,
          sourceAgeDays: 12,
          warnTriggered: true,
          degradeTriggered: false,
          suppressTriggered: false,
          missingTriggered: false,
        },
      ],
    });
    getCountyCatchmentConfidenceTraceMock.mockResolvedValue({
      registry_version: "registry-v1-20260326T223000Z",
      downstream_object_type: "score",
      downstream_object_id: "county_market_pressure_catchment",
      minimum_constitutive_confidence_cap: "high",
      minimum_truth_mode_cap: "full",
      worst_required_freshness_state: "aging",
      baseline_suppression_state: "downgraded",
      dependencies_json: [
        {
          sourceId: "census-county-adjacency-2025",
          sourceName: "Census County Adjacency 2025",
          downstreamObjectType: "score",
          downstreamObjectId: "county_market_pressure_catchment",
          roleInDownstream: "primary",
          requiredness: "required",
          precisionTier: "A",
          accessStatus: "accessible",
          stalenessState: "aging",
          effectiveFreshnessState: "aging",
          truthModeCap: "full",
          confidenceCap: "high",
          completenessObserved: 1,
          sourceAgeDays: 10,
          warnTriggered: true,
          degradeTriggered: false,
          suppressTriggered: false,
          missingTriggered: false,
        },
      ],
    });

    const result = await queryCountyScoresDebug({
      countyIds: ["06085"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful county score debug query");
    }

    expect(result.value.counties[0]?.confidenceTrace?.registryVersion).toBe(
      "registry-v1-20260326T223000Z"
    );
    expect(result.value.counties[0]?.catchment?.adjacencySourceId).toBe(
      "census-county-adjacency-2025"
    );
    expect(result.value.counties[0]?.confidenceTrace?.truthMode).toBe("full");
    expect(result.value.counties[0]?.confidenceTrace?.dependencies[0]?.warnTriggered).toBe(true);
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
    expect(result.value.featureCoverage.interconnectionQueue).toBe(false);
    expect(result.value.featureCoverage.wholesaleMarkets).toBe(false);
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
