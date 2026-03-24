import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const queryCountyScoresMock = mock();
const queryCountyScoresStatusMock = mock();
const queryMarketsBySelectionMock = mock();
const queryMarketInsightByMarketIdMock = mock();
const queryFacilitiesByPolygonMock = mock();
const queryFloodAnalysisMock = mock();
const isDatasetQueryAllowedMock = mock();
const listIntersectedCountyIdsMock = mock();
const getMarketBoundarySourceVersionMock = mock();
const getApiRuntimeConfigMock = mock();
const bboxExceedsLimitsMock = mock();
const enrichParcelsByPolygonMock = mock();
const mapParcelRowsToFeaturesMock = mock();
const paginateEnrichFeaturesMock = mock();
const resolvePageSizeMock = mock();
const readIngestionRunIdMock = mock();
const resolvePolygonGeometryMock = mock();
const normalizePolygonGeometryGeoJsonMock = mock();

mock.module("../../../src/geo/markets/markets-selection.service", () => ({
  queryMarketsBySelection: queryMarketsBySelectionMock,
}));

mock.module("../../../src/geo/facilities/route/facilities-route-query.service", () => ({
  queryFacilitiesByPolygon: queryFacilitiesByPolygonMock,
}));

mock.module("../../../src/geo/flood/flood.service", () => ({
  queryFloodAnalysis: queryFloodAnalysisMock,
}));

mock.module("../../../src/geo/parcels/parcels.mapper", () => ({
  mapParcelRowsToFeatures: mapParcelRowsToFeaturesMock,
}));

mock.module("../../../src/geo/parcels/parcels.repo", () => ({
  enrichParcelsByPolygon: enrichParcelsByPolygonMock,
}));

mock.module("../../../src/geo/parcels/parcels-pagination.service", () => ({
  coerceCursor: (value: string | null | undefined) => value ?? null,
  paginateEnrichFeatures: paginateEnrichFeaturesMock,
  resolvePageSize: resolvePageSizeMock,
}));

mock.module("../../../src/geo/parcels/parcels-policy.service", () => ({
  bboxExceedsLimits: bboxExceedsLimitsMock,
  PARCELS_MAX_POLYGON_JSON_CHARS: 100_000,
  resolvePolygonGeometry: resolvePolygonGeometryMock,
}));

mock.module("../../../src/geo/parcels/parcels-response-meta.service", () => ({
  profileMetadataWarnings: () => [],
  readIngestionRunId: readIngestionRunIdMock,
}));

mock.module("../../../src/geo/analysis-summary/analysis-summary.repo", () => ({
  getMarketBoundarySourceVersion: getMarketBoundarySourceVersionMock,
  listIntersectedCountyIds: listIntersectedCountyIdsMock,
}));

mock.module("../../../src/http/runtime-config", () => ({
  getApiRuntimeConfig: getApiRuntimeConfigMock,
}));

mock.module("../../../src/http/polygon-normalization.service", () => ({
  buildPolygonRepairWarning: (scope: string, invalidReason: string | null) => ({
    code: "POLYGON_GEOMETRY_REPAIRED",
    message: `${scope}:${invalidReason ?? "none"}`,
  }),
  normalizePolygonGeometryGeoJson: normalizePolygonGeometryGeoJsonMock,
}));

mock.module("../../../src/http/spatial-analysis-policy.service", () => ({
  isDatasetQueryAllowed: isDatasetQueryAllowedMock,
}));

const { querySpatialAnalysisSummary } = await import(
  "@/geo/analysis-summary/analysis-summary.service"
);

afterAll(() => {
  mock.restore();
});

function createRequest() {
  return {
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [-97.8, 30.2],
          [-97.7, 30.2],
          [-97.7, 30.3],
          [-97.8, 30.2],
        ],
      ],
    },
    includeFacilities: true,
    includeParcels: false,
    includeFlood: true,
    limitPerPerspective: 5000,
    minimumMarketSelectionOverlapPercent: 0,
    parcelPageSize: 20_000,
    perspectives: ["colocation", "hyperscale"] as const,
  };
}

function createFacilityFeature(
  id: string,
  perspective: "colocation" | "hyperscale",
  countyFips = "48453"
) {
  return {
    type: "Feature" as const,
    id,
    geometry: {
      type: "Point" as const,
      coordinates: [-97.7431, 30.2672] as [number, number],
    },
    properties: {
      address: "123 Main St",
      availablePowerMw: 10,
      city: "Austin",
      commissionedPowerMw: 20,
      commissionedSemantic: "operational" as const,
      countyFips,
      facilityId: id,
      facilityName: `Facility ${id}`,
      leaseOrOwn: "own" as const,
      perspective,
      plannedPowerMw: 5,
      providerId: "provider-1",
      providerName: "Provider One",
      squareFootage: 1000,
      state: "Texas",
      stateAbbrev: "TX",
      statusLabel: "Operational",
      underConstructionPowerMw: 0,
    },
  };
}

function createParcelFeature(parcelId: string) {
  return {
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [-97.7431, 30.2672] as [number, number],
    },
    properties: {
      attrs: {
        parcelId,
      },
      geoid: "484530001001",
      parcelId,
      state2: "TX",
    },
  };
}

