import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import { Hono } from "hono";

const getParcelByIdMock = mock();
const lookupParcelsByIdsMock = mock();
const enrichParcelsByBboxMock = mock();
const enrichParcelsByCountyMock = mock();
const enrichParcelsByPolygonMock = mock();

mock.module("../../../src/geo/parcels/parcels.repo", () => ({
  enrichParcelsByBbox: enrichParcelsByBboxMock,
  enrichParcelsByCounty: enrichParcelsByCountyMock,
  enrichParcelsByPolygon: enrichParcelsByPolygonMock,
  getParcelById: getParcelByIdMock,
  lookupParcelsByIds: lookupParcelsByIdsMock,
}));

const { registerParcelDetailRoute } = await import(
  "../../../src/geo/parcels/route/parcel-detail.route"
);

afterAll(() => {
  mock.restore();
});

describe("parcel detail route", () => {
  beforeEach(() => {
    enrichParcelsByBboxMock.mockReset();
    enrichParcelsByCountyMock.mockReset();
    enrichParcelsByPolygonMock.mockReset();
    getParcelByIdMock.mockReset();
    lookupParcelsByIdsMock.mockReset();
  });

  it("returns 404 when the parcel id is not present", async () => {
    getParcelByIdMock.mockResolvedValue([]);

    const app = new Hono();
    registerParcelDetailRoute(app);

    const response = await app.request(
      `${ApiRoutes.parcels}/00000000-0000-0000-0000-000000000000?profile=analysis_v1&includeGeometry=none`
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe("PARCEL_NOT_FOUND");
  });
});
