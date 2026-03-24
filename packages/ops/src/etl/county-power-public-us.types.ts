import type { CountyPowerBundleManifest } from "./county-power-sync.types";
export interface CountyPowerPublicUsExtractOptions {
  readonly rawDir: string;
  readonly rawManifestPath: string;
  readonly runId: string;
}
export interface CountyPowerPublicUsExtractResult {
  readonly dataVersion: string;
  readonly effectiveDate: string;
  readonly manifest: CountyPowerBundleManifest;
  readonly manifestPath: null;
  readonly manifestUrl: null;
  readonly month: string;
}