function createMarketsSelectionResult(args?: {
  readonly matchedMarkets?: readonly unknown[];
  readonly selectionAreaSqKm?: number;
  readonly truncated?: boolean;
  readonly warnings?: readonly { readonly code: string; readonly message: string }[];
}) {
  const matchedMarkets = [...(args?.matchedMarkets ?? [])];

  return {
    ok: true as const,
    value: {
      matchedMarkets,
      primaryMarket: matchedMarkets[0] ?? null,
      selectionAreaSqKm: args?.selectionAreaSqKm ?? 123.45,
      truncated: args?.truncated ?? false,
      warnings: [...(args?.warnings ?? [])],
    },
  };
}

function createCanonicalCountyStatusPayload() {
  return {
    datasetAvailable: true,
    publicationRunId: "county-market-pressure-20260307T000000Z",
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
  };
}

function createCanonicalCountyScoreRow() {
  return {
    countyFips: "48453",
    countyName: "Travis County",
    stateAbbrev: "TX",
    rankStatus: "ranked",
    attractivenessTier: "balanced",
    confidenceBadge: "high",
    marketPressureIndex: 61.4,
    demandPressureScore: 74.2,
    supplyTimelineScore: 55.1,
    gridFrictionScore: 48.6,
    policyConstraintScore: 32.5,
    freshnessScore: 92,
    lastUpdatedAt: "2026-03-07T00:00:00.000Z",
    sourceVolatility: "medium",
    narrativeSummary: "Demand and supply signals are mixed, pointing to a balanced county profile.",
    topDrivers: [
      {
        code: "DEMAND_0_24M",
        impact: "headwind",
        label: "Near-term demand pipeline",
        summary: "Stage-weighted expected demand in the next 24 months is 120 MW.",
      },
    ],
    deferredReasonCodes: [],
    whatChanged30d: [
      {
        code: "DEMAND_0_24M",
        direction: "up",
        label: "Near-term demand pipeline",
        magnitude: 18,
        summary: "Stage-weighted 0-24 month load pipeline increased over the last 30 days.",
      },
    ],
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
  };
}

