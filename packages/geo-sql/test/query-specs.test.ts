import { describe, expect, it } from "bun:test";
import { getQuerySpec, QUERY_SPECS } from "../src/index";

const ENDPOINT_CLASSES = new Set([
  "feature-collection",
  "administrative-aggregation",
  "proximity-enrichment",
]);

describe("geo-sql query specs", () => {
  it("keeps each query spec internally consistent", () => {
    for (const [name, spec] of Object.entries(QUERY_SPECS)) {
      expect(spec.name).toBe(name);
      expect(Number.isInteger(spec.maxRows)).toBe(true);
      expect(spec.maxRows).toBeGreaterThan(0);
      expect(ENDPOINT_CLASSES.has(spec.endpointClass)).toBe(true);
      expect(spec.sql.trim().length).toBeGreaterThan(0);
    }
  });

  it("supports lookup for every registered query spec", () => {
    for (const spec of Object.values(QUERY_SPECS)) {
      const lookedUp = getQuerySpec(spec.name);
      expect(lookedUp).toEqual(spec);
    }
  });

  it("keeps facilities bbox row budgets aligned across perspectives", () => {
    const colocation = getQuerySpec("facilities_bbox_colocation");
    const hyperscale = getQuerySpec("facilities_bbox_hyperscale");

    expect(colocation.endpointClass).toBe("feature-collection");
    expect(hyperscale.endpointClass).toBe("feature-collection");
    expect(colocation.maxRows).toBe(hyperscale.maxRows);
  });
});
