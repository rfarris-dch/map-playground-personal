import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Route-builder / request-schema alignment
// ---------------------------------------------------------------------------

describe("route-builder / request-schema alignment", () => {
  it("facilities bbox default limit matches ApiQueryDefaults.bboxLimit", async () => {
    const { FacilitiesBboxRequestSchema } = await import("./facilities-http.js");
    const { ApiQueryDefaults } = await import("./api-defaults.js");

    const parsed = FacilitiesBboxRequestSchema.parse({
      bbox: { west: -97, south: 30, east: -96, north: 31 },
    });

    expect(parsed.limit).toBe(ApiQueryDefaults.facilities.bboxLimit);
  });

  it("facilities detail request includes datasetVersion field", async () => {
    const { FacilitiesDetailRequestSchema } = await import("./facilities-http.js");

    const parsed = FacilitiesDetailRequestSchema.parse({
      perspective: "colocation",
      datasetVersion: "v1.2.3",
    });

    expect(parsed.datasetVersion).toBe("v1.2.3");
  });

  it("facilities table request includes datasetVersion field", async () => {
    const { FacilitiesTableRequestSchema } = await import("./facilities-table-http.js");

    const parsed = FacilitiesTableRequestSchema.parse({
      page: 0,
      pageSize: 10,
      perspective: "colocation",
      sortBy: "facilityName",
      sortOrder: "asc",
      datasetVersion: "v2.0.0",
    });

    expect(parsed.datasetVersion).toBe("v2.0.0");
  });

  it("market boundary request includes version field", async () => {
    const { MarketBoundaryRequestSchema } = await import("./market-boundaries-http.js");

    const parsed = MarketBoundaryRequestSchema.parse({
      level: "market",
      version: "4",
    });

    expect(parsed.version).toBe("4");
  });

  it("buildCountyPowerStoryTimelineRoute forwards window param", async () => {
    const { buildCountyPowerStoryTimelineRoute } = await import("./api-routes.js");

    const url = buildCountyPowerStoryTimelineRoute("grid-stress", { window: "30d" });

    expect(url).toContain("window=30d");
  });

  it("buildMarketBoundariesRoute requires explicit version", async () => {
    const { buildMarketBoundariesRoute } = await import("./api-routes.js");

    const withVersion = buildMarketBoundariesRoute("market", "4");
    expect(withVersion).toContain("v=4");

    const withoutVersion = buildMarketBoundariesRoute("market");
    expect(withoutVersion).not.toContain("v=");
  });

  it("buildLaunchPolicyRoute points at the launch policy endpoint", async () => {
    const { buildLaunchPolicyRoute } = await import("./api-routes.js");

    expect(buildLaunchPolicyRoute()).toBe("/api/geo/launch-policy");
  });
});

// ---------------------------------------------------------------------------
// Query parsing — blank query param handling
// ---------------------------------------------------------------------------

describe("query parsing handles blank params correctly", () => {
  it("FacilitiesBboxRequestSchema defaults perspective on blank input", async () => {
    const { FacilitiesBboxRequestSchema } = await import("./facilities-http.js");

    const parsed = FacilitiesBboxRequestSchema.parse({
      bbox: { west: -97, south: 30, east: -96, north: 31 },
      perspective: "",
    });

    expect(parsed.perspective).toBe("colocation");
  });

  it("BoundaryPowerRequestSchema defaults level on blank input", async () => {
    const { BoundaryPowerRequestSchema } = await import("./boundaries-http.js");

    const parsed = BoundaryPowerRequestSchema.parse({ level: "" });
    expect(parsed.level).toBe("county");
  });

  it("page defaults to 0 on blank input", async () => {
    const { FacilitiesTableRequestSchema } = await import("./facilities-table-http.js");

    const parsed = FacilitiesTableRequestSchema.parse({
      page: "",
      pageSize: "",
      perspective: "",
      sortBy: "",
      sortOrder: "",
    });

    expect(parsed.page).toBe(0);
    expect(parsed.pageSize).toBe(100);
    expect(parsed.perspective).toBe("colocation");
    expect(parsed.sortBy).toBe("facilityName");
    expect(parsed.sortOrder).toBe("asc");
  });
});

// ---------------------------------------------------------------------------
// Representative payload parse tests
// ---------------------------------------------------------------------------

