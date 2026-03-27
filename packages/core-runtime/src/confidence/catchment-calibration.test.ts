import { describe, expect, it } from "bun:test";
import {
  CATCHMENT_BACKTEST_PROTOCOL,
  CATCHMENT_DEBUG_REFERENCE_FAMILY,
  CATCHMENT_SPILLOVER_CONFIG_VERSION,
  CATCHMENT_STRUCTURAL_CAPS,
  getCatchmentDebugPointTouchWeight,
  getCatchmentMetricCalibration,
  listCatchmentMetricCalibrations,
} from "./catchment-calibration";

describe("catchment calibration", () => {
  it("freezes a versioned launch config for every spillover family", () => {
    const calibrations = listCatchmentMetricCalibrations();

    expect(CATCHMENT_SPILLOVER_CONFIG_VERSION).toBe("county-catchment-spillover-v1");
    expect(calibrations.length).toBe(9);
  });

  it("allows weak point-touch inclusion only for the launch competition family", () => {
    const competition = getCatchmentMetricCalibration("competition-intensity");
    const absorption = getCatchmentMetricCalibration("absorption-pressure");

    expect(CATCHMENT_DEBUG_REFERENCE_FAMILY).toBe("competition-intensity");
    expect(competition.pointTouchPolicy).toBe("weak-inclusion");
    expect(competition.pointTouchWeight).toBe(0.05);
    expect(absorption.pointTouchPolicy).toBe("excluded");
    expect(absorption.pointTouchWeight).toBe(0);
    expect(getCatchmentDebugPointTouchWeight()).toBe(0.05);
  });

  it("freezes structural caps and bounded backtest search space", () => {
    expect(CATCHMENT_STRUCTURAL_CAPS.maxSingleNeighborWeightShare).toBe(0.5);
    expect(CATCHMENT_STRUCTURAL_CAPS.maxTotalSpilloverContributionShare).toBe(0.35);
    expect(CATCHMENT_BACKTEST_PROTOCOL.searchRangeMin).toBe(0);
    expect(CATCHMENT_BACKTEST_PROTOCOL.searchRangeMax).toBe(0.35);
    expect(CATCHMENT_BACKTEST_PROTOCOL.forwardWindowsMonths).toEqual([12, 24]);
  });
});
