import { describe, expect, it } from "bun:test";
import type {
  CountyScoresResponse,
  CountyScoresStatusResponse,
} from "@map-migration/http-contracts/county-intelligence-http";
import type { SpatialAnalysisSummaryResponse } from "@map-migration/http-contracts/spatial-analysis-summary-http";
import type { ScannerSummary } from "@/features/scanner/scanner.types";
import {
  buildEmptySpatialAnalysisSummary,
  buildScannerSpatialAnalysisSummary,
  buildSpatialAnalysisSummaryModel,
} from "@/features/spatial-analysis/spatial-analysis-summary.service";

function createSpatialAnalysisSummaryResponse(): SpatialAnalysisSummaryResponse {
  return {
    area: {
      countyIds: ["48453"],
      selectionAreaSqKm: 123.45,
    },
    countyIntelligence: {
      requestedCountyIds: ["48453"],
      scores: null,
      status: null,
      unavailableReason: null,
    },
    coverage: {
      countyIntelligence: {
        availableFeatureFamilies: [],
        datasetAvailable: false,
        missingFeatureFamilies: [],
      },
      flood: {
        datasetAvailable: true,
        included: true,
        unavailableReason: null,
      },
      markets: {
        boundarySourceAvailable: true,
        unavailableReason: null,
      },
      parcels: {
        included: true,
        nextCursor: null,
        truncated: false,
      },
    },
    meta: {
      dataVersion: "dev",
      generatedAt: "2026-03-09T00:00:00.000Z",
      recordCount: 1,
      requestId: "req-1",
      sourceMode: "postgis",
      truncated: false,
      warnings: [],
    },
    policy: {
      countyIntelligence: {
        dataset: "county_scores",
        queryAllowed: true,
        queryGranularity: "county",
      },
      flood: {
        dataset: "environmental_flood",
        queryAllowed: true,
        queryGranularity: "polygon",
      },
      facilities: {
        dataset: "facilities",
        queryAllowed: true,
        queryGranularity: "polygon",
      },
      parcels: {
        dataset: "parcels",
        queryAllowed: true,
        queryGranularity: "polygon",
      },
    },
    provenance: {
      countyIntelligence: {
        dataVersion: null,
        formulaVersion: null,
        inputDataVersion: null,
        methodologyId: null,
        publicationRunId: null,
        publishedAt: null,
      },
      flood: {
        dataVersion: "2026-03-07",
        runId: "flood-run-1",
        sourceMode: "postgis",
        sourceVersion: "2026-03-07",
        unavailableReason: null,
        warnings: [],
      },
      facilities: {
        countsByPerspective: {
          colocation: 1,
          hyperscale: 0,
        },
        dataVersion: "dev",
        sourceMode: "postgis",
        truncatedByPerspective: {
          colocation: false,
          hyperscale: false,
        },
        warnings: [],
      },
      markets: {
        dataVersion: "dev",
        sourceMode: "postgis",
        sourceVersion: "derived-market-boundaries-v1",
        unavailableReason: null,
        warnings: [],
      },
      parcels: {
        dataVersion: null,
        ingestionRunId: null,
        nextCursor: null,
        sourceMode: null,
        warnings: [],
      },
    },
    request: {
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-97.8, 30.2],
            [-97.7, 30.2],
            [-97.7, 30.3],
            [-97.8, 30.2],
          ],
        ],
      },
      includeFlood: true,
      includeParcels: true,
      limitPerPerspective: 5000,
      minimumMarketSelectionOverlapPercent: 0,
      parcelPageSize: 20_000,
      perspectives: ["colocation", "hyperscale"],
    },
    summary: {
      colocation: {
        availablePowerMw: 10,
        commissionedPowerMw: 20,
        count: 1,
        leasedCount: 0,
        operationalCount: 1,
        pipelinePowerMw: 0,
        plannedCount: 0,
        plannedPowerMw: 0,
        squareFootage: 1000,
        underConstructionCount: 0,
        underConstructionPowerMw: 0,
        unknownCount: 0,
      },
      countyIds: ["48453"],
      facilities: [],
      flood: {
        flood100AreaSqKm: 12.5,
        flood100SelectionShare: 0.1013,
        flood500AreaSqKm: 25,
        flood500SelectionShare: 0.2025,
        parcelCountIntersectingFlood100: 3,
        parcelCountIntersectingFlood500: 7,
        parcelCountOutsideMappedFlood: 11,
        selectionAreaSqKm: 123.45,
        unavailableReason: null,
      },
      hyperscale: {
        availablePowerMw: 0,
        commissionedPowerMw: 0,
        count: 0,
        leasedCount: 0,
        operationalCount: 0,
        pipelinePowerMw: 0,
        plannedCount: 0,
        plannedPowerMw: 0,
        squareFootage: 0,
        underConstructionCount: 0,
        underConstructionPowerMw: 0,
        unknownCount: 0,
      },
      marketSelection: {
        markets: [],
        matchCount: 0,
        minimumSelectionOverlapPercent: 0,
        primaryMarket: null,
        selectionAreaSqKm: 123.45,
        unavailableReason: null,
      },
      parcelSelection: {
        count: 0,
        nextCursor: null,
        parcels: [],
        truncated: false,
      },
      topColocationProviders: [],
      topHyperscaleProviders: [],
      totalCount: 1,
    },
    warnings: [],
  };
}

