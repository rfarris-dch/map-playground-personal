export interface FiberLocatorTileSnapshot {
  readonly body: Uint8Array;
  readonly cachedAtMs: number;
  readonly headers: Headers;
  readonly status: number;
  readonly statusText: string;
}
