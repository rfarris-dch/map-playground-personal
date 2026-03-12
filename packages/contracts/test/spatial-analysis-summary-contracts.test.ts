import { describe, expect, it } from "bun:test";
import { SpatialAnalysisSummaryRequestSchema, SpatialAnalysisSummaryResponseSchema } from "@/index";

describe("spatial analysis summary contracts", () => {
  it("defaults includeFlood to true", () => {
    const parsed = SpatialAnalysisSummaryRequestSchema.parse({
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
    });

    expect(parsed.includeFlood).toBe(true);
  });

  it("accepts flood-aware summary payloads", () => {
    const parsed = SpatialAnalysisSummaryResponseSchema.safeParse({
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
    });

    expect(parsed.success).toBe(true);
  });
});
