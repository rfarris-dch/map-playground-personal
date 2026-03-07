export interface CreateApiAppOptions {
  readonly parcelsRequestTimeoutMs?: number;
  readonly requestBodyLimitBytes?: number;
  readonly requestTimeoutMs?: number;
  readonly selectionRequestTimeoutMs?: number;
}

export interface ApiAppOptions {
  readonly parcelsRequestTimeoutMs: number;
  readonly requestBodyLimitBytes: number;
  readonly requestTimeoutMs: number;
  readonly selectionRequestTimeoutMs: number;
}
