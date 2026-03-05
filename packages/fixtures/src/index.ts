import type { DatasetTier, TierSpec } from "./index.types";

export type { DatasetTier, TierSpec } from "./index.types";

export const DATASET_TIERS: Record<DatasetTier, TierSpec> = {
  A: {
    tier: "A",
    parcelCountMin: 100_000,
    parcelCountMax: 100_000,
    notes: "Development sanity tier",
  },
  B: {
    tier: "B",
    parcelCountMin: 10_000_000,
    parcelCountMax: 30_000_000,
    notes: "Production-like parcel scale",
  },
  C: {
    tier: "C",
    parcelCountMin: 80_000_000,
    parcelCountMax: 120_000_000,
    notes: "Stress parcel scale",
  },
  D: {
    tier: "D",
    parcelCountMin: 80_000_000,
    parcelCountMax: 120_000_000,
    notes: "Stress scale with high interaction concurrency",
  },
};

export function getTierSpec(tier: DatasetTier): TierSpec {
  return DATASET_TIERS[tier];
}
