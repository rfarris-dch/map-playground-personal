import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type {
  CountyPowerStoryGeometryFeature,
  CountyPowerStoryRow,
  CountyPowerStoryTimelineFrame,
} from "@map-migration/http-contracts/county-power-story-http";

const queryCountyPowerStoryGeometryMock =
  mock<
    () => Promise<
      | {
          readonly ok: true;
          readonly value: {
            readonly features: readonly CountyPowerStoryGeometryFeature[];
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

const queryCountyPowerStorySnapshotMock =
  mock<
    (args: {
      readonly publicationRunId?: string | undefined;
      readonly storyId: "grid-stress" | "market-structure" | "policy-watch" | "queue-pressure";
      readonly window: "30d" | "60d" | "90d" | "live";
    }) => Promise<
      | {
          readonly ok: true;
          readonly value: {
            readonly dataVersion: string | null;
            readonly formulaVersion: string | null;
            readonly inputDataVersion: string | null;
            readonly publicationRunId: string | null;
            readonly publishedAt: string | null;
            readonly rows: readonly CountyPowerStoryRow[];
            readonly storyId:
              | "grid-stress"
              | "market-structure"
              | "policy-watch"
              | "queue-pressure";
            readonly window: "30d" | "60d" | "90d" | "live";
          };
        }
      | {
          readonly ok: false;
          readonly value: {
            readonly error: unknown;
            readonly reason:
              | "mapping_failed"
              | "publication_run_not_found"
              | "query_failed"
              | "source_unavailable";
          };
        }
    >
  >();

const queryCountyPowerStoryTimelineMock =
  mock<
    (args: {
      readonly publicationRunId?: string | undefined;
      readonly storyId: "grid-stress" | "market-structure" | "policy-watch" | "queue-pressure";
    }) => Promise<
      | {
          readonly ok: true;
          readonly value: {
            readonly dataVersion: string | null;
            readonly formulaVersion: string | null;
            readonly frames: readonly CountyPowerStoryTimelineFrame[];
            readonly inputDataVersion: string | null;
            readonly publicationRunId: string | null;
            readonly publishedAt: string | null;
            readonly storyId:
              | "grid-stress"
              | "market-structure"
              | "policy-watch"
              | "queue-pressure";
          };
        }
      | {
          readonly ok: false;
          readonly value: {
            readonly error: unknown;
            readonly reason:
              | "mapping_failed"
              | "publication_run_not_found"
              | "query_failed"
              | "source_unavailable";
          };
        }
    >
  >();

const queryCountyPowerStoryVectorTileMock =
  mock<
    (args: { readonly x: number; readonly y: number; readonly z: number }) => Promise<
      | {
          readonly ok: true;
          readonly value: {
            readonly tile: Uint8Array;
          };
        }
      | {
          readonly ok: false;
          readonly value: {
            readonly error: unknown;
            readonly reason: "query_failed" | "source_unavailable";
          };
        }
    >
  >();

mock.module("../../../src/geo/county-power-story/county-power-story.service", () => ({
  queryCountyPowerStoryGeometry: queryCountyPowerStoryGeometryMock,
  queryCountyPowerStorySnapshot: queryCountyPowerStorySnapshotMock,
  queryCountyPowerStoryTimeline: queryCountyPowerStoryTimelineMock,
  queryCountyPowerStoryVectorTile: queryCountyPowerStoryVectorTileMock,
}));

const { createApiApp } = await import("@/app");

afterAll(() => {
  mock.restore();
});

function createGeometryFeature(): CountyPowerStoryGeometryFeature {
  return {
    type: "Feature",
    id: "48453",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-98, 30],
          [-97, 30],
          [-97, 31],
          [-98, 30],
        ],
      ],
    },
    properties: {
      centroid: [-97.7431, 30.2672],
      countyFips: "48453",
      countyName: "Travis County",
      stateAbbrev: "TX",
    },
  };
}

function createStoryRow(): CountyPowerStoryRow {
  return {
    countyFips: "48453",
    countyName: "Travis County",
    stateAbbrev: "TX",
    avgRtCongestionComponent: 4.8,
    isSeamCounty: false,
    marketStructure: "organized_market",
    moratoriumStatus: "watch",
    negativePriceHourShare: 0.06,
    p95ShadowPrice: 29.4,
    policyEventCount: 4,
    policyMomentumScore: 12.5,
    queueAvgAgeDays: 550,
    queueMwActive: 480,
    queueProjectCountActive: 11,
    wholesaleOperator: "ERCOT",
    activityScore: 0.62,
    band: "high",
    categoryKey: "warm",
    direction: "warm",
    normalizedScore: 0.74,
    outlineIntensity: 0.53,
    pulseAmplitude: 0.67,
    seed: 0.31,
  };
}

