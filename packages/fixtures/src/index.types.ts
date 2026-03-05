export interface TierSpec {
  notes: string;
  parcelCountMax: number;
  parcelCountMin: number;
  tier: DatasetTier;
}

export type DatasetTier = "A" | "B" | "C" | "D";