function createPorts() {
  return {
    facilitiesBboxExceedsLimits: (bbox: {
      east: number;
      north: number;
      south: number;
      west: number;
    }) => bbox.east - bbox.west > 3 || bbox.north - bbox.south > 2,
    facilitiesMaxPolygonJsonChars: 100_000,
    getRuntimeMetadata: () => {
      const runtimeConfig = getApiRuntimeConfigMock();

      return {
        countyIntelligenceSourceMode: "postgis" as const,
        facilitiesDataVersion: runtimeConfig.dataVersion,
        facilitiesSourceMode: runtimeConfig.facilitiesSourceMode,
        floodSourceMode: "postgis" as const,
        marketsDataVersion: runtimeConfig.dataVersion,
        marketsSourceMode: "postgis" as const,
      };
    },
    isDatasetQueryAllowed: ({
      dataset,
      queryGranularity,
    }: {
      dataset: string;
      queryGranularity: string;
    }) => isDatasetQueryAllowedMock(dataset, queryGranularity),
    lookupMarketBoundarySourceVersion: async () => {
      try {
        return {
          ok: true as const,
          value: await getMarketBoundarySourceVersionMock(),
        };
      } catch (error) {
        return {
          ok: false as const,
          value: {
            error,
            reason:
              error instanceof Error &&
              error.message.includes('relation "market_current.market_boundaries" does not exist')
                ? "source_unavailable"
                : "query_failed",
          },
        };
      }
    },
    lookupSelectionAreaAndCountyIds: async (geometryGeoJson: string) => {
      try {
        const rows = await listIntersectedCountyIdsMock(geometryGeoJson);

        return {
          ok: true as const,
          value: {
            countyIds: rows
              .map((row: { county_fips: string | null }) => row.county_fips)
              .filter((countyId: string | null): countyId is string => countyId !== null),
            selectionAreaSqKm: Number(rows[0]?.selection_area_sq_km ?? 0),
          },
        };
      } catch (error) {
        return {
          ok: false as const,
          value: {
            error,
            reason:
              error instanceof Error &&
              error.message.includes('relation "serve.boundary_county_geom_lod1" does not exist')
                ? "source_unavailable"
                : "query_failed",
          },
        };
      }
    },
    normalizeSelectionGeometry: async (geometryText: string) => {
      const normalizedGeometry = await normalizePolygonGeometryGeoJsonMock(geometryText);

      return {
        geometryText: normalizedGeometry.geometryText,
        warning: normalizedGeometry.wasRepaired
          ? {
              code: "POLYGON_GEOMETRY_REPAIRED",
              message: `analysis selection:${normalizedGeometry.invalidReason ?? "none"}`,
            }
          : null,
      };
    },
    queryCountyScores: queryCountyScoresMock,
    queryCountyScoresStatus: queryCountyScoresStatusMock,
    queryFacilitiesByPolygon: queryFacilitiesByPolygonMock,
    queryFloodAnalysis: queryFloodAnalysisMock,
    queryMarketInsightByMarketId: queryMarketInsightByMarketIdMock,
    queryMarketsBySelection: queryMarketsBySelectionMock,
    queryParcels: async (args: {
      expectedIngestionRunId: string | null;
      geometryText: string;
      includeGeometry: "centroid" | "full" | "none" | "simplified";
      pageSize: number | undefined;
    }) => {
      const pageSizeResolution = resolvePageSizeMock(args.pageSize ?? 20_000);
      const warnings = [...pageSizeResolution.warnings];
      const rows = await enrichParcelsByPolygonMock(args.geometryText, {
        cursor: null,
        includeGeometry: args.includeGeometry,
        limit: pageSizeResolution.pageSize + 1,
      });
      const mappedFeatures = mapParcelRowsToFeaturesMock(rows);
      const paginated = paginateEnrichFeaturesMock(
        mappedFeatures,
        pageSizeResolution.pageSize,
        warnings
      );
      const ingestionRunId = readIngestionRunIdMock(paginated.features) ?? null;

      if (
        args.expectedIngestionRunId !== null &&
        paginated.features.length > 0 &&
        ingestionRunId !== args.expectedIngestionRunId
      ) {
        return {
          ok: false as const,
          value: {
            error: new Error("parcel ingestion run mismatch"),
            reason: "parcel_ingestion_run_mismatch" as const,
          },
        };
      }

      const runtimeConfig = getApiRuntimeConfigMock();

      return {
        ok: true as const,
        value: {
          dataVersion: runtimeConfig.dataVersion,
          features: paginated.features,
          ingestionRunId,
          nextCursor: paginated.nextCursor,
          sourceMode: runtimeConfig.parcelsSourceMode,
          truncated: paginated.hasMore,
          warnings: [
            ...warnings,
            ...(paginated.hasMore && paginated.features.length >= 20_000
              ? [
                  {
                    code: "PARCELS_TOTAL_CAP_REACHED",
                    message:
                      "Parcel analysis summary is capped at 20000 parcels; use the parcels API for full pagination.",
                  },
                ]
              : []),
          ],
        },
      };
    },
    resolveFacilitiesGeometry: (geometry: {
      coordinates: readonly (readonly (readonly [number, number])[])[];
    }) => {
      const ring = geometry.coordinates[0] ?? [];
      const longitudes = ring.map((coordinate) => coordinate[0]);
      const latitudes = ring.map((coordinate) => coordinate[1]);

      return {
        bbox: {
          east: Math.max(...longitudes),
          north: Math.max(...latitudes),
          south: Math.min(...latitudes),
          west: Math.min(...longitudes),
        },
        geometryText: JSON.stringify(geometry),
      };
    },
    resolveFacilitiesLimit: ({
      perspective,
      requestedLimit,
    }: {
      perspective: "colocation" | "hyperscale";
      requestedLimit: number;
    }) =>
      requestedLimit <= 5000
        ? {
            limit: requestedLimit,
            warning: null,
          }
        : {
            limit: 5000,
            warning: {
              code: `${perspective.toUpperCase()}_LIMIT_CLAMPED`,
              message: `${perspective} facilities limit reduced to 5000 due to server policy.`,
            },
          },
    resolveParcelPolicyWarning: ({
      geometry,
      includeParcels,
    }: {
      geometry: { geometry: unknown; type: "polygon" };
      includeParcels: boolean;
    }) => {
      if (!includeParcels) {
        return null;
      }

      const resolvedGeometry = resolvePolygonGeometryMock({
        type: "polygon",
        geometry: geometry.geometry,
      });
      if (bboxExceedsLimitsMock(resolvedGeometry.bbox)) {
        return {
          code: "PARCELS_POLICY_REJECTED",
          message: "Parcel analysis skipped because the selection exceeds the parcel AOI limit.",
        };
      }

      return null;
    },
  };
}