function createCountyScoresResponse(): CountyScoresResponse {
  return {
    rows: [
      {
        countyFips: "48453",
        countyName: "Travis County",
        stateAbbrev: "TX",
        rankStatus: "ranked",
        attractivenessTier: "balanced",
        confidence: {
          evidenceConfidence: "high",
          methodConfidence: "medium",
          coverageConfidence: "high",
          freshnessState: "fresh",
          suppressionState: "none",
        },
        confidenceBadge: "high",
        marketPressureIndex: 61.4,
        demandPressureScore: 74.2,
        supplyTimelineScore: 55.1,
        gridFrictionScore: 48.6,
        policyConstraintScore: 32.5,
        freshnessScore: 92,
        lastUpdatedAt: "2026-03-07T00:00:00.000Z",
        sourceVolatility: "medium",
        narrativeSummary:
          "Demand and supply signals are mixed, pointing to a balanced county profile.",
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
          supplyTimeline: "observed",
        },
        powerMarketContext: {
          balancingAuthority: "ERCOT",
          loadZone: "LCRA",
          marketStructure: "organized_market",
          meteoZone: "Austin/San Antonio (TX215)",
          operatorWeatherZone: "South Central",
          operatorZoneConfidence: "medium",
          operatorZoneLabel: "LCRA",
          operatorZoneType: "load_zone",
          weatherZone: "South Central",
          wholesaleOperator: "ERCOT",
        },
        retailStructure: {
          competitiveAreaType: "choice",
          primaryTduOrUtility: "Oncor",
          retailChoiceStatus: "choice",
          utilityContext: {
            dominantUtilityId: "oncor",
            dominantUtilityName: "Oncor Electric Delivery",
            retailChoicePenetrationShare: 0.82,
            territoryType: "tdu",
            utilities: [
              {
                utilityId: "oncor",
                utilityName: "Oncor Electric Delivery",
                territoryType: "tdu",
                retailChoiceStatus: "choice",
              },
            ],
            utilityCount: 1,
          },
        },
        expectedMw0To24m: 120,
        expectedMw24To60m: 60,
        recentCommissionedMw24m: 45,
        demandMomentumQoq: 0.12,
        providerEntryCount12m: 1,
        expectedSupplyMw0To36m: 80,
        expectedSupplyMw36To60m: 40,
        signedIaMw: 25,
        queueMwActive: 200,
        queueProjectCountActive: 4,
        medianDaysInQueueActive: 540,
        pastDueShare: 0.22,
        marketWithdrawalPrior: 0.18,
        congestionProxyScore: 36,
        plannedUpgradeCount: 2,
        heatmapSignalFlag: true,
        policyMomentumScore: 14.6,
        moratoriumStatus: "watch",
        publicSentimentScore: 0.41,
        policyEventCount: 3,
        countyTaggedEventShare: 0.5,
        policyMappingConfidence: "high",
        transmissionMiles69kvPlus: 128.2,
        transmissionMiles138kvPlus: 96.4,
        transmissionMiles230kvPlus: 42.8,
        transmissionMiles345kvPlus: 18.1,
        transmissionMiles500kvPlus: 0,
        transmissionMiles765kvPlus: 0,
        transmissionContext: {
          miles138kvPlus: 96.4,
          miles230kvPlus: 42.8,
          miles345kvPlus: 18.1,
          miles500kvPlus: 0,
          miles69kvPlus: 128.2,
          miles765kvPlus: 0,
        },
        gasPipelinePresenceFlag: true,
        gasPipelineMileageCounty: 88.6,
        fiberPresenceFlag: true,
        primaryMarketId: "austin",
        isBorderCounty: false,
        isSeamCounty: false,
        queueStorageMw: 75,
        queueSolarMw: 20,
        queueWindMw: 15,
        queueAvgAgeDays: 610,
        queueWithdrawalRate: 0.19,
        recentOnlineMw: 55,
        avgRtCongestionComponent: 4.8,
        p95ShadowPrice: 29.4,
        negativePriceHourShare: 0.07,
        topConstraints: [
          {
            constraintId: "ercot-west-001",
            flowMw: 410,
            hoursBound: 38,
            label: "West export interface",
            limitMw: 450,
            operator: "ERCOT",
            shadowPrice: 29.4,
            voltageKv: 345,
          },
        ],
        interconnectionQueue: {
          activeMw: 200,
          avgAgeDays: 610,
          medianDaysInQueueActive: 540,
          projectCountActive: 4,
          recentOnlineMw: 55,
          solarMw: 20,
          storageMw: 75,
          windMw: 15,
          withdrawalRate: 0.19,
        },
        congestionContext: {
          avgRtCongestionComponent: 4.8,
          congestionProxyScore: 36,
          negativePriceHourShare: 0.07,
          p95ShadowPrice: 29.4,
          topConstraints: [
            {
              constraintId: "ercot-west-001",
              flowMw: 410,
              hoursBound: 38,
              label: "West export interface",
              limitMw: 450,
              operator: "ERCOT",
              shadowPrice: 29.4,
              voltageKv: 345,
            },
          ],
        },
        sourceProvenance: {
          congestion: "fact_congestion_snapshot@2026-03-05",
          interconnectionQueue: "fact_gen_queue_snapshot@2026-03-01",
          operatingFootprints: "fact_power_market_context_snapshot@2026-03-07",
          retailStructure: "fact_utility_context_snapshot@2026-03-07",
          transmission: "fact_transmission_snapshot@2026-03-06",
          utilityTerritories: "fact_utility_context_snapshot@2026-03-07",
          wholesaleMarkets: "fact_power_market_context_snapshot@2026-03-07",
        },
        publicationRunId: "county-market-pressure-20260307T000000Z",
        formulaVersion: "county-market-pressure-v1",
        inputDataVersion:
          "dc_pipeline=2026-03-07;queue=2026-03-01;policy=2026-03-05;power_market_context=2026-03-07;utility_context=2026-03-07;transmission=2026-03-06;congestion=2026-03-05",
      },
    ],
    summary: {
      requestedCountyIds: ["48453"],
      missingCountyIds: [],
      deferredCountyIds: [],
      blockedCountyIds: [],
    },
    meta: {
      dataVersion: "2026-03-07",
      generatedAt: "2026-03-07T00:00:00.000Z",
      recordCount: 1,
      requestId: "county-req-1",
      sourceMode: "postgis",
      truncated: false,
      warnings: [],
    },
  };
}

