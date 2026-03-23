import { describe, expect, it } from "bun:test";
import {
  buildFacilitiesBboxQuery,
  buildFacilitiesPolygonQuery,
  buildFacilityDetailQuery,
  getCountyMetricsQuerySpec,
  getFacilitiesBboxQuerySpec,
  getFacilitiesPolygonQuerySpec,
  getFacilityDetailQuerySpec,
} from "@/index";

const ENDPOINT_CLASSES = new Set([
  "feature-collection",
  "boundary-aggregation",
  "proximity-enrichment",
]);
const LOCAL_FACILITY_TABLE_RE =
  /serve\.(facility_site|facility_site_fast|hyperscale_site|hyperscale_site_fast)/;

describe("geo-sql query specs", () => {
  it("keeps each public query spec internally consistent", () => {
    const specs = [
      getFacilitiesBboxQuerySpec("colocation"),
      getFacilitiesBboxQuerySpec("hyperscale"),
      getFacilitiesPolygonQuerySpec("colocation"),
      getFacilitiesPolygonQuerySpec("hyperscale"),
      getFacilityDetailQuerySpec("colocation"),
      getFacilityDetailQuerySpec("hyperscale"),
      getCountyMetricsQuerySpec(),
    ];

    for (const spec of specs) {
      expect(Number.isInteger(spec.maxRows)).toBe(true);
      expect(spec.maxRows).toBeGreaterThan(0);
      expect(ENDPOINT_CLASSES.has(spec.endpointClass)).toBe(true);
      expect(spec.sql.trim().length).toBeGreaterThan(0);
    }
  });

  it("builds facilities bbox queries without leaking registry names", () => {
    const query = buildFacilitiesBboxQuery({
      west: -100,
      south: 30,
      east: -90,
      north: 40,
      limit: 250,
      perspective: "colocation",
    });

    expect(query.params).toEqual([-100, 30, -90, 40, 250]);
    expect(query.sql).toContain("serve.facility_site_fast");
    expect(query.sql).toContain("/* facilities:bbox:colocation */");
    expect(query.sql).toContain("facility.longitude");
    expect(query.sql).toContain("facility.latitude");
    expect(query.sql).toContain("ORDER BY");
    expect(query.sql).toContain("LIMIT $5");
  });

  it("keeps facilities queries on local Postgres tables only", () => {
    const specs = [
      getFacilitiesBboxQuerySpec("colocation"),
      getFacilitiesBboxQuerySpec("hyperscale"),
      getFacilitiesPolygonQuerySpec("colocation"),
      getFacilitiesPolygonQuerySpec("hyperscale"),
      getFacilityDetailQuerySpec("colocation"),
      getFacilityDetailQuerySpec("hyperscale"),
    ];

    for (const spec of specs) {
      expect(spec.sql).toMatch(LOCAL_FACILITY_TABLE_RE);
      expect(spec.sql).not.toContain("source_row_ids");
    }
  });

  it("keeps facilities bbox row budgets aligned across perspectives", () => {
    const colocation = getFacilitiesBboxQuerySpec("colocation");
    const hyperscale = getFacilitiesBboxQuerySpec("hyperscale");

    expect(colocation.endpointClass).toBe("feature-collection");
    expect(hyperscale.endpointClass).toBe("feature-collection");
    expect(colocation.maxRows).toBe(hyperscale.maxRows);
  });

  it("keeps facilities polygon row budgets aligned across perspectives", () => {
    const colocation = getFacilitiesPolygonQuerySpec("colocation");
    const hyperscale = getFacilitiesPolygonQuerySpec("hyperscale");

    expect(colocation.endpointClass).toBe("feature-collection");
    expect(hyperscale.endpointClass).toBe("feature-collection");
    expect(colocation.maxRows).toBe(hyperscale.maxRows);
  });

  it("builds facilities polygon and detail queries without leaking registry names", () => {
    const polygonQuery = buildFacilitiesPolygonQuery({
      geometryGeoJson: '{"type":"Polygon","coordinates":[]}',
      limit: 100,
      perspective: "hyperscale",
    });
    const detailQuery = buildFacilityDetailQuery({
      facilityId: "facility-123",
      perspective: "hyperscale",
    });

    expect(polygonQuery.params).toEqual(['{"type":"Polygon","coordinates":[]}', 100]);
    expect(polygonQuery.sql).toContain("serve.hyperscale_site_fast");
    expect(polygonQuery.sql).toContain("/* facilities:polygon:hyperscale */");
    expect(polygonQuery.sql).toContain("facility.longitude");
    expect(polygonQuery.sql).toContain("facility.latitude");
    expect(polygonQuery.sql).toContain("ORDER BY");
    expect(polygonQuery.sql).toContain("LIMIT $2");
    expect(detailQuery.params).toEqual(["facility-123"]);
    expect(detailQuery.sql).toContain("serve.hyperscale_site_fast");
    expect(detailQuery.sql).toContain("/* facilities:detail:hyperscale */");
    expect(detailQuery.sql).toContain("facility.longitude");
    expect(detailQuery.sql).toContain("facility.latitude");
  });

  it("filters facilities queries to rows with provider ids and safe provider names", () => {
    const specs = [
      getFacilitiesBboxQuerySpec("colocation"),
      getFacilitiesBboxQuerySpec("hyperscale"),
      getFacilitiesPolygonQuerySpec("colocation"),
      getFacilitiesPolygonQuerySpec("hyperscale"),
      getFacilityDetailQuerySpec("colocation"),
      getFacilityDetailQuerySpec("hyperscale"),
    ];

    for (const spec of specs) {
      expect(spec.sql).toContain("provider_id IS NOT NULL");
      expect(spec.sql).toContain("provider_name");
      if (spec.sql.includes("serve.hyperscale_site_fast")) {
        expect(spec.sql).toContain("facility_name");
        expect(spec.sql).not.toContain("INITCAP(REPLACE(");
        continue;
      }

      expect(spec.sql).not.toContain("provider.provider_name");
    }
  });

  it("binds custom physical facilities tables into generated SQL", () => {
    const query = buildFacilitiesBboxQuery({
      west: -100,
      south: 30,
      east: -90,
      north: 40,
      limit: 250,
      perspective: "hyperscale",
      tables: {
        colocationFastTable: '"serve"."facility_site_fast__20260323.abc123"',
        hyperscaleFastTable: '"serve"."hyperscale_site_fast__20260323.abc123"',
      },
    });

    expect(query.sql).toContain('"serve"."hyperscale_site_fast__20260323.abc123"');
    expect(query.sql).not.toContain("serve.hyperscale_site_fast AS facility");
  });
});
