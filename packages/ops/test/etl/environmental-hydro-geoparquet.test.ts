import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveBatchArtifactLayout } from "../../src/etl/batch-artifact-layout";
import {
  buildHydroCanonicalGeoParquetArtifact,
  buildHydroCanonicalGeoParquetSql,
  buildHydroProjectionSql,
} from "../../src/etl/environmental-hydro-geoparquet";

const tempPaths: string[] = [];

function createTempDir(): string {
  const path = mkdtempSync(join(tmpdir(), "environmental-hydro-geoparquet-"));
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

describe("buildHydroCanonicalGeoParquetArtifact", () => {
  it("uses lake-spatial hydro artifacts rooted at the hydro lake data version", () => {
    const projectRoot = createTempDir();
    const layout = resolveBatchArtifactLayout({
      dataset: "environmental-hydro-basins",
      projectRoot,
      runId: "environmental-hydro-basins-2026-03-26T12-00-00Z",
    });

    const spec = buildHydroCanonicalGeoParquetArtifact({
      context: layout,
      dataVersion: "2026-03-07",
    });

    expect(spec.artifact.phase).toBe("lake-spatial");
    expect(spec.artifact.format).toBe("geoparquet");
    expect(spec.artifact.layer).toBe("hydro_huc");
    expect(spec.artifact.relativePath).toBe("data_version=2026-03-07");
    expect(spec.artifact.partitionKeys).toEqual(["data_version", "huc_level", "feature_kind"]);
    expect(spec.stageVersionRootPath).toBe(
      join(layout.runDir, "lake-stage", "environmental-hydro-basins", "data_version=2026-03-07")
    );
    expect(spec.publishedVersionRootPath).toBe(
      join(layout.lakeDatasetRoot, "data_version=2026-03-07")
    );
    expect(spec.outputs).toHaveLength(14);
    expect(
      spec.outputs.map((output) => `huc${String(output.hucLevel)}-${output.featureKind}`)
    ).toEqual([
      "huc4-polygon",
      "huc4-line",
      "huc4-label",
      "huc6-polygon",
      "huc6-line",
      "huc6-label",
      "huc8-polygon",
      "huc8-line",
      "huc8-label",
      "huc10-polygon",
      "huc10-line",
      "huc10-label",
      "huc12-polygon",
      "huc12-line",
    ]);
    expect(
      spec.outputs.some((output) => output.hucLevel === 12 && output.featureKind === "label")
    ).toBe(false);
  });
});

describe("buildHydroProjectionSql", () => {
  it("preserves native per-kind schemas", () => {
    const polygonProjection = buildHydroProjectionSql({
      featureKind: "polygon",
      hucLevel: 4,
    });
    const lineProjection = buildHydroProjectionSql({
      featureKind: "line",
      hucLevel: 4,
    });
    const labelProjection = buildHydroProjectionSql({
      featureKind: "label",
      hucLevel: 4,
    });

    expect(polygonProjection).toContain("huc,");
    expect(polygonProjection).toContain("name,");
    expect(polygonProjection).toContain("areasqkm,");
    expect(polygonProjection).toContain("states,");
    expect(polygonProjection).toContain("FROM hydro_polygon_source");

    expect(lineProjection).toContain("FROM hydro_line_source");
    expect(lineProjection.includes("huc,")).toBe(false);
    expect(lineProjection.includes("name,")).toBe(false);
    expect(lineProjection.includes("areasqkm,")).toBe(false);
    expect(lineProjection.includes("states,")).toBe(false);
    expect(lineProjection.includes("label_rank")).toBe(false);

    expect(labelProjection).toContain("label_rank,");
    expect(labelProjection).toContain("FROM hydro_label_source");
  });
});

describe("buildHydroCanonicalGeoParquetSql", () => {
  it("exports the fixed 14-output matrix from the canonical PostGIS hydro tables", () => {
    const projectRoot = createTempDir();
    const layout = resolveBatchArtifactLayout({
      dataset: "environmental-hydro-basins",
      projectRoot,
      runId: "environmental-hydro-basins-2026-03-26T12-00-00Z",
    });
    const spec = buildHydroCanonicalGeoParquetArtifact({
      context: layout,
      dataVersion: "2026-03-07",
    });

    const sql = buildHydroCanonicalGeoParquetSql({
      databaseUrl: "postgresql://example:example@localhost:5432/map",
      runId: "full-us-real-hydro-20260307",
      spec,
    });

    expect(sql).toContain(
      "ATTACH 'postgresql://example:example@localhost:5432/map' AS hydro_pg (TYPE POSTGRES);"
    );
    expect(sql).toContain("CREATE OR REPLACE TEMP VIEW hydro_polygon_source AS");
    expect(sql).toContain("CREATE OR REPLACE TEMP VIEW hydro_line_source AS");
    expect(sql).toContain("CREATE OR REPLACE TEMP VIEW hydro_label_source AS");
    expect(sql).toContain("FROM environmental_current.hydro_huc_polygons");
    expect(sql).toContain("FROM environmental_current.hydro_huc_lines");
    expect(sql).toContain("FROM environmental_current.hydro_huc_labels");
    expect(sql).toContain("WHERE run_id = ''full-us-real-hydro-20260307''");
    expect(sql).toContain("ST_GeomFromWKB(geom_wkb) AS geom");
    expect(sql).toContain("huc_level=4/feature_kind=polygon/part-0.parquet");
    expect(sql).toContain("huc_level=10/feature_kind=label/part-0.parquet");
    expect(sql).toContain("huc_level=12/feature_kind=line/part-0.parquet");
    expect(sql.includes("huc_level=12/feature_kind=label/part-0.parquet")).toBe(false);
    expect(sql.includes("geom_3857")).toBe(false);
    expect(sql.match(/part-0\.parquet/g)?.length).toBe(14);
  });
});
