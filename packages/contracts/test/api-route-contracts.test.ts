import { describe, expect, it } from "bun:test";
import {
  ApiQueryDefaults,
  buildCountyScoresRoute,
  buildCountyScoresStatusRoute,
  buildFacilitiesBboxRoute,
  buildFacilityDetailRoute,
  buildParcelDetailRoute,
  buildSpatialAnalysisSummaryRoute,
} from "@/index";

describe("api route contracts", () => {
  it("builds facilities bbox routes with shared defaults", () => {
    const route = buildFacilitiesBboxRoute({
      bbox: {
        west: -97.9,
        south: 30.1,
        east: -97.6,
        north: 30.5,
      },
    });

    expect(route).toBe(
      "/api/geo/facilities?bbox=-97.9%2C30.1%2C-97.6%2C30.5&perspective=colocation"
    );
  });

  it("builds facility detail routes with the provided perspective", () => {
    const route = buildFacilityDetailRoute("facility-123", {
      perspective: "hyperscale",
    });

    expect(route).toBe("/api/geo/facilities/facility-123?perspective=hyperscale");
  });

  it("builds parcel detail routes with shared defaults", () => {
    const route = buildParcelDetailRoute("parcel-123");

    expect(route).toBe(
      `/api/geo/parcels/parcel-123?profile=${ApiQueryDefaults.parcelDetail.profile}&includeGeometry=${ApiQueryDefaults.parcelDetail.includeGeometry}`
    );
  });

  it("builds parcel detail routes with explicit overrides", () => {
    const route = buildParcelDetailRoute("parcel-123", {
      profile: "analysis_v1",
      includeGeometry: "centroid",
    });

    expect(route).toBe("/api/geo/parcels/parcel-123?profile=analysis_v1&includeGeometry=centroid");
  });

  it("builds county score routes with explicit county ids", () => {
    const route = buildCountyScoresRoute({
      countyIds: ["06085", "48113"],
    });

    expect(route).toBe("/api/geo/counties/scores?countyIds=06085%2C48113");
  });

  it("builds county score status routes", () => {
    const route = buildCountyScoresStatusRoute();

    expect(route).toBe("/api/geo/counties/scores/status");
  });

  it("builds spatial analysis summary routes", () => {
    const route = buildSpatialAnalysisSummaryRoute();

    expect(route).toBe("/api/geo/analysis/summary");
  });
});
