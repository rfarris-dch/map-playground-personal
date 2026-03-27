import { z } from "zod";

export const ConfidenceLevelSchema = z.enum(["high", "medium", "low", "unknown"]);

export const FreshnessStateSchema = z.enum(["fresh", "aging", "stale", "critical", "unknown"]);

export const SuppressionStateSchema = z.enum([
  "none",
  "downgraded",
  "review_required",
  "suppressed",
]);

export const TruthModeSchema = z.enum([
  "full",
  "validated_screening",
  "derived_screening",
  "context_only",
  "internal_only",
]);

export const ConfidenceVectorSchema = z.object({
  evidenceConfidence: ConfidenceLevelSchema,
  methodConfidence: ConfidenceLevelSchema,
  coverageConfidence: ConfidenceLevelSchema,
  freshnessState: FreshnessStateSchema,
  suppressionState: SuppressionStateSchema,
});

export const FreshnessStateCountsSchema = z.object({
  fresh: z.number().int().nonnegative(),
  aging: z.number().int().nonnegative(),
  stale: z.number().int().nonnegative(),
  critical: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
});

export const SuppressionStateCountsSchema = z.object({
  none: z.number().int().nonnegative(),
  downgraded: z.number().int().nonnegative(),
  reviewRequired: z.number().int().nonnegative(),
  suppressed: z.number().int().nonnegative(),
});

export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;
export type FreshnessState = z.infer<typeof FreshnessStateSchema>;
export type SuppressionState = z.infer<typeof SuppressionStateSchema>;
export type TruthMode = z.infer<typeof TruthModeSchema>;
export type ConfidenceVector = z.infer<typeof ConfidenceVectorSchema>;
export type FreshnessStateCounts = z.infer<typeof FreshnessStateCountsSchema>;
export type SuppressionStateCounts = z.infer<typeof SuppressionStateCountsSchema>;

function getConfidenceLevelRank(value: ConfidenceLevel): number {
  switch (value) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    case "unknown":
      return 0;
    default:
      return 0;
  }
}

function getFreshnessStateRank(value: FreshnessState): number {
  switch (value) {
    case "fresh":
      return 4;
    case "aging":
      return 3;
    case "stale":
      return 2;
    case "critical":
      return 1;
    case "unknown":
      return 0;
    default:
      return 0;
  }
}

function getSuppressionStateRank(value: SuppressionState): number {
  switch (value) {
    case "none":
      return 4;
    case "downgraded":
      return 3;
    case "review_required":
      return 2;
    case "suppressed":
      return 1;
    default:
      return 1;
  }
}

function getTruthModeRank(value: TruthMode): number {
  switch (value) {
    case "full":
      return 5;
    case "validated_screening":
      return 4;
    case "derived_screening":
      return 3;
    case "context_only":
      return 2;
    case "internal_only":
      return 1;
    default:
      return 1;
  }
}

export function capConfidenceLevel(value: ConfidenceLevel, cap: ConfidenceLevel): ConfidenceLevel {
  return getConfidenceLevelRank(value) <= getConfidenceLevelRank(cap) ? value : cap;
}

export function mergeWorstFreshnessState(values: readonly FreshnessState[]): FreshnessState {
  let selected: FreshnessState = "unknown";
  let selectedRank = Number.POSITIVE_INFINITY;

  for (const value of values) {
    const rank = getFreshnessStateRank(value);
    if (rank < selectedRank) {
      selected = value;
      selectedRank = rank;
    }
  }

  return selected;
}

export function mergeMostRestrictiveSuppressionState(
  values: readonly SuppressionState[]
): SuppressionState {
  let selected: SuppressionState = "none";
  let selectedRank = Number.POSITIVE_INFINITY;

  for (const value of values) {
    const rank = getSuppressionStateRank(value);
    if (rank < selectedRank) {
      selected = value;
      selectedRank = rank;
    }
  }

  return selected;
}

export function capTruthMode(value: TruthMode, cap: TruthMode): TruthMode {
  return getTruthModeRank(value) <= getTruthModeRank(cap) ? value : cap;
}

export function deriveCompatibilityConfidenceBadge(
  confidence: ConfidenceVector
): "high" | "medium" | "low" {
  if (
    confidence.evidenceConfidence === "high" &&
    confidence.methodConfidence === "high" &&
    confidence.coverageConfidence === "high" &&
    confidence.freshnessState === "fresh" &&
    confidence.suppressionState === "none"
  ) {
    return "high";
  }

  if (
    confidence.evidenceConfidence === "low" ||
    confidence.methodConfidence === "low" ||
    confidence.coverageConfidence === "low" ||
    confidence.freshnessState === "stale" ||
    confidence.freshnessState === "critical" ||
    confidence.suppressionState === "review_required" ||
    confidence.suppressionState === "suppressed"
  ) {
    return "low";
  }

  return "medium";
}

export function deriveTruthModeSuppressionState(truthMode: TruthMode): SuppressionState {
  switch (truthMode) {
    case "internal_only":
      return "suppressed";
    case "context_only":
      return "review_required";
    case "derived_screening":
    case "validated_screening":
    case "full":
      return "none";
    default:
      return "suppressed";
  }
}

export function deriveExternalPacketSuppressionState(options: {
  readonly sectionSuppressionState: SuppressionState;
  readonly upstreamSuppressionState: SuppressionState;
  readonly truthModeCap: TruthMode;
}): SuppressionState {
  return mergeMostRestrictiveSuppressionState([
    options.sectionSuppressionState,
    options.upstreamSuppressionState,
    deriveTruthModeSuppressionState(options.truthModeCap),
  ]);
}