function requestFromLoopback(
  app: ReturnType<typeof createApiApp>,
  path: string
): Promise<Response> {
  return app.request(path, {
    headers: {
      host: "localhost",
    },
  });
}

describe("county power story route", () => {
  beforeEach(() => {
    queryCountyPowerStoryGeometryMock.mockReset();
    queryCountyPowerStorySnapshotMock.mockReset();
    queryCountyPowerStoryTimelineMock.mockReset();
    queryCountyPowerStoryVectorTileMock.mockReset();
  });

  it("returns 400 for an invalid story id", async () => {
    const app = createApiApp();

    const response = await requestFromLoopback(app, "/api/geo/county-power/story/not-a-story");
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("INVALID_COUNTY_POWER_STORY_REQUEST");
  });

  it("returns county power story geometry", async () => {
    const app = createApiApp();
    queryCountyPowerStoryGeometryMock.mockResolvedValue({
      ok: true,
      value: {
        features: [createGeometryFeature()],
      },
    });

    const response = await requestFromLoopback(app, "/api/geo/county-power/story/geometry");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.features).toHaveLength(1);
    expect(payload.features[0].id).toBe("48453");
    expect(payload.meta.recordCount).toBe(1);
  });

  it("returns county power story vector tiles", async () => {
    const app = createApiApp();
    queryCountyPowerStoryVectorTileMock.mockResolvedValue({
      ok: true,
      value: {
        tile: new Uint8Array([0x1f, 0x8b, 0x08]),
      },
    });

    const response = await requestFromLoopback(app, "/api/geo/county-power/story/tiles/4/3/6");
    const body = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/vnd.mapbox-vector-tile");
    expect([...body]).toEqual([0x1f, 0x8b, 0x08]);
    expect(queryCountyPowerStoryVectorTileMock).toHaveBeenCalledWith({
      z: 4,
      x: 3,
      y: 6,
    });
  });

  it("returns a county power story snapshot", async () => {
    const app = createApiApp();
    queryCountyPowerStorySnapshotMock.mockResolvedValue({
      ok: true,
      value: {
        dataVersion: "2026-03-23",
        formulaVersion: "county-market-pressure-v2",
        inputDataVersion: "county-market-pressure-public-us-20260323t224500z",
        publicationRunId: "county-market-pressure-county-power-public-us-20260323t224500z",
        publishedAt: "2026-03-23T22:45:00.000Z",
        rows: [createStoryRow()],
        storyId: "grid-stress",
        window: "live",
      },
    });

    const response = await requestFromLoopback(
      app,
      "/api/geo/county-power/story/grid-stress?window=live"
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.storyId).toBe("grid-stress");
    expect(payload.window).toBe("live");
    expect(payload.rows).toHaveLength(1);
    expect(payload.rows[0].countyFips).toBe("48453");
  });

  it("returns a county power story timeline", async () => {
    const app = createApiApp();
    const row = createStoryRow();
    queryCountyPowerStoryTimelineMock.mockResolvedValue({
      ok: true,
      value: {
        dataVersion: "2026-03-23",
        formulaVersion: "county-market-pressure-v2",
        inputDataVersion: "county-market-pressure-public-us-20260323t224500z",
        publicationRunId: "county-market-pressure-county-power-public-us-20260323t224500z",
        publishedAt: "2026-03-23T22:45:00.000Z",
        storyId: "grid-stress",
        frames: [
          {
            window: "live",
            rows: [
              {
                countyFips: row.countyFips,
                activityScore: row.activityScore,
                band: row.band,
                categoryKey: row.categoryKey,
                direction: row.direction,
                normalizedScore: row.normalizedScore,
                outlineIntensity: row.outlineIntensity,
                pulseAmplitude: row.pulseAmplitude,
                seed: row.seed,
              },
            ],
          },
        ],
      },
    });

    const response = await requestFromLoopback(
      app,
      "/api/geo/county-power/story/grid-stress/timeline"
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.storyId).toBe("grid-stress");
    expect(payload.frames).toHaveLength(1);
    expect(payload.frames[0].window).toBe("live");
  });
});