describe("querySpatialAnalysisSummary", () => {
  beforeEach(() => {
    queryCountyScoresMock.mockReset();
    queryCountyScoresStatusMock.mockReset();
    queryMarketsBySelectionMock.mockReset();
    queryMarketInsightByMarketIdMock.mockReset();
    queryFacilitiesByPolygonMock.mockReset();
    queryFloodAnalysisMock.mockReset();
    isDatasetQueryAllowedMock.mockReset();
    listIntersectedCountyIdsMock.mockReset();
    getMarketBoundarySourceVersionMock.mockReset();
    getApiRuntimeConfigMock.mockReset();
    bboxExceedsLimitsMock.mockReset();
    enrichParcelsByPolygonMock.mockReset();
    mapParcelRowsToFeaturesMock.mockReset();
    paginateEnrichFeaturesMock.mockReset();
    resolvePageSizeMock.mockReset();
    readIngestionRunIdMock.mockReset();
    resolvePolygonGeometryMock.mockReset();
    normalizePolygonGeometryGeoJsonMock.mockReset();

    isDatasetQueryAllowedMock.mockReturnValue(true);
    bboxExceedsLimitsMock.mockReturnValue(false);
    resolvePageSizeMock.mockImplementation((pageSize) => ({
      pageSize,
      warnings: [],
    }));
    enrichParcelsByPolygonMock.mockResolvedValue([]);
    mapParcelRowsToFeaturesMock.mockReturnValue([]);
    paginateEnrichFeaturesMock.mockImplementation((features) => ({
      features,
      hasMore: false,
      nextCursor: null,
    }));
    readIngestionRunIdMock.mockReturnValue(null);
    resolvePolygonGeometryMock.mockImplementation((aoi) => ({
      bbox: {
        east: -97.7,
        north: 30.3,
        south: 30.2,
        west: -97.8,
      },
      geometryText: JSON.stringify(aoi.geometry),
    }));
    normalizePolygonGeometryGeoJsonMock.mockImplementation(async (geometryText: string) => ({
      geometryText,
      invalidReason: null,
      wasRepaired: false,
    }));
    queryFacilitiesByPolygonMock
      .mockResolvedValueOnce({
        ok: true,
        value: {
          features: [createFacilityFeature("colo-1", "colocation")],
          truncated: false,
          warnings: [],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          features: [],
          truncated: false,
          warnings: [],
        },
      });
    queryFloodAnalysisMock.mockResolvedValue({
      ok: true,
      value: {
        dataVersion: "2026-03-07",
        runId: "flood-run-1",
        summary: {
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
      },
    });
    queryMarketInsightByMarketIdMock.mockResolvedValue({
      ok: true,
      value: null,
    });
    listIntersectedCountyIdsMock.mockResolvedValue([
      {
        county_fips: "48453",
        selection_area_sq_km: 123.45,
      },
    ]);
    getApiRuntimeConfigMock.mockReturnValue({
      dataVersion: "dev",
      facilitiesSourceMode: "postgis",
      parcelsSourceMode: "postgis",
    });
  });

  it("returns partial results with warnings when market boundaries and county scores are unavailable", async () => {
    queryMarketsBySelectionMock.mockResolvedValue({
      ok: false,
      value: {
        error: new Error('relation "market_current.market_boundaries" does not exist'),
        reason: "boundary_source_unavailable",
      },
    });
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: true,
      value: {
        availableFeatureFamilies: ["facilities", "hyperscale"],
        dataVersion: "2026-03-07",
        datasetAvailable: true,
        featureCoverage: {
          enterprise: false,
          facilities: true,
          fiber: false,
          hazards: false,
          hyperscale: true,
          policy: false,
          terrain: false,
          transmission: false,
          utilityTerritory: false,
          waterStress: false,
        },
        formulaVersion: "county-scores-v1",
        inputDataVersion: "inputs-v1",
        methodologyId: "county-method-v1",
        missingFeatureFamilies: ["enterprise"],
        publicationRunId: "county-run-1",
        publishedAt: "2026-03-07T00:00:00.000Z",
        rowCount: 1,
        scoredCountyCount: 1,
        sourceCountyCount: 1,
        waterCoverageCount: 0,
      },
    });
    queryCountyScoresMock.mockResolvedValue({
      ok: false,
      value: {
        error: new Error("county scores publication is unavailable"),
        reason: "source_unavailable",
      },
    });
    getMarketBoundarySourceVersionMock.mockRejectedValue(
      new Error('relation "market_current.market_boundaries" does not exist')
    );

    const result = await querySpatialAnalysisSummary(
      {
        expectedParcelIngestionRunId: null,
        request: createRequest(),
      },
      createPorts()
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful summary query");
    }

    expect(result.value.summary.totalCount).toBe(1);
    expect(result.value.coverage.markets.boundarySourceAvailable).toBe(false);
    expect(result.value.coverage.markets.unavailableReason).toBe(
      "Market boundary dataset is unavailable."
    );
    expect(result.value.countyIntelligence.status).toBeNull();
    expect(result.value.countyIntelligence.scores).toBeNull();
    expect(result.value.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "COUNTY_INTELLIGENCE_STATUS_INVALID",
        "COUNTY_INTELLIGENCE_UNAVAILABLE",
        "MARKET_BOUNDARY_SOURCE_UNAVAILABLE",
      ])
    );
  });

  it("drops invalid embedded county intelligence payloads without failing the summary", async () => {
    queryMarketsBySelectionMock.mockResolvedValue(createMarketsSelectionResult());
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: true,
      value: {
        availableFeatureFamilies: ["facilities", "hyperscale"],
        dataVersion: "2026-03-07",
        datasetAvailable: true,
        featureCoverage: {
          enterprise: false,
          facilities: true,
          fiber: false,
          hazards: false,
          hyperscale: true,
          policy: false,
          terrain: false,
          transmission: false,
          utilityTerritory: false,
          waterStress: false,
        },
        formulaVersion: "county-scores-v1",
        inputDataVersion: "inputs-v1",
        methodologyId: "county-method-v1",
        missingFeatureFamilies: ["enterprise"],
        publicationRunId: "county-run-1",
        publishedAt: "2026-03-07T00:00:00.000Z",
        rowCount: 1,
        scoredCountyCount: 1,
        sourceCountyCount: 1,
        waterCoverageCount: 0,
      },
    });
    queryCountyScoresMock.mockResolvedValue({
      ok: true,
      value: {
        blockedCountyIds: [],
        dataVersion: "2026-03-07",
        deferredCountyIds: [],
        missingCountyIds: [],
        requestedCountyIds: ["48453"],
        rows: [
          {
            compositeScore: 70.4873,
            countyFips: "48453",
            countyName: "Travis County",
            demandScore: 97.8804,
            formulaVersion: "county-scores-alpha-v1",
            generationScore: 67.3634,
            inputDataVersion: "inputs-v1",
            policyScore: 21.9488,
            scoreStatus: "scored",
            stateAbbrev: "TX",
          },
        ],
      },
    });
    getMarketBoundarySourceVersionMock.mockResolvedValue("derived-market-boundaries-v1");

    const result = await querySpatialAnalysisSummary(
      {
        expectedParcelIngestionRunId: null,
        request: createRequest(),
      },
      createPorts()
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful summary query with degraded county intelligence");
    }

    expect(result.value.summary.totalCount).toBe(1);
    expect(result.value.countyIntelligence.status).toBeNull();
    expect(result.value.countyIntelligence.scores).toBeNull();
    expect(result.value.countyIntelligence.unavailableReason).toBe(
      "County intelligence scores are temporarily unavailable."
    );
    expect(result.value.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(["COUNTY_INTELLIGENCE_INVALID", "COUNTY_INTELLIGENCE_STATUS_INVALID"])
    );
  });

  it("embeds canonical county market-pressure payloads into the summary response", async () => {
    queryMarketsBySelectionMock.mockResolvedValue(createMarketsSelectionResult());
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: true,
      value: createCanonicalCountyStatusPayload(),
    });
    queryCountyScoresMock.mockResolvedValue({
      ok: true,
      value: {
        blockedCountyIds: [],
        dataVersion: "2026-03-07",
        deferredCountyIds: [],
        missingCountyIds: [],
        requestedCountyIds: ["48453"],
        rows: [createCanonicalCountyScoreRow()],
      },
    });
    getMarketBoundarySourceVersionMock.mockResolvedValue("derived-market-boundaries-v1");

    const result = await querySpatialAnalysisSummary(
      {
        expectedParcelIngestionRunId: null,
        request: createRequest(),
      },
      createPorts()
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful summary query with canonical county payloads");
    }

    expect(result.value.countyIntelligence.status).toMatchObject({
      dataVersion: "2026-03-07",
      datasetAvailable: true,
      publicationRunId: "county-market-pressure-20260307T000000Z",
    });
    expect(result.value.countyIntelligence.scores?.rows[0]).toMatchObject({
      countyFips: "48453",
      marketPressureIndex: 61.4,
      powerMarketContext: {
        marketStructure: "organized_market",
        wholesaleOperator: "ERCOT",
      },
      retailStructure: {
        primaryTduOrUtility: "Oncor",
        retailChoiceStatus: "choice",
      },
      publicationRunId: "county-market-pressure-20260307T000000Z",
      rankStatus: "ranked",
    });
    expect(result.value.coverage.countyIntelligence).toEqual({
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
      datasetAvailable: true,
      missingFeatureFamilies: [],
    });
    expect(result.value.provenance.countyIntelligence).toEqual({
      dataVersion: "2026-03-07",
      formulaVersion: "county-market-pressure-v1",
      inputDataVersion:
        "dc_pipeline=2026-03-07;queue=2026-03-01;policy=2026-03-05;power_market_context=2026-03-07;utility_context=2026-03-07;transmission=2026-03-06;congestion=2026-03-05",
      methodologyId: "county-market-pressure-v1",
      publicationRunId: "county-market-pressure-20260307T000000Z",
      publishedAt: "2026-03-07T00:00:00.000Z",
    });
    expect(result.value.warnings.map((warning) => warning.code)).not.toEqual(
      expect.arrayContaining(["COUNTY_INTELLIGENCE_INVALID", "COUNTY_INTELLIGENCE_STATUS_INVALID"])
    );
  });

  it("skips facility queries when no facility perspectives are requested", async () => {
    queryMarketsBySelectionMock.mockResolvedValue(createMarketsSelectionResult());
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: false,
      value: {
        error: new Error("status unavailable"),
        reason: "source_unavailable",
      },
    });
    queryCountyScoresMock.mockResolvedValue({
      ok: true,
      value: {
        blockedCountyIds: [],
        dataVersion: "2026-03-07",
        deferredCountyIds: [],
        missingCountyIds: [],
        requestedCountyIds: ["48453"],
        rows: [],
      },
    });
    getMarketBoundarySourceVersionMock.mockResolvedValue("derived-market-boundaries-v1");

    const result = await querySpatialAnalysisSummary(
      {
        expectedParcelIngestionRunId: null,
        request: {
          ...createRequest(),
          perspectives: [],
        },
      },
      createPorts()
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful empty-perspective summary");
    }

    expect(queryFacilitiesByPolygonMock).not.toHaveBeenCalled();
    expect(result.value.summary.totalCount).toBe(0);
    expect(result.value.provenance.facilities.countsByPerspective).toEqual({
      colocation: 0,
      hyperscale: 0,
    });
  });

  it("keeps facilities and markets when parcel analysis is skipped by policy", async () => {
    bboxExceedsLimitsMock.mockReturnValue(true);
    queryMarketsBySelectionMock.mockResolvedValue(
      createMarketsSelectionResult({
        matchedMarkets: [
          {
            absorption: null,
            country: "United States",
            intersectionAreaSqKm: 40,
            isPrimary: true,
            marketCenter: {
              type: "Point",
              coordinates: [-97.7431, 30.2672],
            },
            marketId: "market-1",
            marketOverlapPercent: 0.2,
            name: "Austin",
            region: "South",
            selectionOverlapPercent: 0.3,
            state: "Texas",
            updatedAt: null,
            vacancy: null,
          },
        ],
      })
    );
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: false,
      value: {
        error: new Error("status unavailable"),
        reason: "source_unavailable",
      },
    });
    queryCountyScoresMock.mockResolvedValue({
      ok: true,
      value: {
        blockedCountyIds: [],
        dataVersion: "2026-03-07",
        deferredCountyIds: [],
        missingCountyIds: [],
        requestedCountyIds: ["48453"],
        rows: [],
      },
    });
    getMarketBoundarySourceVersionMock.mockResolvedValue("derived-market-boundaries-v1");

    const result = await querySpatialAnalysisSummary(
      {
        expectedParcelIngestionRunId: null,
        request: {
          ...createRequest(),
          includeParcels: true,
        },
      },
      createPorts()
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful summary query with parcel policy warning");
    }

    expect(result.value.summary.totalCount).toBe(1);
    expect(result.value.summary.marketSelection.matchCount).toBe(1);
    expect(result.value.summary.parcelSelection.count).toBe(0);
    expect(result.value.coverage.parcels.included).toBe(false);
    expect(result.value.warnings).toContainEqual({
      code: "PARCELS_POLICY_REJECTED",
      message: "Parcel analysis skipped because the selection exceeds the parcel AOI limit.",
    });
    expect(result.value.provenance.parcels.warnings).toContainEqual({
      code: "PARCELS_POLICY_REJECTED",
      message: "Parcel analysis skipped because the selection exceeds the parcel AOI limit.",
    });
  });

  it("skips flood analysis entirely when includeFlood is false", async () => {
    queryMarketsBySelectionMock.mockResolvedValue(createMarketsSelectionResult());
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: false,
      value: {
        error: new Error("status unavailable"),
        reason: "source_unavailable",
      },
    });
    queryCountyScoresMock.mockResolvedValue({
      ok: true,
      value: {
        blockedCountyIds: [],
        dataVersion: "2026-03-07",
        deferredCountyIds: [],
        missingCountyIds: [],
        requestedCountyIds: ["48453"],
        rows: [],
      },
    });
    getMarketBoundarySourceVersionMock.mockResolvedValue("derived-market-boundaries-v1");

    const result = await querySpatialAnalysisSummary(
      {
        expectedParcelIngestionRunId: null,
        request: {
          ...createRequest(),
          includeFlood: false,
        },
      },
      createPorts()
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful summary query without flood");
    }

    expect(queryFloodAnalysisMock).not.toHaveBeenCalled();
    expect(result.value.coverage.flood).toEqual({
      datasetAvailable: false,
      included: false,
      unavailableReason: null,
    });
    expect(result.value.provenance.flood).toEqual({
      dataVersion: null,
      runId: null,
      sourceMode: null,
      sourceVersion: null,
      unavailableReason: null,
      warnings: [],
    });
    expect(result.value.summary.flood.unavailableReason).toBeNull();
  });

  it("returns a policy warning when flood polygon queries are disabled", async () => {
    isDatasetQueryAllowedMock.mockImplementation(
      (dataset: string) => dataset !== "environmental_flood"
    );
    queryMarketsBySelectionMock.mockResolvedValue(createMarketsSelectionResult());
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: false,
      value: {
        error: new Error("status unavailable"),
        reason: "source_unavailable",
      },
    });
    queryCountyScoresMock.mockResolvedValue({
      ok: true,
      value: {
        blockedCountyIds: [],
        dataVersion: "2026-03-07",
        deferredCountyIds: [],
        missingCountyIds: [],
        requestedCountyIds: ["48453"],
        rows: [],
      },
    });
    getMarketBoundarySourceVersionMock.mockResolvedValue("derived-market-boundaries-v1");

    const result = await querySpatialAnalysisSummary(
      {
        expectedParcelIngestionRunId: null,
        request: createRequest(),
      },
      createPorts()
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful summary query with flood policy rejection");
    }

    expect(queryFloodAnalysisMock).not.toHaveBeenCalled();
    expect(result.value.coverage.flood).toEqual({
      datasetAvailable: false,
      included: false,
      unavailableReason: 'query granularity "polygon" is not allowed for environmental_flood',
    });
    expect(result.value.provenance.flood.warnings).toContainEqual({
      code: "FLOOD_POLICY_REJECTED",
      message: 'query granularity "polygon" is not allowed for environmental_flood',
    });
  });

  it("includes flood provenance when flood analysis succeeds", async () => {
    queryMarketsBySelectionMock.mockResolvedValue(createMarketsSelectionResult());
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: false,
      value: {
        error: new Error("status unavailable"),
        reason: "source_unavailable",
      },
    });
    queryCountyScoresMock.mockResolvedValue({
      ok: true,
      value: {
        blockedCountyIds: [],
        dataVersion: "2026-03-07",
        deferredCountyIds: [],
        missingCountyIds: [],
        requestedCountyIds: ["48453"],
        rows: [],
      },
    });
    getMarketBoundarySourceVersionMock.mockResolvedValue("derived-market-boundaries-v1");

    const result = await querySpatialAnalysisSummary(
      {
        expectedParcelIngestionRunId: null,
        request: createRequest(),
      },
      createPorts()
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful summary query with flood provenance");
    }

    expect(result.value.provenance.flood).toEqual({
      dataVersion: "2026-03-07",
      runId: "flood-run-1",
      sourceMode: "postgis",
      sourceVersion: "2026-03-07",
      unavailableReason: null,
      warnings: [],
    });
    expect(result.value.summary.flood).toMatchObject({
      flood100AreaSqKm: 12.5,
      flood500AreaSqKm: 25,
      parcelCountIntersectingFlood100: 3,
      parcelCountIntersectingFlood500: 7,
      parcelCountOutsideMappedFlood: 11,
      unavailableReason: null,
    });
  });

  it("returns the parcel ingestion mismatch independently of flood analysis", async () => {
    const parcelFeature = createParcelFeature("parcel-1");

    queryMarketsBySelectionMock.mockResolvedValue(createMarketsSelectionResult());
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: false,
      value: {
        error: new Error("status unavailable"),
        reason: "source_unavailable",
      },
    });
    queryCountyScoresMock.mockResolvedValue({
      ok: true,
      value: {
        blockedCountyIds: [],
        dataVersion: "2026-03-07",
        deferredCountyIds: [],
        missingCountyIds: [],
        requestedCountyIds: ["48453"],
        rows: [],
      },
    });
    getMarketBoundarySourceVersionMock.mockResolvedValue("derived-market-boundaries-v1");
    mapParcelRowsToFeaturesMock.mockReturnValue([parcelFeature]);
    paginateEnrichFeaturesMock.mockReturnValue({
      features: [parcelFeature],
      hasMore: false,
      nextCursor: null,
    });
    readIngestionRunIdMock.mockReturnValue("actual-run");

    const result = await querySpatialAnalysisSummary(
      {
        expectedParcelIngestionRunId: "expected-run",
        request: {
          ...createRequest(),
          includeParcels: true,
        },
      },
      createPorts()
    );

    expect(result).toEqual({
      ok: false,
      value: {
        error: expect.any(Error),
        reason: "parcel_ingestion_run_mismatch",
      },
    });
    expect(queryFloodAnalysisMock).toHaveBeenCalledTimes(1);
  });

  it("degrades flood analysis without failing the rest of the summary", async () => {
    queryFloodAnalysisMock.mockResolvedValue({
      ok: false,
      value: {
        error: new Error('relation "environmental_current.flood_hazard" does not exist'),
        reason: "source_unavailable",
      },
    });
    queryMarketsBySelectionMock.mockResolvedValue(createMarketsSelectionResult());
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: false,
      value: {
        error: new Error("status unavailable"),
        reason: "source_unavailable",
      },
    });
    queryCountyScoresMock.mockResolvedValue({
      ok: true,
      value: {
        blockedCountyIds: [],
        dataVersion: "2026-03-07",
        deferredCountyIds: [],
        missingCountyIds: [],
        requestedCountyIds: ["48453"],
        rows: [],
      },
    });
    getMarketBoundarySourceVersionMock.mockResolvedValue("derived-market-boundaries-v1");

    const result = await querySpatialAnalysisSummary(
      {
        expectedParcelIngestionRunId: null,
        request: createRequest(),
      },
      createPorts()
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful summary query with degraded flood analysis");
    }

    expect(result.value.summary.totalCount).toBe(1);
    expect(result.value.coverage.flood).toEqual({
      datasetAvailable: false,
      included: true,
      unavailableReason: "Environmental flood dataset is unavailable.",
    });
    expect(result.value.summary.flood.unavailableReason).toBe(
      "Environmental flood dataset is unavailable."
    );
    expect(result.value.policy.flood).toEqual({
      dataset: "environmental_flood",
      queryAllowed: true,
      queryGranularity: "polygon",
    });
    expect(result.value.warnings).toContainEqual({
      code: "FLOOD_SOURCE_UNAVAILABLE",
      message: "Environmental flood dataset is unavailable.",
    });
  });

  it("normalizes invalid facility county fips values to null in the summary response", async () => {
    queryFacilitiesByPolygonMock.mockReset();
    queryFacilitiesByPolygonMock
      .mockResolvedValueOnce({
        ok: true,
        value: {
          features: [createFacilityFeature("colo-invalid", "colocation", "BC-001")],
          truncated: false,
          warnings: [],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          features: [],
          truncated: false,
          warnings: [],
        },
      });
    queryMarketsBySelectionMock.mockResolvedValue(createMarketsSelectionResult());
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: false,
      value: {
        error: new Error("status unavailable"),
        reason: "source_unavailable",
      },
    });
    queryCountyScoresMock.mockResolvedValue({
      ok: true,
      value: {
        blockedCountyIds: [],
        dataVersion: "2026-03-07",
        deferredCountyIds: [],
        missingCountyIds: [],
        requestedCountyIds: [],
        rows: [],
      },
    });
    getMarketBoundarySourceVersionMock.mockResolvedValue("derived-market-boundaries-v1");

    const result = await querySpatialAnalysisSummary(
      {
        expectedParcelIngestionRunId: null,
        request: createRequest(),
      },
      createPorts()
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful summary query with normalized county fips");
    }

    expect(result.value.summary.facilities[0]?.countyFips).toBeNull();
  });

  it("rejects analysis summary requests when the facilities AOI exceeds the facilities extent limit", async () => {
    const result = await querySpatialAnalysisSummary(
      {
        expectedParcelIngestionRunId: null,
        request: {
          ...createRequest(),
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-101, 30],
                [-97, 30],
                [-97, 33],
                [-101, 33],
                [-101, 30],
              ],
            ],
          },
        },
      },
      createPorts()
    );

    expect(result).toEqual({
      ok: false,
      value: {
        error: expect.any(Error),
        reason: "facilities_policy_rejected",
      },
    });
    expect(queryFacilitiesByPolygonMock).not.toHaveBeenCalled();
  });

  it("reuses a repaired selection geometry across analysis queries", async () => {
    const normalizedGeometryText =
      '{"type":"Polygon","coordinates":[[[-97.8,30.2],[-97.7,30.2],[-97.7,30.3],[-97.8,30.2]]]}';

    normalizePolygonGeometryGeoJsonMock.mockResolvedValue({
      geometryText: normalizedGeometryText,
      invalidReason: "Self-intersection",
      wasRepaired: true,
    });
    queryMarketsBySelectionMock.mockResolvedValue(createMarketsSelectionResult());
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: false,
      value: {
        error: new Error("status unavailable"),
        reason: "source_unavailable",
      },
    });
    queryCountyScoresMock.mockResolvedValue({
      ok: true,
      value: {
        blockedCountyIds: [],
        dataVersion: "2026-03-07",
        deferredCountyIds: [],
        missingCountyIds: [],
        requestedCountyIds: ["48453"],
        rows: [],
      },
    });
    getMarketBoundarySourceVersionMock.mockResolvedValue("derived-market-boundaries-v1");

    const result = await querySpatialAnalysisSummary(
      {
        expectedParcelIngestionRunId: null,
        request: createRequest(),
      },
      createPorts()
    );

    expect(result.ok).toBe(true);
    expect(queryFacilitiesByPolygonMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        geometryGeoJson: normalizedGeometryText,
        perspective: "colocation",
      })
    );
    expect(queryFacilitiesByPolygonMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        geometryGeoJson: normalizedGeometryText,
        perspective: "hyperscale",
      })
    );
    expect(queryMarketsBySelectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        geometryGeoJson: normalizedGeometryText,
      })
    );
    expect(listIntersectedCountyIdsMock).toHaveBeenCalledWith(normalizedGeometryText);
    if (!result.ok) {
      throw new Error("Expected successful summary query with repaired geometry");
    }
    expect(result.value.warnings).toContainEqual({
      code: "POLYGON_GEOMETRY_REPAIRED",
      message: "analysis selection:Self-intersection",
    });
  });

  it("clamps facilities summary queries to the canonical max rows", async () => {
    queryMarketsBySelectionMock.mockResolvedValue(createMarketsSelectionResult());
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: false,
      value: {
        error: new Error("status unavailable"),
        reason: "source_unavailable",
      },
    });
    queryCountyScoresMock.mockResolvedValue({
      ok: true,
      value: {
        blockedCountyIds: [],
        dataVersion: "2026-03-07",
        deferredCountyIds: [],
        missingCountyIds: [],
        requestedCountyIds: ["48453"],
        rows: [],
      },
    });
    getMarketBoundarySourceVersionMock.mockResolvedValue("derived-market-boundaries-v1");

    const result = await querySpatialAnalysisSummary(
      {
        expectedParcelIngestionRunId: null,
        request: {
          ...createRequest(),
          limitPerPerspective: 100_000,
        },
      },
      createPorts()
    );

    expect(result.ok).toBe(true);
    expect(queryFacilitiesByPolygonMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        limit: 5000,
        perspective: "colocation",
      })
    );
    expect(queryFacilitiesByPolygonMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        limit: 5000,
        perspective: "hyperscale",
      })
    );
    if (!result.ok) {
      throw new Error("Expected successful summary query with clamped facilities limits");
    }
    expect(result.value.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(["COLOCATION_LIMIT_CLAMPED", "HYPERSCALE_LIMIT_CLAMPED"])
    );
  });

  it("caps parcel accumulation in analysis summary responses", async () => {
    const parcelFeatures = Array.from({ length: 20_000 }, (_, index) =>
      createParcelFeature(`parcel-${String(index).padStart(5, "0")}`)
    );

    queryMarketsBySelectionMock.mockResolvedValue(createMarketsSelectionResult());
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: false,
      value: {
        error: new Error("status unavailable"),
        reason: "source_unavailable",
      },
    });
    queryCountyScoresMock.mockResolvedValue({
      ok: true,
      value: {
        blockedCountyIds: [],
        dataVersion: "2026-03-07",
        deferredCountyIds: [],
        missingCountyIds: [],
        requestedCountyIds: ["48453"],
        rows: [],
      },
    });
    getMarketBoundarySourceVersionMock.mockResolvedValue("derived-market-boundaries-v1");
    enrichParcelsByPolygonMock.mockResolvedValue([{}]);
    mapParcelRowsToFeaturesMock.mockReturnValue(parcelFeatures);
    paginateEnrichFeaturesMock.mockReturnValue({
      features: parcelFeatures,
      hasMore: true,
      nextCursor: "parcel-19999",
    });

    const result = await querySpatialAnalysisSummary(
      {
        expectedParcelIngestionRunId: null,
        request: {
          ...createRequest(),
          includeParcels: true,
        },
      },
      createPorts()
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful summary query with parcel cap");
    }
    expect(result.value.summary.parcelSelection.count).toBe(20_000);
    expect(result.value.summary.parcelSelection.truncated).toBe(true);
    expect(result.value.summary.parcelSelection.nextCursor).toBe("parcel-19999");
    expect(result.value.warnings).toContainEqual({
      code: "PARCELS_TOTAL_CAP_REACHED",
      message:
        "Parcel analysis summary is capped at 20000 parcels; use the parcels API for full pagination.",
    });
  });
});