function createCountyScoresStatusResponse(): CountyScoresStatusResponse {
  return {
    datasetAvailable: true,
    publicationRunId: "county-market-pressure-20260307T000000Z",
    registryVersion: "registry-v1-20260326T160000Z",
    publishedAt: "2026-03-07T00:00:00.000Z",
    methodologyId: "county-market-pressure-v1",
    dataVersion: "2026-03-07",
    inputDataVersion:
      "dc_pipeline=2026-03-07;queue=2026-03-01;policy=2026-03-05;power_market_context=2026-03-07;utility_context=2026-03-07;transmission=2026-03-06;congestion=2026-03-05",
    formulaVersion: "county-market-pressure-v1",
    rowCount: 3221,
    sourceCountyCount: 3221,
    rankedCountyCount: 2400,
    deferredCountyCount: 700,
    blockedCountyCount: 121,
    highConfidenceCount: 1800,
    mediumConfidenceCount: 1000,
    lowConfidenceCount: 421,
    freshCountyCount: 3100,
    freshnessStateCounts: {
      fresh: 3100,
      aging: 80,
      stale: 30,
      critical: 11,
      unknown: 0,
    },
    suppressionStateCounts: {
      none: 2800,
      downgraded: 380,
      reviewRequired: 41,
      suppressed: 0,
    },
    availableFeatureFamilies: [
      "congestion",
      "demand",
      "grid_friction",
      "history",
      "infrastructure",
      "interconnection_queue",
      "market_seams",
      "narratives",
      "operating_footprints",
      "policy",
      "retail_structure",
      "supply_timeline",
      "transmission",
      "utility_territories",
      "wholesale_markets",
    ],
    missingFeatureFamilies: [],
    featureCoverage: {
      congestion: true,
      demand: true,
      gridFriction: true,
      history: true,
      infrastructure: true,
      interconnectionQueue: true,
      marketSeams: true,
      narratives: true,
      operatingFootprints: true,
      policy: true,
      retailStructure: true,
      supplyTimeline: true,
      transmission: true,
      utilityTerritories: true,
      wholesaleMarkets: true,
    },
    meta: {
      dataVersion: "2026-03-07",
      generatedAt: "2026-03-07T00:00:00.000Z",
      recordCount: 1,
      requestId: "county-status-req-1",
      sourceMode: "postgis",
      truncated: false,
      warnings: [],
    },
  };
}

