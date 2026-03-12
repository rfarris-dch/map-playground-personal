export interface CreateApiAppOptions {
  readonly parcelsRequestTimeoutMs?: number;
  readonly readinessCheck?: (() => Promise<void>) | undefined;
  readonly requestBodyLimitBytes?: number;
  readonly requestTimeoutMs?: number;
  readonly selectionRequestTimeoutMs?: number;
}

export interface ApiAppOptions {
  readonly parcelsRequestTimeoutMs: number;
  readonly readinessCheck: () => Promise<void>;
  readonly requestBodyLimitBytes: number;
  readonly requestTimeoutMs: number;
  readonly selectionRequestTimeoutMs: number;
}
