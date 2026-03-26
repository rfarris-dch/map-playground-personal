import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveBatchArtifactLayout } from "../../src/etl/batch-artifact-layout";
import {
  buildFloodCanonicalGeoParquetArtifact,
  buildFloodCanonicalGeoParquetSql,
} from "../../src/etl/environmental-flood-geoparquet";

const tempPaths: string[] = [];

function createTempDir(): string {
  const path = mkdtempSync(join(tmpdir(), "environmental-flood-geoparquet-"));
  tempPaths.push(path);
  return path;
}

afterEach(() => {
  while (tempPaths.length > 0) {
    const path = tempPaths.pop();
    if (typeof path === "string") {
      rmSync(path, { force: true, recursive: true });
    }
  }
});

describe("buildFloodCanonicalGeoParquetArtifact", () => {
  it("uses lake-spatial artifacts rooted at the flood lake data version", () => {
    const projectRoot = createTempDir();
    const layout = resolveBatchArtifactLayout({
      dataset: "environmental-flood",
      projectRoot,
      runId: "environmental-flood-2026-03-26T12-00-00Z",
    });

    const spec = buildFloodCanonicalGeoParquetArtifact({
      context: layout,
      dataVersion: "2026-03-24",
    });

    expect(spec.artifact.phase).toBe("lake-spatial");
    expect(spec.artifact.format).toBe("geoparquet");
    expect(spec.artifact.relativePath).toBe("data_version=2026-03-24");
    expect(spec.artifact.partitionKeys).toEqual([
      "data_version",
      "flood_band",
      "source_state_unit",
    ]);
    expect(spec.stageVersionRootPath).toBe(
      join(layout.runDir, "lake-stage", "environmental-flood", "data_version=2026-03-24")
    );
    expect(spec.publishedVersionRootPath).toBe(
      join(layout.lakeDatasetRoot, "data_version=2026-03-24")
    );
    expect(spec.bandOutputs.map((bandOutput) => bandOutput.band)).toEqual(["full", "100", "500"]);
    expect(
      spec.bandOutputs.every((bandOutput) => bandOutput.outputPath.endsWith("part-0.parquet"))
    ).toBe(true);
  });
});

describe("buildFloodCanonicalGeoParquetSql", () => {
  it("exports full, 100, and 500 families from the canonical PostGIS table", () => {
    const projectRoot = createTempDir();
    const layout = resolveBatchArtifactLayout({
      dataset: "environmental-flood",
      projectRoot,
      runId: "environmental-flood-2026-03-26T12-00-00Z",
    });
    const spec = buildFloodCanonicalGeoParquetArtifact({
      context: layout,
      dataVersion: "2026-03-24",
    });

    const sql = buildFloodCanonicalGeoParquetSql({
      databaseUrl: "postgresql://example:example@localhost:5432/map",
      runId: "environmental-flood-20260326t120000z",
      spec,
    });

    expect(sql).toContain(
      "ATTACH 'postgresql://example:example@localhost:5432/map' AS flood_pg (TYPE POSTGRES);"
    );
    expect(sql).toContain("FROM environmental_current.flood_hazard");
    expect(sql).toContain("WHERE run_id = ''environmental-flood-20260326t120000z''");
    expect(sql).toContain("ST_GeomFromWKB(geom_wkb) AS geom");
    expect(sql).toContain("ST_XMin(geom) AS xmin");
    expect(sql).toContain("ST_YMax(geom) AS ymax");
    expect(sql).toContain("flood_band=full/source_state_unit=unknown/part-0.parquet");
    expect(sql).toContain("flood_band=100/source_state_unit=unknown/part-0.parquet");
    expect(sql).toContain("flood_band=500/source_state_unit=unknown/part-0.parquet");
    expect(sql).toContain("WHERE is_flood_100 = TRUE");
    expect(sql).toContain("WHERE is_flood_500 = TRUE");
    expect(sql.includes("geom_3857")).toBe(false);
  });
});
