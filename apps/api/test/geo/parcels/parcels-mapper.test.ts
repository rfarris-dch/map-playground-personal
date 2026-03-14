import { describe, expect, it } from "bun:test";
import { mapParcelRowsToFeatures, mapParcelRowToFeature } from "@/geo/parcels/parcels.mapper";
import type { ParcelRow } from "@/geo/parcels/parcels.repo";

function buildRow(overrides: Partial<ParcelRow> = {}): ParcelRow {
  return {
    parcel_id: "parcel-1",
    source_oid: "12345",
    state2: "tx",
    geoid: "48453",
    source_updated_at: "2026-03-01T00:00:00.000Z",
    ingestion_run_id: "run-1",
    attrs_json: {
      landuse: "industrial",
      owner: "Example Owner",
    },
    geom_json: {
      type: "Polygon",
      coordinates: [
        [
          [-97.8, 30.2],
          [-97.7, 30.2],
          [-97.7, 30.3],
          [-97.8, 30.3],
          [-97.8, 30.2],
        ],
      ],
    },
    ...overrides,
  };
}

describe("parcels mapper", () => {
  it("maps parcel rows into parcel features", () => {
    const features = mapParcelRowsToFeatures([buildRow()]);

    expect(features).toHaveLength(1);
    const first = features[0];
    if (!first) {
      throw new Error("Expected mapped feature");
    }

    expect(first.id).toBe("parcel-1");
    expect(first.properties.parcelId).toBe("parcel-1");
    expect(first.properties.state2).toBe("TX");
    expect(first.properties.geoid).toBe("48453");
    expect(first.lineage.sourceOid).toBe(12_345);
    expect(first.lineage.ingestionRunId).toBe("run-1");
    expect(first.geometry?.type).toBe("Polygon");
  });

  it("supports null geometry and normalizes invalid optional values", () => {
    const feature = mapParcelRowToFeature(
      buildRow({
        geom_json: null,
        source_oid: "not-a-number",
        state2: "TEXAS",
        geoid: "",
        ingestion_run_id: "",
      })
    );

    expect(feature.geometry).toBeNull();
    expect(feature.lineage.sourceOid).toBeNull();
    expect(feature.properties.state2).toBeNull();
    expect(feature.properties.geoid).toBeNull();
    expect(feature.lineage.ingestionRunId).toBeNull();
  });

  it("normalizes negative sourceOid values to null", () => {
    const featureFromNumber = mapParcelRowToFeature(
      buildRow({
        source_oid: -42,
      })
    );
    expect(featureFromNumber.lineage.sourceOid).toBeNull();

    const featureFromString = mapParcelRowToFeature(
      buildRow({
        source_oid: "-17",
      })
    );
    expect(featureFromString.lineage.sourceOid).toBeNull();
  });

  it("throws for invalid geometry payload", () => {
    expect(() =>
      mapParcelRowToFeature(
        buildRow({
          geom_json: {
            coordinates: [],
          },
        })
      )
    ).toThrow("Invalid geometry payload: geometry did not match GeoJSON schema");
  });
});
