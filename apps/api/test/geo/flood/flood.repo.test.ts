import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const runQueryMock = mock(async () => []);

mock.module("@/db/postgres", () => ({
  runQuery: runQueryMock,
}));

const { queryFloodAreaSummary, queryFloodParcelRollup } = await import(
  "../../../src/geo/flood/flood.repo"
);

describe("flood repo", () => {
  beforeEach(() => {
    runQueryMock.mockReset();
    runQueryMock.mockResolvedValue([]);
  });

  afterAll(() => {
    mock.restore();
  });

  it("queries flood parcel rollups from canonical parcel tables in SQL", async () => {
    const geometryGeoJson =
      '{"type":"Polygon","coordinates":[[[-97.8,30.2],[-97.7,30.2],[-97.7,30.3],[-97.8,30.2]]]}';

    await queryFloodParcelRollup(geometryGeoJson);

    expect(runQueryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = runQueryMock.mock.calls[0] ?? [];

    expect(typeof sql).toBe("string");
    expect(sql).toContain("FROM parcel_current.parcels AS parcel");
    expect(sql).toContain("LEFT JOIN environmental_current.flood_hazard AS flood");
    expect(sql).toContain("ST_Intersects(parcel.geom_3857, selection.geom_3857)");
    expect(params).toEqual([geometryGeoJson]);
  });

  it("queries flood area summaries from the canonical flood hazard table", async () => {
    const geometryGeoJson =
      '{"type":"Polygon","coordinates":[[[-97.8,30.2],[-97.7,30.2],[-97.7,30.3],[-97.8,30.2]]]}';

    await queryFloodAreaSummary(geometryGeoJson);

    expect(runQueryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = runQueryMock.mock.calls[0] ?? [];

    expect(typeof sql).toBe("string");
    expect(sql).toContain("FROM environmental_current.flood_hazard");
    expect(sql).toContain("ST_Intersection(flood.geom_3857, selection.geom_3857)");
    expect(params).toEqual([geometryGeoJson]);
  });
});
