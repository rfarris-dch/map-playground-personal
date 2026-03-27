import { describe, expect, it } from "bun:test";
import { buildDatasetDefinitions } from "../../src/etl/pipeline-runner";

describe("buildDatasetDefinitions", () => {
  it("runs flood tilesource once for both overlays before PMTiles build", () => {
    const definitions = buildDatasetDefinitions("/tmp/project", {});
    const floodSteps = definitions.flood.steps;

    expect(floodSteps.map((step) => step.assetKey)).toContain("flood_tilesource");
    expect(floodSteps.map((step) => step.assetKey)).not.toContain("flood100_tilesource");
    expect(floodSteps.map((step) => step.assetKey)).not.toContain("flood500_tilesource");

    const floodTilesourceStep = floodSteps.find((step) => step.assetKey === "flood_tilesource");
    expect(floodTilesourceStep).toBeDefined();
    expect(floodTilesourceStep?.deps).toEqual(["flood_canonical_geoparquet"]);
    expect(floodTilesourceStep?.commands).toEqual([
      {
        args: [
          "/tmp/project/scripts/refresh-environmental-flood-tilesources.sh",
          "{run_id}",
          "all",
        ],
        command: "bash",
      },
    ]);

    const floodPmtilesStep = floodSteps.find((step) => step.assetKey === "flood_pmtiles");
    expect(floodPmtilesStep?.deps).toEqual(["flood_tilesource"]);
  });
});