function createScannerSummary(): ScannerSummary {
  return {
    colocation: {
      availablePowerMw: 0,
      commissionedPowerMw: 0,
      count: 0,
      leasedCount: 0,
      operationalCount: 0,
      pipelinePowerMw: 0,
      plannedCount: 0,
      plannedPowerMw: 0,
      squareFootage: 0,
      underConstructionCount: 0,
      underConstructionPowerMw: 0,
      unknownCount: 0,
    },
    countyIds: ["48453"],
    facilities: [],
    hyperscale: {
      availablePowerMw: 0,
      commissionedPowerMw: 0,
      count: 0,
      leasedCount: 0,
      operationalCount: 0,
      pipelinePowerMw: 0,
      plannedCount: 0,
      plannedPowerMw: 0,
      squareFootage: 0,
      underConstructionCount: 0,
      underConstructionPowerMw: 0,
      unknownCount: 0,
    },
    parcelSelection: {
      count: 0,
      nextCursor: null,
      parcels: [],
      truncated: false,
    },
    topColocationProviders: [],
    topHyperscaleProviders: [],
    totalCount: 0,
  };
}

describe("spatial analysis summary service", () => {
  it("builds an empty summary model with flood defaults", () => {
    const summary = buildEmptySpatialAnalysisSummary([
      [-97.8, 30.2],
      [-97.7, 30.2],
      [-97.7, 30.3],
      [-97.8, 30.2],
    ]);

    expect(summary.summary.flood).toEqual({
      flood100AreaSqKm: 0,
      flood100SelectionShare: 0,
      flood500AreaSqKm: 0,
      flood500SelectionShare: 0,
      parcelCountIntersectingFlood100: 0,
      parcelCountIntersectingFlood500: 0,
      parcelCountOutsideMappedFlood: 0,
      selectionAreaSqKm: 0,
      unavailableReason: null,
    });
  });

  it("preserves flood summary data from the API payload", () => {
    const response = createSpatialAnalysisSummaryResponse();
    const summary = buildSpatialAnalysisSummaryModel(response);

    expect(summary.summary.flood).toEqual(response.summary.flood);
    expect(summary.coverage?.flood).toEqual(response.coverage.flood);
    expect(summary.provenance?.flood).toEqual(response.provenance.flood);
  });

  it("preserves scanner county market-pressure provenance and status", () => {
    const summary = buildScannerSpatialAnalysisSummary({
      countyIds: ["48453"],
      countyScores: createCountyScoresResponse(),
      countyScoresError: null,
      countyScoresStatus: createCountyScoresStatusResponse(),
      countyScoresStatusError: null,
      marketSelection: {
        markets: [],
        matchCount: 0,
        minimumSelectionOverlapPercent: 0,
        primaryMarket: null,
        selectionAreaSqKm: 0,
        unavailableReason: null,
      },
      summary: createScannerSummary(),
    });

    expect(summary.countyIntelligence.scores?.rows[0]?.publicationRunId).toBe(
      "county-market-pressure-20260307T000000Z"
    );
    expect(summary.countyIntelligence.status?.featureCoverage.demand).toBe(true);
    expect(summary.countyIntelligence.status?.featureCoverage.wholesaleMarkets).toBe(true);
    expect(summary.countyIntelligence.scores?.rows[0]?.powerMarketContext.wholesaleOperator).toBe(
      "ERCOT"
    );
    expect(summary.countyIntelligence.status?.formulaVersion).toBe("county-market-pressure-v1");
    expect(summary.warnings).toEqual([]);
  });
});
