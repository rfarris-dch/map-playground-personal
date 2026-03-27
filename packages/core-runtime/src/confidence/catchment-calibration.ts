export type CatchmentMetricFamily =
  | "competition-intensity"
  | "absorption-pressure"
  | "development-activity"
  | "land-pipeline"
  | "facility-counts"
  | "transaction-activity"
  | "policy-governance"
  | "utility-process"
  | "seam-friction";

export type CatchmentPointTouchPolicy = "excluded" | "weak-inclusion";
export type CatchmentSpilloverClass = "high" | "medium" | "none";

export interface CatchmentMetricCalibration {
  readonly family: CatchmentMetricFamily;
  readonly includedInCatchmentScore: boolean;
  readonly launchLambda: number;
  readonly pointTouchPolicy: CatchmentPointTouchPolicy;
  readonly pointTouchWeight: number;
  readonly spilloverClass: CatchmentSpilloverClass;
}

export interface CatchmentStructuralCaps {
  readonly maxSingleNeighborWeightShare: number;
  readonly maxTotalSpilloverContributionShare: number;
}

export interface CatchmentBacktestProtocol {
  readonly forwardWindowsMonths: readonly number[];
  readonly peerGroupingStrategy: readonly string[];
  readonly searchRangeMax: number;
  readonly searchRangeMin: number;
  readonly targetSignals: readonly string[];
}

export const CATCHMENT_SPILLOVER_CONFIG_VERSION = "county-catchment-spillover-v1";
export const CATCHMENT_DEBUG_REFERENCE_FAMILY: CatchmentMetricFamily = "competition-intensity";
export const CATCHMENT_POINT_TOUCH_DOMINANCE_THRESHOLD = 0.25;

const CATCHMENT_METRIC_CALIBRATIONS: readonly CatchmentMetricCalibration[] = [
  {
    family: "competition-intensity",
    includedInCatchmentScore: true,
    launchLambda: 0.3,
    pointTouchPolicy: "weak-inclusion",
    pointTouchWeight: 0.05,
    spilloverClass: "high",
  },
  {
    family: "absorption-pressure",
    includedInCatchmentScore: true,
    launchLambda: 0.25,
    pointTouchPolicy: "excluded",
    pointTouchWeight: 0,
    spilloverClass: "high",
  },
  {
    family: "development-activity",
    includedInCatchmentScore: true,
    launchLambda: 0.2,
    pointTouchPolicy: "excluded",
    pointTouchWeight: 0,
    spilloverClass: "high",
  },
  {
    family: "land-pipeline",
    includedInCatchmentScore: true,
    launchLambda: 0.15,
    pointTouchPolicy: "excluded",
    pointTouchWeight: 0,
    spilloverClass: "medium",
  },
  {
    family: "facility-counts",
    includedInCatchmentScore: true,
    launchLambda: 0.1,
    pointTouchPolicy: "excluded",
    pointTouchWeight: 0,
    spilloverClass: "medium",
  },
  {
    family: "transaction-activity",
    includedInCatchmentScore: true,
    launchLambda: 0.1,
    pointTouchPolicy: "excluded",
    pointTouchWeight: 0,
    spilloverClass: "medium",
  },
  {
    family: "policy-governance",
    includedInCatchmentScore: false,
    launchLambda: 0,
    pointTouchPolicy: "excluded",
    pointTouchWeight: 0,
    spilloverClass: "none",
  },
  {
    family: "utility-process",
    includedInCatchmentScore: false,
    launchLambda: 0,
    pointTouchPolicy: "excluded",
    pointTouchWeight: 0,
    spilloverClass: "none",
  },
  {
    family: "seam-friction",
    includedInCatchmentScore: false,
    launchLambda: 0,
    pointTouchPolicy: "excluded",
    pointTouchWeight: 0,
    spilloverClass: "none",
  },
];

export const CATCHMENT_STRUCTURAL_CAPS: CatchmentStructuralCaps = {
  maxSingleNeighborWeightShare: 0.5,
  maxTotalSpilloverContributionShare: 0.35,
};

export const CATCHMENT_BACKTEST_PROTOCOL: CatchmentBacktestProtocol = {
  forwardWindowsMonths: [12, 24],
  peerGroupingStrategy: [
    "priority-market-vs-non-priority-market",
    "market-temperature-quintile",
    "operator-region",
  ],
  searchRangeMax: 0.35,
  searchRangeMin: 0,
  targetSignals: [
    "provider-entry-count",
    "signed-ia-growth",
    "under-construction-mw",
    "commissioned-mw",
    "transaction-activity",
  ],
};

export function listCatchmentMetricCalibrations(): readonly CatchmentMetricCalibration[] {
  return CATCHMENT_METRIC_CALIBRATIONS;
}

export function getCatchmentMetricCalibration(
  family: CatchmentMetricFamily
): CatchmentMetricCalibration {
  const calibration = CATCHMENT_METRIC_CALIBRATIONS.find((entry) => entry.family === family);
  if (calibration === undefined) {
    throw new Error(`Unknown catchment metric family: ${family}`);
  }

  return calibration;
}

export function getCatchmentDebugPointTouchWeight(): number {
  return getCatchmentMetricCalibration(CATCHMENT_DEBUG_REFERENCE_FAMILY).pointTouchWeight;
}
