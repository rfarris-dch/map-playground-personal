import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildFloodPlanetilerInputSpec,
  buildFloodPlanetilerInputSql,
  buildFloodSubdivisionChunkSql,
  buildHydroPlanetilerInputSpec,
  buildHydroPlanetilerInputSql,
} from "../../src/etl/environmental-planetiler-inputs";

const tempPaths: string[] = [];

function createTempDir(): string {
  const path = mkdtempSync(join(tmpdir(), "environmental-planetiler-inputs-"));
  tempPaths.push(path);
  return path;
}

afterEach(() => {
  while (tempPaths.length > 0) {
    const path = tempPaths.pop();
    if (typeof path === "string") {
      rmSync(path, {
        force: true,
        recursive: true,
      });
    }
  }
});

describe("buildFloodPlanetilerInputSpec", () => {
  it("writes overlay-specific GeoPackage outputs rooted at the tilesource cache", () => {
    const outputRoot = createTempDir();
    const spec = buildFloodPlanetilerInputSpec({
      lakeVersionRootPath: "/tmp/lake/environmental-flood/data_version=2026-03-11",
      outputRoot,
      overlayKinds: ["100", "500"],
    });

    expect(spec.outputs).toEqual([
      {
        outputPath: join(outputRoot, "flood-overlay-100.gpkg"),
        overlayKind: "100",
      },
      {
        outputPath: join(outputRoot, "flood-overlay-500.gpkg"),
        overlayKind: "500",
      },
    ]);
  });
});

describe("buildFloodPlanetilerInputSql", () => {
  it("builds a two-pass flood overlay export from canonical GeoParquet instead of Postgres tables", () => {
    const outputRoot = createTempDir();
    const spec = buildFloodPlanetilerInputSpec({
      lakeVersionRootPath: "/tmp/lake/environmental-flood/data_version=2026-03-11",
      outputRoot,
      overlayKinds: ["100", "500"],
    });

    const sql = buildFloodPlanetilerInputSql(spec);

    expect(sql).toContain(
      "read_parquet('/tmp/lake/environmental-flood/data_version=2026-03-11/flood_band=100/**/part-*.parquet', hive_partitioning = false)"
    );
    expect(sql).toContain(
      "read_parquet('/tmp/lake/environmental-flood/data_version=2026-03-11/flood_band=500/**/part-*.parquet', hive_partitioning = false)"
    );
    expect(sql).toContain("ST_Union_Agg(");
    expect(sql).toContain("ST_Transform(geom, 'EPSG:4326', 'EPSG:3857', true)");
    expect(sql).toContain("hash(COALESCE(dfirm_id, 'unknown')) % 64 AS bucket_id");
    expect(sql).toContain("PARTITION_BY (bucket_id)");
    expect(sql).toContain("flood-overlay-100-raw-buckets/bucket_id=0/part-*.parquet");
    expect(sql).toContain("flood-overlay-500-raw-buckets/bucket_id=0/part-*.parquet");
    expect(sql).toContain("SELECT\n  dfirm_id,");
    expect(sql).toContain("ST_CollectionExtract(ST_MakeValid(ST_Union_Agg(geom)), 3) AS geom");
    expect(sql).toContain("'SFHA' AS FLD_ZONE");
    expect(sql).toContain("1 AS is_flood_100");
    expect(sql).toContain("flood-overlay-100-bucket-00.parquet");
    expect(sql).toContain("flood-overlay-500-bucket-00.parquet");
    expect(sql).toContain("FORMAT PARQUET");
    expect(sql).not.toContain("CREATE TEMP TABLE flood_overlay_100_bucket_stage AS");
    expect(sql.includes("ST_AsGeoJSON")).toBe(false);
    expect(sql.includes("environmental_tiles.flood_overlay_100")).toBe(false);
    expect(sql.includes("environmental_tiles.flood_overlay_500")).toBe(false);
    expect(sql.includes("environmental_current.flood_hazard")).toBe(false);
  });
});

describe("buildFloodSubdivisionChunkSql", () => {
  it("builds deterministic FID-range packaging SQL for flood GeoPackage progress tracking", () => {
    const sql = buildFloodSubdivisionChunkSql({
      maxFid: 191,
      minFid: 128,
      vertices: 255,
    });

    expect(sql).toContain("FROM flood_overlay_dissolved");
    expect(sql).toContain("ORDER BY fid");
    expect(sql).toContain("fid BETWEEN 128 AND 191");
    expect(sql).toContain("ST_Subdivide(geom, 255)");
    expect(sql).toContain("ST_CollectionExtract(");
    expect(sql.includes("OFFSET")).toBe(false);
  });
});

describe("buildHydroPlanetilerInputSpec", () => {
  it("builds the fixed 14-output hydro GeoJSONL matrix", () => {
    const outputRoot = createTempDir();
    const spec = buildHydroPlanetilerInputSpec({
      lakeVersionRootPath: "/tmp/lake/environmental-hydro-basins/data_version=hydrobasins-na-smoke",
      outputRoot,
    });

    expect(spec.outputs).toHaveLength(14);
    expect(
      spec.outputs.some((output) => output.hucLevel === 12 && output.featureKind === "label")
    ).toBe(false);
    expect(spec.outputs[0]).toEqual({
      featureKind: "polygon",
      hucLevel: 4,
      outputPath: join(outputRoot, "huc4-polygon.geojsonl"),
    });
    expect(spec.outputs[13]).toEqual({
      featureKind: "line",
      hucLevel: 12,
      outputPath: join(outputRoot, "huc12-line.geojsonl"),
    });
  });
});

describe("buildHydroPlanetilerInputSql", () => {
  it("builds hydro tile inputs from canonical GeoParquet with native feature-kind schemas", () => {
    const outputRoot = createTempDir();
    const spec = buildHydroPlanetilerInputSpec({
      lakeVersionRootPath: "/tmp/lake/environmental-hydro-basins/data_version=hydrobasins-na-smoke",
      outputRoot,
    });

    const sql = buildHydroPlanetilerInputSql(spec);

    expect(sql).toContain(
      "read_parquet('/tmp/lake/environmental-hydro-basins/data_version=hydrobasins-na-smoke/huc_level=4/feature_kind=polygon/part-*.parquet', hive_partitioning = false)"
    );
    expect(sql).toContain(
      "read_parquet('/tmp/lake/environmental-hydro-basins/data_version=hydrobasins-na-smoke/huc_level=12/feature_kind=line/part-*.parquet', hive_partitioning = false)"
    );
    expect(sql).toContain("'label_rank', label_rank");
    expect(sql).toContain("'huc_level', 'huc4'");
    expect(sql).toContain("huc12-line.geojsonl");
    expect(sql.includes("huc12-label.geojsonl")).toBe(false);
    expect(sql.includes("environmental_current.hydro_huc_polygons")).toBe(false);
    expect(sql.includes("environmental_tiles.hydro_polygon_source")).toBe(false);
  });
});
