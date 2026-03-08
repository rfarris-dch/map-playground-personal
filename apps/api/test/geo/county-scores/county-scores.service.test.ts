import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { CountyScore } from "@map-migration/contracts";

mock.restore();

const listCountyScoresMock = mock<(countyIds: readonly string[]) => Promise<readonly unknown[]>>();
const mapCountyScoreRowMock = mock<(row: unknown) => CountyScore>();
const getCountyScoresStatusSnapshotMock = mock<() => Promise<unknown>>();

mock.module("@/geo/county-scores/county-scores.repo", () => ({
  getCountyScoresStatusSnapshot: getCountyScoresStatusSnapshotMock,
  listCountyScores: listCountyScoresMock,
}));

mock.module("@/geo/county-scores/county-scores.mapper", () => ({
  mapCountyScoreRow: mapCountyScoreRowMock,
}));

const { queryCountyScores, queryCountyScoresStatus } = await import(
  "@/geo/county-scores/county-scores.service"
);

afterAll(() => {
  mock.restore();
});

function createPublishedStatusRow() {
  return {
    publication_run_id: "county-scores-20260307T000000Z",
    publication_status: "published",
    published_at: "2026-03-07T00:00:00.000Z",
    methodology_id: "county-intelligence-alpha-v1",
    data_version: "2026-03-06",
    input_data_version:
      "facilities=2026-03-07;hyperscale=2026-03-07;water=mirror.water_stress_basins",
    formula_version: "county-scores-alpha-v1",
    score_row_count: 3221,
    metrics_row_count: 3221,
    source_county_count: 3221,
    scored_county_count: 3221,
    water_coverage_count: 3221,
    available_feature_families: ["facilities", "hyperscale", "water_stress"],
    missing_feature_families: ["hazards", "terrain"],
  };
}

describe("queryCountyScores", () => {
  beforeEach(() => {
    getCountyScoresStatusSnapshotMock.mockReset();
    listCountyScoresMock.mockReset();
    mapCountyScoreRowMock.mockReset();
    getCountyScoresStatusSnapshotMock.mockResolvedValue(createPublishedStatusRow());
  });

  it("returns sorted mapped rows and missing county ids", async () => {
    listCountyScoresMock.mockResolvedValue([
      {
        county_fips: "06085",
        data_version: "2026-03-07",
        has_county_reference: true,
        has_county_score: true,
      },
      {
        county_fips: "48113",
        data_version: null,
        has_county_reference: true,
        has_county_score: false,
      },
      {
        county_fips: "01001",
        data_version: null,
        has_county_reference: false,
        has_county_score: false,
      },
    ]);
    mapCountyScoreRowMock
      .mockReturnValueOnce({
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
      })
      .mockReturnValueOnce({
        countyFips: "48113",
        countyName: "Dallas",
        stateAbbrev: "TX",
        scoreStatus: "unavailable",
        compositeScore: 70.1,
        demandScore: 69.3,
        generationScore: 71.2,
        policyScore: 68.2,
        formulaVersion: null,
        inputDataVersion: null,
      });

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
    expect(result.value.unavailableCountyIds).toEqual(["48113"]);
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
      new Error('relation "analytics.county_scores_v1" does not exist')
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
        data_version: "2026-03-07",
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
      score_row_count: 0,
      metrics_row_count: 0,
      source_county_count: 3221,
      scored_county_count: null,
      water_coverage_count: null,
      available_feature_families: [],
      missing_feature_families: [],
    });
    listCountyScoresMock.mockResolvedValue([
      {
        county_fips: "06085",
        data_version: "2026-03-07",
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
    expect(result.value.publicationRunId).toBe("county-scores-20260307T000000Z");
    expect(result.value.methodologyId).toBe("county-intelligence-alpha-v1");
    expect(result.value.rowCount).toBe(3221);
    expect(result.value.availableFeatureFamilies).toEqual([
      "facilities",
      "hyperscale",
      "water_stress",
    ]);
    expect(result.value.featureCoverage.facilities).toBe(true);
    expect(result.value.featureCoverage.hazards).toBe(false);
    expect(result.value.missingFeatureFamilies).toEqual(["hazards", "terrain"]);
  });

  it("returns source_unavailable when county score status relations are missing", async () => {
    getCountyScoresStatusSnapshotMock.mockRejectedValue(
      new Error('relation "analytics_meta.county_score_publications" does not exist')
    );

    const result = await queryCountyScoresStatus();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected unavailable county score status dataset");
    }

    expect(result.value.reason).toBe("source_unavailable");
  });
});
