import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { CountyScore } from "@map-migration/http-contracts/county-intelligence-http";
import type { CountyPowerStoryRow } from "@map-migration/http-contracts/county-power-story-http";

mock.restore();

const queryCountyScoresStatusMock =
  mock<
    () => Promise<
      | {
          readonly ok: true;
          readonly value: {
            readonly dataVersion: string | null;
            readonly formulaVersion: string | null;
            readonly inputDataVersion: string | null;
            readonly publicationRunId: string | null;
            readonly publishedAt: string | null;
          };
        }
      | {
          readonly ok: false;
          readonly value: {
            readonly error: unknown;
            readonly reason: "mapping_failed" | "query_failed" | "source_unavailable";
          };
        }
    >
  >();
const getCountyPowerStoryPublicationMock =
  mock<
    (publicationRunId: string) => Promise<{
      readonly data_version: string | null | undefined;
      readonly formula_version: string | null | undefined;
      readonly input_data_version: string | null | undefined;
      readonly publication_run_id: string | null | undefined;
      readonly published_at: Date | string | null | undefined;
    } | null>
  >();
const listCountyPowerStorySnapshotRowsByPublicationMock =
  mock<(publicationRunId: string) => Promise<readonly unknown[]>>();
const getCountyPowerStoryVectorTileMock =
  mock<
    (args: { readonly x: number; readonly y: number; readonly z: number }) => Promise<Uint8Array>
  >();
const listCountyPowerStoryGeometryMock = mock<() => Promise<readonly unknown[]>>();
const mapCountyPowerStorySourceRowMock = mock<(row: unknown) => CountyScore>();
const mapCountyPowerStoryRowMock =
  mock<
    (args: {
      readonly computed: {
        readonly activityScore: number;
        readonly band: CountyPowerStoryRow["band"];
        readonly categoryKey: string | null;
        readonly direction: CountyPowerStoryRow["direction"];
        readonly normalizedScore: number;
        readonly outlineIntensity: number;
        readonly pulseAmplitude: number;
        readonly seed: number;
      };
      readonly score: CountyScore;
    }) => CountyPowerStoryRow
  >();
const mapCountyPowerStoryGeometryRowMock = mock<(row: unknown) => unknown>();
const mapCountyPowerStoryTimelineFrameRowMock =
  mock<
    (row: CountyPowerStoryRow) => {
      readonly activityScore: number;
      readonly band: CountyPowerStoryRow["band"];
      readonly categoryKey: string | null;
      readonly countyFips: string;
      readonly direction: CountyPowerStoryRow["direction"];
      readonly normalizedScore: number;
      readonly outlineIntensity: number;
      readonly pulseAmplitude: number;
      readonly seed: number;
    }
  >();

mock.module("../../../src/geo/county-intelligence/county-intelligence.service", () => ({
  queryCountyScoresStatus: queryCountyScoresStatusMock,
}));

mock.module("../../../src/geo/county-power-story/county-power-story.repo", () => ({
  getCountyPowerStoryPublication: getCountyPowerStoryPublicationMock,
  getCountyPowerStoryVectorTile: getCountyPowerStoryVectorTileMock,
  listCountyPowerStoryGeometry: listCountyPowerStoryGeometryMock,
  listCountyPowerStorySnapshotRowsByPublication: listCountyPowerStorySnapshotRowsByPublicationMock,
}));

mock.module("../../../src/geo/county-power-story/county-power-story.mapper", () => ({
  mapCountyPowerStoryGeometryRow: mapCountyPowerStoryGeometryRowMock,
  mapCountyPowerStoryRow: mapCountyPowerStoryRowMock,
  mapCountyPowerStorySourceRow: mapCountyPowerStorySourceRowMock,
  mapCountyPowerStoryTimelineFrameRow: mapCountyPowerStoryTimelineFrameRowMock,
}));

const { queryCountyPowerStorySnapshot, queryCountyPowerStoryVectorTile } = await import(
  "../../../src/geo/county-power-story/county-power-story.service.ts?county-power-story-service-test"
);

