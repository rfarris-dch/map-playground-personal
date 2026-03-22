export interface AppPerformanceCounterSnapshot {
  readonly count: number;
  readonly key: string;
  readonly lastRecordedAt: string;
  readonly lastValue: number;
  readonly name: string;
  readonly tags: Readonly<Record<string, string>>;
}

export interface AppPerformanceMeasurementSnapshot {
  readonly average: number;
  readonly count: number;
  readonly key: string;
  readonly lastRecordedAt: string;
  readonly lastValue: number;
  readonly max: number;
  readonly min: number;
  readonly name: string;
  readonly tags: Readonly<Record<string, string>>;
  readonly total: number;
}

export interface AppPerformanceSnapshot {
  readonly counters: Readonly<Record<string, AppPerformanceCounterSnapshot>>;
  readonly generatedAt: string;
  readonly lastResetAt: string;
  readonly measurements: Readonly<Record<string, AppPerformanceMeasurementSnapshot>>;
  readonly status: "ok";
}

export interface AppPerformanceDebugApi {
  readonly getSnapshot: () => AppPerformanceSnapshot;
  readonly reset: () => void;
}
