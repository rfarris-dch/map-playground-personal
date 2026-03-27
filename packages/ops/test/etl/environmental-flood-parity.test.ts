import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import {
  buildEnvironmentalFloodParityDatasetSql,
  buildEnvironmentalFloodParityGroupSql,
  buildEnvironmentalFloodParityTargetSpecs,
} from "../../src/etl/environmental-flood-parity";

describe("buildEnvironmentalFloodParityTargetSpecs", () => {
  it("resolves overlay-specific geopackage paths and overlay kinds", () => {
    const specs = buildEnvironmentalFloodParityTargetSpecs({
      outputRoot: "/tmp/environmental-flood-tiles/full-us-fema-direct-20260311T160200Z",
      overlayKinds: ["100", "500"],
    });

    expect(specs).toEqual([
      {
        gpkgPath: join(
          "/tmp/environmental-flood-tiles/full-us-fema-direct-20260311T160200Z",
          "flood-overlay-100.gpkg"
        ),
        name: "flood_overlay_100",
        overlayKind: "100",
      },
      {
        gpkgPath: join(
          "/tmp/environmental-flood-tiles/full-us-fema-direct-20260311T160200Z",
          "flood-overlay-500.gpkg"
        ),
        name: "flood_overlay_500",
        overlayKind: "500",
      },
    ]);
  });
});

describe("buildEnvironmentalFloodParityDatasetSql", () => {
  it("compares grouped canonical flood coverage from postgres and geopackage handoff", () => {
    const sql = buildEnvironmentalFloodParityDatasetSql({
      databaseUrl: "postgresql://example.test/map",
      gpkgPath: "/tmp/flood-overlay-100.gpkg",
      overlayKind: "100",
      runId: "full-us-fema-direct-20260311T160200Z",
    });

    expect(sql).toContain("ATTACH 'postgresql://example.test/map' AS flood_pg (TYPE POSTGRES);");
    expect(sql).toContain("FROM environmental_current.flood_hazard");
    expect(sql).toContain("AND is_flood_100");
    expect(sql).toContain("COALESCE(dfirm_id, 'unknown') AS dfirm_id");
    expect(sql).toContain("WHEN flood_band IN ('100', 'flood-100') THEN '100'");
    expect(sql).toContain("WHEN legend_key IN ('100', 'flood-100') THEN 'flood-100'");
    expect(sql).toContain("ST_Read('/tmp/flood-overlay-100.gpkg', layer = 'flood_overlay')");
    expect(sql).toContain("WITH postgres_groups AS");
    expect(sql).toContain("COUNT(*)::BIGINT AS group_count");
    expect(sql).toContain("MIN(ST_XMin(geom)) AS min_xmin");
    expect(sql).toContain("MAX(ST_YMax(geom)) AS max_ymax");
  });
});

describe("buildEnvironmentalFloodParityGroupSql", () => {
  it("builds per-group exact-coverage comparisons keyed by dfirm and legend", () => {
    const sql = buildEnvironmentalFloodParityGroupSql({
      databaseUrl: "postgresql://example.test/map",
      gpkgPath: "/tmp/flood-overlay-500.gpkg",
      overlayKind: "500",
      runId: "full-us-fema-direct-20260311T160200Z",
    });

    expect(sql).toContain("FROM environmental_current.flood_hazard");
    expect(sql).toContain("AND is_flood_500");
    expect(sql).toContain("WHEN flood_band IN ('500', 'flood-500') THEN '500'");
    expect(sql).toContain("WHEN legend_key IN ('500', 'flood-500') THEN 'flood-500'");
    expect(sql).toContain("ST_MemUnion_Agg(geom)");
    expect(sql).toContain("FULL OUTER JOIN geopackage_groups");
    expect(sql).toContain("ST_Area(ST_Difference(postgres_groups.geom, geopackage_groups.geom))");
    expect(sql).toContain("ST_Area(ST_Difference(geopackage_groups.geom, postgres_groups.geom))");
    expect(sql).toContain("ELSE 1::BIGINT");
    expect(sql).toContain("ORDER BY");
  });
});
