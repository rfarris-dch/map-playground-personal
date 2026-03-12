import { describe, expect, it } from "bun:test";
import {
  buildSelectionRingBbox,
  selectionRingExceedsFastAnalysisLimits,
} from "@/features/selection/selection-analysis-request.service";

describe("selection analysis request service", () => {
  it("allows compact selection rings", () => {
    const ring: readonly [number, number][] = [
      [-97.1, 32.7],
      [-96.4, 32.7],
      [-96.4, 33.1],
      [-97.1, 33.1],
      [-97.1, 32.7],
    ];

    expect(buildSelectionRingBbox(ring)).toEqual({
      west: -97.1,
      south: 32.7,
      east: -96.4,
      north: 33.1,
    });
    expect(selectionRingExceedsFastAnalysisLimits(ring)).toBe(false);
  });

  it("blocks oversized selection rings", () => {
    const ring: readonly [number, number][] = [
      [-125, 24],
      [-66, 24],
      [-66, 50],
      [-125, 50],
      [-125, 24],
    ];

    expect(selectionRingExceedsFastAnalysisLimits(ring)).toBe(true);
  });
});