function createCountyScore(): CountyScore {
  return {
    countyFips: "48453",
    countyName: "Travis County",
    stateAbbrev: "TX",
    rankStatus: "ranked",
    attractivenessTier: "platinum-plus",
    confidenceBadge: "high",
    marketPressureIndex: 94.2,
    demandPressureScore: 88.1,
    supplyTimelineScore: 76.4,
    gridFrictionScore: 70.5,
    policyConstraintScore: 48.3,
    freshnessScore: 91.6,
    lastUpdatedAt: "2026-03-23T22:45:00.000Z",
    sourceVolatility: "medium",
    narrativeSummary: "Demand and queue activity remain elevated.",
    topDrivers: [],
    deferredReasonCodes: [],
    whatChanged30d: [],
    whatChanged60d: [],
    whatChanged90d: [],
    pillarValueStates: {
      demand: "observed",
      gridFriction: "observed",
      infrastructure: "derived",
      policy: "observed",
      supplyTimeline: "derived",
    },
    powerMarketContext: {
      balancingAuthority: "ERCOT",
      loadZone: "AUSTIN",
      marketStructure: "organized_market",
      meteoZone: null,
      operatorWeatherZone: null,
      operatorZoneConfidence: null,
      operatorZoneLabel: null,
      operatorZoneType: null,
      weatherZone: null,
      wholesaleOperator: "ERCOT",
    },
    retailStructure: {
      competitiveAreaType: "competitive",
      primaryTduOrUtility: "Oncor",
      retailChoiceStatus: "choice",
      utilityContext: {
        dominantUtilityId: null,
        dominantUtilityName: null,
        retailChoicePenetrationShare: null,
        territoryType: null,
        utilities: [],
        utilityCount: null,
      },
    },
    expectedMw0To24m: 120,
    expectedMw24To60m: 80,
    recentCommissionedMw24m: 42,
    demandMomentumQoq: 0.31,
    providerEntryCount12m: 2,
    expectedSupplyMw0To36m: 65,
    expectedSupplyMw36To60m: 40,
    signedIaMw: 28,
    queueMwActive: 480,
    queueProjectCountActive: 11,
    medianDaysInQueueActive: 550,
    pastDueShare: 0.14,
    marketWithdrawalPrior: 0.08,
    congestionProxyScore: 44.5,
    plannedUpgradeCount: 3,
    heatmapSignalFlag: true,
    policyMomentumScore: 12.5,
    moratoriumStatus: "watch",
    publicSentimentScore: 0.24,
    policyEventCount: 4,
    countyTaggedEventShare: 0.3,
    policyMappingConfidence: "high",
    transmissionMiles69kvPlus: 14,
    transmissionMiles138kvPlus: 22,
    transmissionMiles230kvPlus: 33,
    transmissionMiles345kvPlus: 18,
    transmissionMiles500kvPlus: 0,
    transmissionMiles765kvPlus: 0,
    transmissionContext: {
      miles138kvPlus: 22,
      miles230kvPlus: 33,
      miles345kvPlus: 18,
      miles500kvPlus: 0,
      miles69kvPlus: 14,
      miles765kvPlus: 0,
    },
    gasPipelinePresenceFlag: true,
    gasPipelineMileageCounty: 19,
    fiberPresenceFlag: true,
    primaryMarketId: "austin",
    isBorderCounty: false,
    isSeamCounty: false,
    queueStorageMw: 180,
    queueSolarMw: 240,
    queueWindMw: 60,
    queueAvgAgeDays: 550,
    queueWithdrawalRate: 0.11,
    recentOnlineMw: 55,
    avgRtCongestionComponent: 4.8,
    p95ShadowPrice: 29.4,
    negativePriceHourShare: 0.06,
    topConstraints: [],
    interconnectionQueue: {
      activeMw: 480,
      avgAgeDays: 550,
      medianDaysInQueueActive: 550,
      projectCountActive: 11,
      recentOnlineMw: 55,
      solarMw: 240,
      storageMw: 180,
      windMw: 60,
      withdrawalRate: 0.11,
    },
    congestionContext: {
      avgRtCongestionComponent: 4.8,
      congestionProxyScore: 44.5,
      negativePriceHourShare: 0.06,
      p95ShadowPrice: 29.4,
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
    publicationRunId: "county-power-run-1",
    formulaVersion: "county-market-pressure-v2",
    inputDataVersion: "county-market-pressure-public-us-20260323t224500z",
  };
}

describe("county power story service", () => {
  beforeEach(() => {
    queryCountyScoresStatusMock.mockReset();
    getCountyPowerStoryPublicationMock.mockReset();
    listCountyPowerStorySnapshotRowsByPublicationMock.mockReset();
    getCountyPowerStoryVectorTileMock.mockReset();
    listCountyPowerStoryGeometryMock.mockReset();
    mapCountyPowerStorySourceRowMock.mockReset();
    mapCountyPowerStoryRowMock.mockReset();
    mapCountyPowerStoryGeometryRowMock.mockReset();
    mapCountyPowerStoryTimelineFrameRowMock.mockReset();

    queryCountyScoresStatusMock.mockResolvedValue({
      ok: true,
      value: {
        dataVersion: "2026-03-23",
        formulaVersion: "county-market-pressure-v2",
        inputDataVersion: "county-market-pressure-public-us-20260323t224500z",
        publicationRunId: "county-power-run-current",
        publishedAt: "2026-03-23T22:45:00.000Z",
      },
    });
    getCountyPowerStoryPublicationMock.mockResolvedValue({
      data_version: "2026-03-20",
      formula_version: "county-market-pressure-v2",
      input_data_version: "county-market-pressure-public-us-20260320t224500z",
      publication_run_id: "county-power-run-1",
      published_at: "2026-03-20T22:45:00.000Z",
    });
    listCountyPowerStorySnapshotRowsByPublicationMock.mockResolvedValue([{}]);
    getCountyPowerStoryVectorTileMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mapCountyPowerStorySourceRowMock.mockReturnValue(createCountyScore());
    mapCountyPowerStoryRowMock.mockImplementation(({ computed, score }) => ({
      countyFips: score.countyFips,
      countyName: score.countyName,
      stateAbbrev: score.stateAbbrev,
      avgRtCongestionComponent: score.avgRtCongestionComponent,
      isBorderCounty: score.isBorderCounty,
      isSeamCounty: score.isSeamCounty,
      marketStructure: score.powerMarketContext.marketStructure,
      moratoriumStatus: score.moratoriumStatus,
      negativePriceHourShare: score.negativePriceHourShare,
      p95ShadowPrice: score.p95ShadowPrice,
      policyEventCount: score.policyEventCount,
      policyMomentumScore: score.policyMomentumScore,
      queueAvgAgeDays: score.queueAvgAgeDays,
      queueMwActive: score.queueMwActive,
      queueProjectCountActive: score.queueProjectCountActive,
      wholesaleOperator: score.powerMarketContext.wholesaleOperator,
      activityScore: computed.activityScore,
      band: computed.band,
      categoryKey: computed.categoryKey,
      direction: computed.direction,
      normalizedScore: computed.normalizedScore,
      outlineIntensity: computed.outlineIntensity,
      pulseAmplitude: computed.pulseAmplitude,
      seed: computed.seed,
    }));
    mapCountyPowerStoryTimelineFrameRowMock.mockImplementation((row) => ({
      countyFips: row.countyFips,
      activityScore: row.activityScore,
      band: row.band,
      categoryKey: row.categoryKey,
      direction: row.direction,
      normalizedScore: row.normalizedScore,
      outlineIntensity: row.outlineIntensity,
      pulseAmplitude: row.pulseAmplitude,
      seed: row.seed,
    }));
  });

  afterAll(() => {
    mock.restore();
  });

  it("pins latest snapshot reads to the publication returned by status", async () => {
    const result = await queryCountyPowerStorySnapshot({
      storyId: "grid-stress",
      window: "live",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected latest county power story snapshot to succeed");
    }

    expect(queryCountyScoresStatusMock).toHaveBeenCalledTimes(1);
    expect(getCountyPowerStoryPublicationMock).not.toHaveBeenCalled();
    expect(listCountyPowerStorySnapshotRowsByPublicationMock).toHaveBeenCalledWith(
      "county-power-run-current"
    );
    expect(result.value.publicationRunId).toBe("county-power-run-current");
  });

  it("returns vector tiles from the county geometry source", async () => {
    const result = await queryCountyPowerStoryVectorTile({
      z: 4,
      x: 3,
      y: 6,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected county power story vector tile request to succeed");
    }

    expect(getCountyPowerStoryVectorTileMock).toHaveBeenCalledWith({
      z: 4,
      x: 3,
      y: 6,
    });
    expect([...result.value.tile]).toEqual([1, 2, 3]);
  });

  it("loads the requested publication directly instead of asserting against current status", async () => {
    const result = await queryCountyPowerStorySnapshot({
      publicationRunId: "county-power-run-1",
      storyId: "market-structure",
      window: "60d",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected requested publication snapshot to succeed");
    }

    expect(queryCountyScoresStatusMock).not.toHaveBeenCalled();
    expect(getCountyPowerStoryPublicationMock).toHaveBeenCalledWith("county-power-run-1");
    expect(listCountyPowerStorySnapshotRowsByPublicationMock).toHaveBeenCalledWith(
      "county-power-run-1"
    );
    expect(result.value.publicationRunId).toBe("county-power-run-1");
    expect(result.value.window).toBe("60d");
  });

  it("returns publication_run_not_found when the requested publication is missing", async () => {
    getCountyPowerStoryPublicationMock.mockResolvedValue(null);

    const result = await queryCountyPowerStorySnapshot({
      publicationRunId: "missing-run",
      storyId: "policy-watch",
      window: "30d",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected requested publication snapshot to fail");
    }

    expect(result.value.reason).toBe("publication_run_not_found");
    expect(listCountyPowerStorySnapshotRowsByPublicationMock).not.toHaveBeenCalled();
  });
});
