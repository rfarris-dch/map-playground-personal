import { describe, expect, it } from "bun:test";
import { appendPipelineLiveSample } from "../../../src/features/pipeline/pipeline-tracking/pipeline-tracking-history.service";
import { buildPipelineLiveSample } from "../../../src/features/pipeline/pipeline-tracking/pipeline-tracking-live-sample.service";
import { estimatePipelineRate } from "../../../src/features/pipeline/pipeline-tracking/pipeline-tracking-rate.service";
import {
  createPipelineState,
  createPipelineStatusPayload,
} from "../../support/pipeline-status-fixtures";

function createFloodLoadingSample(capturedAt: string, rawWrittenCount: number, stageLabel: string) {
  return buildPipelineLiveSample(
    createPipelineStatusPayload({
      phase: "loading",
      isRunning: true,
      runId: "full-us-real-flood-20260307",
      summary: `flood-load staging tuples=${String(rawWrittenCount)} percent=2% stage=${stageLabel}`,
      states: [
        createPipelineState({
          state: "load",
          expectedCount: 4_524_255,
          writtenCount: rawWrittenCount,
        }),
      ],
    }),
    capturedAt
  );
}

describe("flood loading rate tracking", () => {
  it("trusts the latest flood staging row counter after a reset", () => {
    let history = appendPipelineLiveSample(
      [],
      createFloodLoadingSample("2026-03-10T15:00:00.000Z", 70_000, "100MB")
    );
    history = appendPipelineLiveSample(
      history,
      createFloodLoadingSample("2026-03-10T15:00:10.000Z", 90_000, "120MB")
    );
    history = appendPipelineLiveSample(
      history,
      createFloodLoadingSample("2026-03-10T15:00:20.000Z", 5000, "140MB")
    );

    expect(history[0]?.writtenCount).toBe(70_000);
    expect(history[1]?.writtenCount).toBe(90_000);
    expect(history[2]?.writtenCount).toBe(5000);
    expect(history[2]?.counterMode).toBe("flood-staging-rows");
  });

  it("still computes rows per second when direct-postgres load has no expected count", () => {
    const history = [
      buildPipelineLiveSample(
        createPipelineStatusPayload({
          phase: "loading",
          isRunning: true,
          runId: "full-us-fema-direct-20260311T160200Z",
          summary: "flood-load staging rows=1000 stage=120MB",
          writtenCount: 1000,
          expectedCount: null,
          states: [
            createPipelineState({
              state: "load",
              expectedCount: null,
              writtenCount: 1000,
            }),
          ],
        }),
        "2026-03-11T16:06:00.000Z"
      ),
      buildPipelineLiveSample(
        createPipelineStatusPayload({
          phase: "loading",
          isRunning: true,
          runId: "full-us-fema-direct-20260311T160200Z",
          summary: "flood-load staging rows=2500 stage=240MB",
          writtenCount: 2500,
          expectedCount: null,
          states: [
            createPipelineState({
              state: "load",
              expectedCount: null,
              writtenCount: 2500,
            }),
          ],
        }),
        "2026-03-11T16:06:10.000Z"
      ),
    ];

    const estimate = estimatePipelineRate(history);

    expect(estimate.rowsPerSecond).toBe(150);
    expect(estimate.recentRowsPerSecond).toBe(150);
    expect(estimate.averageRowsPerSecond).toBe(150);
    expect(estimate.remainingRows).toBeNull();
    expect(estimate.etaMs).toBeNull();
  });

  it("drops pre-reset flood loading samples from the rate window", () => {
    const history = [
      createFloodLoadingSample("2026-03-10T15:00:00.000Z", 70_000, "100MB"),
      createFloodLoadingSample("2026-03-10T15:00:10.000Z", 90_000, "120MB"),
      createFloodLoadingSample("2026-03-10T15:00:20.000Z", 5000, "140MB"),
      createFloodLoadingSample("2026-03-10T15:00:30.000Z", 6200, "150MB"),
    ];

    const estimate = estimatePipelineRate(history);

    expect(estimate.rowsPerSecond).toBe(120);
    expect(estimate.recentRowsPerSecond).toBe(120);
    expect(estimate.averageRowsPerSecond).toBe(120);
  });

  it("uses run start time for flood loading average on a fresh page", () => {
    const estimate = estimatePipelineRate([
      buildPipelineLiveSample(
        createPipelineStatusPayload({
          phase: "loading",
          isRunning: true,
          runId: "full-us-fema-direct-20260311T160200Z",
          startedAt: "2026-03-11T16:00:00.000Z",
          summary: "flood-load staging rows=6000 stage=240MB",
          writtenCount: 6000,
          expectedCount: 12_000,
          states: [
            createPipelineState({
              state: "load",
              expectedCount: 12_000,
              writtenCount: 6000,
            }),
          ],
        }),
        "2026-03-11T16:01:00.000Z"
      ),
    ]);

    expect(estimate.recentRowsPerSecond).toBeNull();
    expect(estimate.averageRowsPerSecond).toBe(100);
    expect(estimate.rowsPerSecond).toBe(100);
    expect(estimate.etaMs).toBe(60_000);
  });
});
