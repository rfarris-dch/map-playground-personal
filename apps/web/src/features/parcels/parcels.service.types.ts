export interface StressGovernorController {
  destroy(): void;
  isBlocked(): boolean;
}

export interface StressGovernorOptions {
  readonly breachRatio?: number;
  readonly frameBudgetMs?: number;
  readonly onChange?: (blocked: boolean) => void;
  readonly sampleSize?: number;
}
