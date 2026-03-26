import type { LakeManifestArtifactRecord } from "./batch-artifact-layout.types";
import type { RunBufferedCommandResult } from "./command-runner.types";
import type { CountyPowerBundleManifest, CountyPowerRunContext } from "./county-power-sync.types";
import type { DuckDbCliOptions } from "./duckdb-runner.types";

export type CountyPowerGoldMartName =
  | "county_score_snapshot"
  | "coverage_by_operator"
  | "coverage_fields"
  | "publication_summary"
  | "qa_congestion"
  | "qa_operator_zone"
  | "resolution_by_source";

export interface CountyPowerGoldMartSpec {
  readonly artifact: LakeManifestArtifactRecord;
  readonly csvPath: string | null;
  readonly name: CountyPowerGoldMartName;
  readonly outputFilePath: string;
  readonly outputRootPath: string;
}

export interface CountyPowerGoldWriteArgs {
  readonly context: CountyPowerRunContext;
  readonly env?: NodeJS.ProcessEnv;
  readonly manifest: CountyPowerBundleManifest;
  readonly publicationRunId: string;
}

export type CountyPowerDuckDbRunner = (
  options: DuckDbCliOptions
) => Promise<RunBufferedCommandResult>;

export type CountyPowerGoldMirrorExporter = (args: {
  readonly context: CountyPowerRunContext;
  readonly csvPath: string;
  readonly databaseUrl: string;
  readonly env: NodeJS.ProcessEnv;
  readonly publicationRunId: string;
  readonly query: string;
}) => Promise<void>;
