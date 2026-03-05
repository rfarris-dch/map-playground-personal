export interface CreateApiAppOptions {
  readonly requestBodyLimitBytes?: number;
  readonly requestTimeoutMs?: number;
}

export interface ApiAppOptions {
  readonly requestBodyLimitBytes: number;
  readonly requestTimeoutMs: number;
}
