import { describe, expect, it } from "bun:test";
import {
  mapFacilitiesRowsToFeatures,
  mapFacilityDetailRowToFeature,
} from "@/geo/facilities/facilities.mapper";
import type { FacilitiesBboxRow, FacilityDetailRow } from "@/geo/facilities/facilities.repo";

function buildBboxRow(overrides: Partial<FacilitiesBboxRow> = {}): FacilitiesBboxRow {
  return {
    facility_id: "facility-1",
    facility_name: "Austin Alpha",
    geom_json: { type: "Point", coordinates: [-97.7431, 30.2672] },
    provider_id: "provider-1",
    provider_name: "Provider One",
    county_fips: "48453",
    commissioned_power_mw: "55.5",
    commissioned_semantic: "operational",
    lease_or_own: "own",
    ...overrides,
  };
}

function buildDetailRow(overrides: Partial<FacilityDetailRow> = {}): FacilityDetailRow {
  return {
    facility_id: "facility-1",
    facility_name: "Austin Alpha",
    geom_json: { type: "Point", coordinates: [-97.7431, 30.2672] },
    provider_id: "provider-1",
    provider_name: "Provider One",
    county_fips: "48453",
    commissioned_semantic: "operational",
    lease_or_own: "own",
    commissioned_power_mw: "120.5",
    planned_power_mw: "25",
    under_construction_power_mw: 40,
    available_power_mw: null,
    ...overrides,
  };
}

describe("facilities mapper", () => {
  it("maps bbox rows to contract features", () => {
    const rows: FacilitiesBboxRow[] = [buildBboxRow()];

    const features = mapFacilitiesRowsToFeatures(rows, "colocation");

    expect(features).toHaveLength(1);
    const first = features[0];
    if (!first) {
      throw new Error("Expected mapped feature");
    }
    expect(first.id).toBe("facility-1");
    expect(first.geometry.type).toBe("Point");
    expect(first.geometry.coordinates).toEqual([-97.7431, 30.2672]);
    expect(first.properties.perspective).toBe("colocation");
    expect(first.properties.facilityName).toBe("Austin Alpha");
    expect(first.properties.providerId).toBe("provider-1");
    expect(first.properties.providerName).toBe("Provider One");
    expect(first.properties.countyFips).toBe("48453");
    expect(first.properties.commissionedPowerMw).toBe(55.5);
    expect(first.properties.commissionedSemantic).toBe("operational");
    expect(first.properties.leaseOrOwn).toBe("own");
  });

  it("maps detail rows and normalizes nullable numeric fields", () => {
    const row = buildDetailRow({
      available_power_mw: "not-a-number",
      planned_power_mw: "",
      commissioned_semantic: "under_construction",
    });

    const feature = mapFacilityDetailRowToFeature(row, "hyperscale");

    expect(feature.properties.perspective).toBe("hyperscale");
    expect(feature.properties.facilityName).toBe("Austin Alpha");
    expect(feature.properties.providerName).toBe("Provider One");
    expect(feature.properties.commissionedSemantic).toBe("under_construction");
    expect(feature.properties.commissionedPowerMw).toBe(120.5);
    expect(feature.properties.underConstructionPowerMw).toBe(40);
    expect(feature.properties.availablePowerMw).toBeNull();
    expect(feature.properties.plannedPowerMw).toBeNull();
  });

  it("throws when geometry is not a point", () => {
    const rows: FacilitiesBboxRow[] = [
      buildBboxRow({
        geom_json: { type: "LineString", coordinates: [] },
      }),
    ];

    expect(() => mapFacilitiesRowsToFeatures(rows, "colocation")).toThrow(
      "Invalid geom_json: Array must contain at least 2 element(s)"
    );
  });

  it("throws when required provider fields are missing", () => {
    const rows: FacilitiesBboxRow[] = [
      buildBboxRow({
        provider_id: null,
        provider_name: null,
      }),
    ];

    expect(() => mapFacilitiesRowsToFeatures(rows, "colocation")).toThrow(
      "Invalid facilities row: provider_name is required"
    );
  });
});
