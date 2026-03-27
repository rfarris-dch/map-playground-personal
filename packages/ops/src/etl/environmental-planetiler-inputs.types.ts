import type { FloodCanonicalGeoParquetBand } from "./environmental-flood-geoparquet.types";
import type {
  HydroCanonicalGeoParquetFeatureKind,
  HydroCanonicalGeoParquetHucLevel,
} from "./environmental-hydro-geoparquet.types";

export type FloodPlanetilerOverlayKind = Exclude<FloodCanonicalGeoParquetBand, "full">;

export interface EnvironmentalPlanetilerInputContext {
  readonly outputRoot: string;
  readonly runDir: string;
  readonly runDuckDbBootstrapPath: string;
  readonly runDuckDbPath: string;
}

export interface FloodPlanetilerInputSpec {
  readonly lakeVersionRootPath: string;
  readonly outputs: readonly FloodPlanetilerOverlayOutput[];
}

export interface FloodPlanetilerOverlayOutput {
  readonly outputPath: string;
  readonly overlayKind: FloodPlanetilerOverlayKind;
}

export interface FloodPlanetilerPackagingProgress {
  readonly chunkSize: number;
  readonly completedChunks: number;
  readonly completedSourceRows: number;
  readonly outputPath: string;
  readonly overlayKind: FloodPlanetilerOverlayKind;
  readonly percentComplete: number;
  readonly phase: "completed" | "index" | "merge" | "subdivide";
  readonly progressVersion: "flood-planetiler-package-progress-v1";
  readonly totalChunks: number;
  readonly totalSourceRows: number;
  readonly updatedAt: string;
}

export interface HydroPlanetilerInputSpec {
  readonly lakeVersionRootPath: string;
  readonly outputs: readonly HydroPlanetilerOutput[];
}

export interface HydroPlanetilerOutput {
  readonly featureKind: HydroCanonicalGeoParquetFeatureKind;
  readonly hucLevel: HydroCanonicalGeoParquetHucLevel;
  readonly outputPath: string;
}

export interface WriteFloodPlanetilerInputsArgs {
  readonly context: EnvironmentalPlanetilerInputContext;
  readonly env?: NodeJS.ProcessEnv;
  readonly lakeVersionRootPath: string;
  readonly overlayKinds: readonly FloodPlanetilerOverlayKind[];
}

export interface WriteHydroPlanetilerInputsArgs {
  readonly context: EnvironmentalPlanetilerInputContext;
  readonly env?: NodeJS.ProcessEnv;
  readonly lakeVersionRootPath: string;
}
