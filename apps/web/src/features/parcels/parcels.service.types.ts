export interface StressGovernorController {
  destroy(): void;
  isBlocked(): boolean;
  setEnabled(enabled: boolean): void;
}

export interface StressGovernorOptions {
  readonly breachRatio?: number;
  readonly frameBudgetMs?: number;
  readonly minSampleSize?: number;
  readonly onChange?: (blocked: boolean) => void;
  readonly sampleSize?: number;
}
