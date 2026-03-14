import type { FiberLocatorLayer } from "@map-migration/http-contracts/fiber-locator-http";

export type FiberLocatorTileFormat = "png" | "pbf";

export interface FiberLocatorConfig {
  readonly apiBaseUrl: string;
  readonly lineIds: readonly string[];
  readonly requestTimeoutMs: number;
  readonly staticToken: string;
  readonly tileCacheMaxEntries: number;
  readonly tileCacheTtlMs: number;
}

export interface FiberLocatorUpstreamLayer {
  readonly branch: string | null;
  readonly color: string | null;
  readonly commonName: string;
  readonly geomType: string | null;
  readonly layerName: string;
}

export interface FiberLocatorTileRequest {
  readonly format: FiberLocatorTileFormat;
  readonly layerName: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface FiberLocatorCatalogResult {
  readonly layers: readonly FiberLocatorLayer[];
}

export interface FiberLocatorLayersInViewResult {
  readonly layerNames: readonly string[];
}
