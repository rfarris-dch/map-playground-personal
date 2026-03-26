import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createLakeManifestRecord,
  ensureBatchArtifactLayout,
  resolveBatchArtifactLayout,
  resolveDatasetLakeConvention,
} from "../../src/etl/batch-artifact-layout";
import {
  ensureCountyPowerRunDirectories,
  resolveCountyPowerRunContext,
} from "../../src/etl/county-power-sync";
import { renderDuckDbBootstrapSql } from "../../src/etl/duckdb-bootstrap";

const tempPaths: string[] = [];

function createTempDir(): string {
  const path = mkdtempSync(join(tmpdir(), "batch-artifact-layout-"));
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

describe("resolveBatchArtifactLayout", () => {
  it("resolves default Phase 0 directories for county-power runs", () => {
    const projectRoot = createTempDir();
    const layout = resolveBatchArtifactLayout({
      dataset: "county-power",
      projectRoot,
      runId: "county-power-sync-2026-03-25T12-00-00Z",
    });

    expect(layout.snapshotRoot).toBe(join(projectRoot, "var", "county-power-sync"));
    expect(layout.lakeDatasetRoot).toBe(join(projectRoot, "var", "lake", "county-power"));
    expect(layout.duckdbDatasetRoot).toBe(join(projectRoot, "var", "duckdb", "county-power"));
    expect(layout.silverPlainDir).toBe(join(layout.runDir, "silver", "plain"));
    expect(layout.goldSpatialDir).toBe(join(layout.runDir, "gold", "spatial"));
    expect(layout.runDuckDbPath).toBe(join(layout.runDir, "duckdb", "run.duckdb"));
    expect(layout.lakeManifestPath).toBe(join(layout.runDir, "manifests", "lake-manifest.json"));
  });

  it("honors lake and duckdb env overrides", () => {
    const projectRoot = createTempDir();
    const layout = resolveBatchArtifactLayout({
      dataset: "parcels",
      env: {
        MAP_DUCKDB_ROOT: "custom-duckdb",
        MAP_LAKE_ROOT: "custom-lake",
      },
      projectRoot,
      runId: "parcel-sync-2026-03-25T12-00-00Z",
      snapshotRoot: "var/parcels-sync",
    });

    expect(layout.lakeDatasetRoot).toBe(join(projectRoot, "custom-lake", "parcels"));
    expect(layout.duckdbDatasetRoot).toBe(join(projectRoot, "custom-duckdb", "parcels"));
  });
});

describe("ensureBatchArtifactLayout", () => {
  it("writes a lake manifest and duckdb bootstrap control files", () => {
    const projectRoot = createTempDir();
    const layout = resolveBatchArtifactLayout({
      dataset: "environmental-flood",
      projectRoot,
      runId: "environmental-flood-2026-03-25T12-00-00Z",
    });

    const manifest = ensureBatchArtifactLayout({
      dataVersion: "2026-03-25",
      effectiveDate: "2026-03-25",
      layout,
      month: "2026-03-01",
    });

    expect(existsSync(layout.silverPlainDir)).toBe(true);
    expect(existsSync(layout.goldSpatialDir)).toBe(true);
    expect(existsSync(layout.qaDir)).toBe(true);
    expect(existsSync(layout.runDuckDbBootstrapPath)).toBe(true);
    expect(existsSync(layout.lakeManifestPath)).toBe(true);
    expect(manifest.duckdb.requiredExtensions).toEqual(["spatial", "httpfs", "postgres"]);

    const persisted = JSON.parse(readFileSync(layout.lakeManifestPath, "utf8")) as {
      readonly dataVersion: string;
      readonly duckdb: {
        readonly databasePath: string;
      };
      readonly standards: {
        readonly geometryColumn: string;
      };
    };
    expect(persisted.dataVersion).toBe("2026-03-25");
    expect(persisted.duckdb.databasePath).toBe(layout.runDuckDbPath);
    expect(persisted.standards.geometryColumn).toBe("geom");
  });

  it("persists the explicit standards and dataset convention contract", () => {
    const projectRoot = createTempDir();
    const layout = resolveBatchArtifactLayout({
      dataset: "parcels",
      projectRoot,
      runId: "parcel-sync-2026-03-25T12-00-00Z",
    });

    const manifest = createLakeManifestRecord({
      dataVersion: "2026-03-25",
      layout,
    });

    expect(manifest.standards.canonicalWebMercatorStorage).toBe(false);
    expect(manifest.standards.manifestControlSurface).toBe("json");
    expect(manifest.standards.parquetKeyValueMetadata).toBe("optional");
    expect(manifest.standards.requiredProvenanceFields).toContain("publication_run_id");
    expect(manifest.datasetConvention.dataset).toBe("parcels");
    expect(manifest.datasetConvention.partitionRules).toHaveLength(2);
    expect(manifest.datasetConvention.partitionRules[0]?.partitionKeys).toEqual([
      "data_version",
      "state2",
      "county_geoid",
    ]);
  });

  it("enriches county-power contexts without changing legacy normalized paths", () => {
    const projectRoot = createTempDir();
    const context = resolveCountyPowerRunContext(
      projectRoot,
      "county-power-sync-2026-03-25T12-00-00Z",
      {
        COUNTY_POWER_SNAPSHOT_ROOT: "custom-county-power",
      }
    );

    ensureCountyPowerRunDirectories(context);

    expect(context.snapshotRoot).toBe(join(projectRoot, "custom-county-power"));
    expect(context.normalizedDir).toBe(join(context.runDir, "normalized"));
    expect(context.silverPlainDir).toBe(join(context.runDir, "silver", "plain"));
    expect(existsSync(context.lakeManifestPath)).toBe(true);
    expect(existsSync(context.runDuckDbBootstrapPath)).toBe(true);
  });
});

describe("renderDuckDbBootstrapSql", () => {
  it("loads the required extensions in order", () => {
    const sql = renderDuckDbBootstrapSql();
    expect(sql).toContain("INSTALL spatial;");
    expect(sql).toContain("LOAD httpfs;");
    expect(sql).toContain("LOAD postgres;");
  });
});

describe("resolveDatasetLakeConvention", () => {
  it("documents the Phase 0 partition rules for every lake dataset", () => {
    const countyPower = resolveDatasetLakeConvention("county-power");
    const boundaries = resolveDatasetLakeConvention("boundaries");
    const flood = resolveDatasetLakeConvention("environmental-flood");
    const hydro = resolveDatasetLakeConvention("environmental-hydro-basins");
    const marketBoundaries = resolveDatasetLakeConvention("market-boundaries");
    const parcels = resolveDatasetLakeConvention("parcels");

    expect(countyPower.partitionRules).toHaveLength(3);
    expect(countyPower.partitionRules[1]?.partitionKeys).toEqual([
      "data_version",
      "table",
      "source_system",
      "state_abbrev",
    ]);
    expect(boundaries.partitionRules[0]?.partitionKeys).toEqual(["data_version", "layer"]);
    expect(flood.partitionRules[0]?.partitionKeys).toEqual([
      "data_version",
      "flood_band",
      "source_state_unit",
    ]);
    expect(hydro.partitionRules[0]?.partitionKeys).toEqual([
      "data_version",
      "huc_level",
      "feature_kind",
    ]);
    expect(marketBoundaries.partitionRules[0]?.format).toBe("geoparquet");
    expect(parcels.notes[0]).toContain("Do not emit a single national parcel file");
  });
});