describe("representative payload parse tests", () => {
  it("parses a full county score payload", async () => {
    const { CountyScoreSchema } = await import("./county-intelligence-http.js");

    const partial = CountyScoreSchema.safeParse({
      countyFips: "48201",
      countyName: "Harris County",
      stateAbbrev: "TX",
      rankStatus: "ranked",
      attractivenessTier: "advantaged",
      confidenceBadge: "high",
    });

    // Should fail because many required fields are missing
    expect(partial.success).toBe(false);
  });

  it("parses a facility bbox response feature", async () => {
    const { FacilitiesFeatureSchema } = await import("./facilities-http.js");

    const feature = FacilitiesFeatureSchema.parse({
      type: "Feature",
      id: "f-1",
      geometry: { type: "Point", coordinates: [-97.0, 30.0] },
      properties: {
        perspective: "colocation",
        facilityId: "f-1",
        facilityName: "Test DC",
        providerId: "p-1",
        providerName: "Test Provider",
        countyFips: "48201",
        stateAbbrev: "TX",
        commissionedPowerMw: 100,
        plannedPowerMw: null,
        underConstructionPowerMw: null,
        availablePowerMw: 50,
        commissionedSemantic: "operational",
        leaseOrOwn: "own",
        statusLabel: "Active",
        city: "Austin",
        marketName: "Austin",
        squareFootage: null,
        facilityCode: null,
        address: null,
        state: null,
      },
    });

    expect(feature.properties.facilityId).toBe("f-1");
    expect(feature.geometry.type).toBe("Point");
  });

  it("parses a sync run status response", async () => {
    const { SyncStatusResponseSchema } = await import("./sync-run-http.js");

    const response = SyncStatusResponseSchema.parse({
      status: "ok",
      generatedAt: "2025-01-01T00:00:00.000Z",
      enabled: true,
      mode: "external",
      intervalMs: 3_600_000,
      requireStartupSuccess: false,
      snapshotRoot: "/data/snapshots",
      latestRunId: "run-1",
      latestRunCompletedAt: "2025-01-01T00:00:00.000Z",
      run: {
        runId: "run-1",
        reason: "manual",
        phase: "completed",
        isRunning: false,
        startedAt: "2025-01-01T00:00:00.000Z",
        endedAt: "2025-01-01T00:00:00.000Z",
        durationMs: 120_000,
        exitCode: 0,
        summary: "OK",
        progress: null,
        states: [],
        statesCompleted: 0,
        statesTotal: 0,
        writtenCount: 0,
        expectedCount: null,
        logTail: [],
      },
    });

    expect(response.run.phase).toBe("completed");
  });
});

// ---------------------------------------------------------------------------
// Export-map snapshot — verifies all expected subpath exports exist
// ---------------------------------------------------------------------------

describe("export-map snapshot", () => {
  const EXPECTED_SUBPATHS = [
    "./api-error",
    "./api-defaults",
    "./auth-http",
    "./api-response-meta",
    "./api-routes",
    "./analysis-contracts",
    "./analysis-policy-http",
    "./app-performance-http",
    "./boundaries-http",
    "./county-intelligence-http",
    "./county-intelligence-debug-http",
    "./county-power-story-http",
    "./effect-http",
    "./facilities-http",
    "./facilities-table-http",
    "./facilities-performance-http",
    "./fiber-locator-http",
    "./launch-policy-http",
    "./map-context-transfer",
    "./market-boundaries-http",
    "./market-metrics-http",
    "./markets-selection-http",
    "./markets-table-http",
    "./parcels-http",
    "./parcel-scoring-http",
    "./pipeline-http",
    "./providers-table-http",
    "./spatial-analysis-summary-http",
    "./spatial-analysis-history-http",
    "./sync-run-http",
    "./tiles-http",
    "./table-contracts",
  ];

  it("package.json exports match expected subpaths", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const pkgJson = JSON.parse(
      fs.readFileSync(path.resolve(import.meta.dirname, "../package.json"), "utf-8")
    );

    const exportKeys = Object.keys(pkgJson.exports).sort();
    const expected = [...EXPECTED_SUBPATHS].sort();

    expect(exportKeys).toEqual(expected);
  });
});
