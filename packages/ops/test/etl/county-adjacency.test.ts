import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import {
  BOUNDARY_COUNTY_RELATION_NAME,
  buildCountyAdjacencyArtifactRecord,
  buildCountyAdjacencyExportSql,
  COUNTY_ADJACENCY_MODEL_VERSION,
  resolveCountyAdjacencyRunContext,
  resolveCountyAdjacencyRunId,
} from "../../src/etl/county-adjacency";
import type { CountyAdjacencyBoundaryVersionRecord } from "../../src/etl/county-adjacency.types";

const boundary: CountyAdjacencyBoundaryVersionRecord = {
  boundaryRelationName: BOUNDARY_COUNTY_RELATION_NAME,
  boundaryVersion: "deadbeef",
  publishedRowCount: 3221,
  sourceAsOfDate: "2026-03-25",
  sourceRefreshedAt: "2026-03-25T12:00:00Z",
  sourceRelationName: "serve.admin_county_geom_lod1",
  sourceRowCount: 3221,
};

describe("county-adjacency", () => {
  it("resolves a stable run context keyed by the boundary version", () => {
    const projectRoot = "/tmp/map";
    const context = resolveCountyAdjacencyRunContext(projectRoot, boundary.boundaryVersion, {});

    expect(resolveCountyAdjacencyRunId(boundary.boundaryVersion)).toBe("county-adjacency-deadbeef");
    expect(context.adjacencyArtifactPath).toBe(
      join(
        projectRoot,
        "var",
        "boundaries-sync",
        "county-adjacency-deadbeef",
        "gold",
        "plain",
        "mart=county_adjacency",
        "boundary_version=deadbeef",
        "part-0.parquet"
      )
    );
    expect(buildCountyAdjacencyArtifactRecord(context)).toMatchObject({
      format: "parquet",
      layer: "county_adjacency",
      partitionKeys: ["boundary_version"],
      phase: "gold-plain",
      relativePath: "gold/plain/mart=county_adjacency/boundary_version=deadbeef",
    });
  });

  it("builds adjacency export SQL against the published county boundary table", () => {
    const sql = buildCountyAdjacencyExportSql({
      boundary,
      runId: "county-adjacency-deadbeef",
    });

    expect(sql).toContain(`FROM ${BOUNDARY_COUNTY_RELATION_NAME} AS county`);
    expect(sql).toContain("ST_Touches(county.geom, adjacent.geom)");
    expect(sql).toContain("shared_boundary_meters");
    expect(sql).toContain("point_touch");
    expect(sql).toContain("boundary_version");
    expect(sql).toContain("NULLIF(county.data_version::text, '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'");
    expect(sql).toContain(COUNTY_ADJACENCY_MODEL_VERSION);
  });
});
