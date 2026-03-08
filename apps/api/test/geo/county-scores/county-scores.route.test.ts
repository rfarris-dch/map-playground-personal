import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { CountyScore } from "@map-migration/contracts";

const queryCountyScoresMock =
  mock<
    (args: { countyIds: readonly string[] }) => Promise<
      | {
          readonly ok: true;
          readonly value: {
            readonly dataVersion: string;
            readonly rows: readonly CountyScore[];
            readonly missingCountyIds: readonly string[];
            readonly requestedCountyIds: readonly string[];
            readonly unavailableCountyIds: readonly string[];
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
            readonly scoredCountyCount: number;
            readonly waterCoverageCount: number;
            readonly availableFeatureFamilies: readonly string[];
            readonly missingFeatureFamilies: readonly string[];
            readonly featureCoverage: {
              readonly enterprise: boolean;
              readonly facilities: boolean;
              readonly fiber: boolean;
              readonly hazards: boolean;
              readonly hyperscale: boolean;
              readonly policy: boolean;
              readonly terrain: boolean;
              readonly transmission: boolean;
              readonly utilityTerritory: boolean;
              readonly waterStress: boolean;
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

mock.module("../../../src/geo/county-scores/county-scores.service", () => ({
  queryCountyScores: queryCountyScoresMock,
  queryCountyScoresStatus: queryCountyScoresStatusMock,
}));

const { createApiApp } = await import("@/app");

afterAll(() => {
  mock.restore();
});

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
        dataVersion: "2026-03-07",
        rows: [
          {
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
          },
        ],
        missingCountyIds: ["48113"],
        requestedCountyIds: ["06085", "48113"],
        unavailableCountyIds: [],
      },
    });

    const response = await app.request("/api/geo/counties/scores?countyIds=06085,48113");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.rows).toHaveLength(1);
    expect(payload.summary.missingCountyIds).toEqual(["48113"]);
    expect(payload.summary.unavailableCountyIds).toEqual([]);
    expect(payload.meta.dataVersion).toBe("2026-03-07");
    expect(payload.meta.recordCount).toBe(1);
  });

  it("returns 503 when the county score dataset is unavailable", async () => {
    const app = createApiApp();
    queryCountyScoresMock.mockResolvedValue({
      ok: false,
      value: {
        reason: "source_unavailable",
        error: new Error('relation "analytics.county_scores_v1" does not exist'),
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
      },
    });

    const response = await app.request("/api/geo/counties/scores/status");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.datasetAvailable).toBe(true);
    expect(payload.meta.dataVersion).toBe("2026-03-07");
    expect(payload.rowCount).toBe(3221);
    expect(payload.availableFeatureFamilies).toEqual(["facilities", "hyperscale", "water_stress"]);
    expect(payload.featureCoverage.waterStress).toBe(true);
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
        scoredCountyCount: 0,
        waterCoverageCount: 0,
        availableFeatureFamilies: [],
        missingFeatureFamilies: [],
        featureCoverage: {
          enterprise: false,
          facilities: false,
          fiber: false,
          hazards: false,
          hyperscale: false,
          policy: false,
          terrain: false,
          transmission: false,
          utilityTerritory: false,
          waterStress: false,
        },
      },
    });

    const response = await app.request("/api/geo/counties/scores/status");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.datasetAvailable).toBe(false);
    expect(payload.meta.dataVersion).toBe("unpublished");
  });

  it("returns 503 when county score status is unavailable", async () => {
    const app = createApiApp();
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: false,
      value: {
        reason: "source_unavailable",
        error: new Error('relation "analytics_meta.county_score_publications" does not exist'),
      },
    });

    const response = await app.request("/api/geo/counties/scores/status");
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe("COUNTY_SCORES_STATUS_SOURCE_UNAVAILABLE");
  });
});
