import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { ParcelAoi, ParcelGeometryMode } from "@map-migration/contracts";
import { Hono } from "hono";

const enrichParcelsByBboxMock =
  mock<(bbox: unknown, options: unknown) => Promise<readonly unknown[]>>();
const enrichParcelsByPolygonMock =
  mock<(geometryGeoJson: string, options: unknown) => Promise<readonly unknown[]>>();
const enrichParcelsByCountyMock =
  mock<(geoid: string, options: unknown) => Promise<readonly unknown[]>>();
const normalizePolygonGeometryGeoJsonMock =
  mock<
    (geometryGeoJson: string) => Promise<{
      readonly geometryText: string;
      readonly invalidReason: string | null;
      readonly wasRepaired: boolean;
    }>
  >();

mock.module("../../../src/geo/parcels/parcels.repo", () => ({
  enrichParcelsByBbox: enrichParcelsByBboxMock,
  enrichParcelsByPolygon: enrichParcelsByPolygonMock,
  enrichParcelsByCounty: enrichParcelsByCountyMock,
}));

mock.module("../../../src/http/polygon-normalization.service", () => ({
  buildPolygonRepairWarning: (scope: string, invalidReason: string | null) => ({
    code: "POLYGON_GEOMETRY_REPAIRED",
    message: `${scope}:${invalidReason ?? "none"}`,
  }),
  normalizePolygonGeometryGeoJson: normalizePolygonGeometryGeoJsonMock,
}));

const { queryEnrichRowsByAoi } = await import(
  "@/geo/parcels/route/parcels-route-aoi-query.service"
);

afterAll(() => {
  mock.restore();
});

function callAoiQuery(aoi: ParcelAoi): Promise<Response> {
  const app = new Hono();
  const includeGeometry: ParcelGeometryMode = "none";

  app.get("/test", async (c) => {
    const result = await queryEnrichRowsByAoi(c, "req-test", aoi, includeGeometry, 10, null);
    if (result.ok) {
      return c.json({
        rowCount: result.rows.length,
      });
    }

    return result.response;
  });

  return app.request("/test");
}

describe("parcels route AOI query service", () => {
  beforeEach(() => {
    enrichParcelsByBboxMock.mockReset();
    enrichParcelsByPolygonMock.mockReset();
    enrichParcelsByCountyMock.mockReset();
    normalizePolygonGeometryGeoJsonMock.mockReset();
    normalizePolygonGeometryGeoJsonMock.mockImplementation(async (geometryText: string) => ({
      geometryText,
      invalidReason: null,
      wasRepaired: false,
    }));
  });

  it("rejects polygon AOIs whose bbox exceeds configured limits", async () => {
    const aoi: ParcelAoi = {
      type: "polygon",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-120, 30],
            [-110, 30],
            [-110, 40],
            [-120, 40],
            [-120, 30],
          ],
        ],
      },
    };

    const response = await callAoiQuery(aoi);
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error.code).toBe("POLICY_REJECTED");
    expect(payload.error.message).toContain("polygon AOI exceeds configured bbox limits");
    expect(enrichParcelsByPolygonMock).not.toHaveBeenCalled();
  });

  it("queries polygon AOIs when bbox is within limits", async () => {
    enrichParcelsByPolygonMock.mockResolvedValue([]);
    const aoi: ParcelAoi = {
      type: "polygon",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-97.8, 30.2],
            [-97.6, 30.2],
            [-97.6, 30.4],
            [-97.8, 30.4],
            [-97.8, 30.2],
          ],
        ],
      },
    };

    const response = await callAoiQuery(aoi);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.rowCount).toBe(0);
    expect(enrichParcelsByPolygonMock).toHaveBeenCalledTimes(1);
  });
});
