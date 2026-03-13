import { describe, expect, it } from "bun:test";
import {
  buildPipelineAssetChainRows,
  formatPipelineAssetLabel,
  orderPipelineStatesByAssetChain,
} from "../../../src/features/pipeline/components/pipeline-dashboard/pipeline-dashboard-asset-chain.service";
import {
  createPipelineState,
  createPipelineStatusResponse,
} from "../../support/pipeline-status-fixtures";

describe("pipeline-dashboard-asset-chain.service", () => {
  it("orders checkpoint rows by the configured dataset asset chain", () => {
    const response = createPipelineStatusResponse({
      dataset: "flood",
      states: [
        createPipelineState({ state: "validate" }),
        createPipelineState({ state: "flood_pmtiles" }),
        createPipelineState({ state: "canonical_flood_hazard" }),
      ],
    });

    const orderedStates = orderPipelineStatesByAssetChain(
      response.run.states,
      response.dataset.assetChain
    );

    expect(orderedStates.map((stateRow) => stateRow.state)).toEqual([
      "canonical_flood_hazard",
      "flood_pmtiles",
      "validate",
    ]);
  });

  it("builds visible asset-chain rows with running and pending statuses", () => {
    const response = createPipelineStatusResponse({
      dataset: "flood",
      isRunning: true,
      phase: "building",
      states: [
        createPipelineState({
          state: "raw_fema_extract",
          isCompleted: true,
          updatedAt: "2026-03-12T12:00:00.000Z",
        }),
        createPipelineState({
          state: "canonical_flood_hazard",
          isCompleted: true,
          updatedAt: "2026-03-12T12:10:00.000Z",
        }),
        createPipelineState({
          state: "flood100_tilesource",
          isCompleted: true,
          updatedAt: "2026-03-12T12:20:00.000Z",
        }),
      ],
    });

    const assetRows = buildPipelineAssetChainRows(response.dataset.assetChain, response.run);

    expect(assetRows[0]).toMatchObject({
      assetKey: "raw_fema_extract",
      label: "Raw FEMA Extract",
      status: "completed",
    });
    expect(assetRows[3]).toMatchObject({
      assetKey: "flood500_tilesource",
      status: "running",
    });
    expect(assetRows[4]).toMatchObject({
      assetKey: "flood_pmtiles",
      status: "pending",
    });
  });

  it("formats platform labels for display", () => {
    expect(formatPipelineAssetLabel("pmtiles-cdn")).toBe("PMTiles CDN");
    expect(formatPipelineAssetLabel("canonical_huc_polygons")).toBe("Canonical HUC Polygons");
  });
});
