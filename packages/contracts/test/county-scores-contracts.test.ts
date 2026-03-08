import { describe, expect, it } from "bun:test";
import {
  CountyScoreSchema,
  CountyScoresResponseSchema,
  CountyScoresStatusResponseSchema,
} from "@/index";

describe("county score contracts", () => {
  it("accepts a valid county score row", () => {
    const parsed = CountyScoreSchema.safeParse({
      countyFips: "06085",
      countyName: "Santa Clara",
      stateAbbrev: "CA",
      scoreStatus: "scored",
      compositeScore: 82.4,
      demandScore: 76.1,
      generationScore: 88.5,
      policyScore: 61.2,
      formulaVersion: "v1",
      inputDataVersion: "2026-03-07",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid county fips values", () => {
    const parsed = CountyScoreSchema.safeParse({
      countyFips: "6085",
      countyName: "Santa Clara",
      stateAbbrev: "CA",
      scoreStatus: "scored",
      compositeScore: 82.4,
      demandScore: 76.1,
      generationScore: 88.5,
      policyScore: 61.2,
      formulaVersion: "v1",
      inputDataVersion: "2026-03-07",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts nullable component scores and missing county summary state", () => {
    const parsed = CountyScoresResponseSchema.safeParse({
      rows: [
        {
          countyFips: "06085",
          countyName: "Santa Clara",
          stateAbbrev: "CA",
          scoreStatus: "unavailable",
          compositeScore: null,
          demandScore: null,
          generationScore: 88.5,
          policyScore: null,
          formulaVersion: null,
          inputDataVersion: null,
        },
      ],
      summary: {
        requestedCountyIds: ["06085", "48113"],
        missingCountyIds: ["48113"],
        unavailableCountyIds: [],
      },
      meta: {
        requestId: "req-123",
        sourceMode: "postgis",
        dataVersion: "dev",
        generatedAt: "2026-03-07T00:00:00.000Z",
        recordCount: 1,
        truncated: false,
        warnings: [],
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts county score dataset status responses", () => {
    const parsed = CountyScoresStatusResponseSchema.safeParse({
      datasetAvailable: true,
      publicationRunId: "county-scores-20260307T000000Z",
      publishedAt: "2026-03-07T00:00:00.000Z",
      methodologyId: "county-intelligence-alpha-v1",
      dataVersion: "2026-03-07",
      inputDataVersion:
        "facilities=2026-03-07;hyperscale=2026-03-07;water=mirror.water_stress_basins",
      formulaVersion: "county-scores-alpha-v1",
      rowCount: 3221,
      sourceCountyCount: 3221,
      scoredCountyCount: 3221,
      waterCoverageCount: 3221,
      availableFeatureFamilies: ["facilities", "hyperscale", "water_stress"],
      missingFeatureFamilies: ["hazards", "terrain"],
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
        waterStress: true,
      },
      meta: {
        requestId: "req-123",
        sourceMode: "postgis",
        dataVersion: "2026-03-07",
        generatedAt: "2026-03-07T00:00:00.000Z",
        recordCount: 1,
        truncated: false,
        warnings: [],
      },
    });

    expect(parsed.success).toBe(true);
  });
});
