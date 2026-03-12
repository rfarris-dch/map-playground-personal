import { describe, expect, it } from "bun:test";
import {
  isDatasetExportAllowed,
  isDatasetQueryAllowed,
  listSpatialAnalysisPolicies,
} from "@/http/spatial-analysis-policy.service";

describe("spatial analysis policy service", () => {
  it("exposes configured policies for all analysis datasets", () => {
    const datasets = listSpatialAnalysisPolicies().map((policy) => policy.dataset);
    expect(datasets).toContain("county_scores");
    expect(datasets).toContain("parcels");
    expect(datasets).toContain("facilities");
    expect(datasets).toContain("environmental_flood");
    expect(datasets).toContain("power");
    expect(datasets).toContain("fiber");
    expect(datasets).toContain("market_metrics");
  });

  it("enforces parcels query granularity policy", () => {
    expect(isDatasetQueryAllowed("parcels", "parcel")).toBe(true);
    expect(isDatasetQueryAllowed("parcels", "market")).toBe(false);
  });

  it("enforces export granularity policy", () => {
    expect(isDatasetExportAllowed("parcels", "parcel")).toBe(true);
    expect(isDatasetExportAllowed("parcels", "market")).toBe(false);
  });

  it("enforces flood query granularity policy", () => {
    expect(isDatasetQueryAllowed("environmental_flood", "polygon")).toBe(true);
    expect(isDatasetQueryAllowed("environmental_flood", "county")).toBe(false);
  });
});
