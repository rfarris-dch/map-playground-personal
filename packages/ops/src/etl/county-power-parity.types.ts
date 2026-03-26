import type { LakeManifestArtifactRecord } from "./batch-artifact-layout.types";
import type { RunBufferedCommandResult } from "./command-runner.types";
import type { CountyPowerGoldMartName } from "./county-power-gold-marts.types";
import type { CountyPowerBundleManifest, CountyPowerRunContext } from "./county-power-sync.types";
import type { DuckDbCliOptions } from "./duckdb-runner.types";

export type CountyPowerParityCanonicalType =
  | "bool"
  | "date"
  | "decimal"
  | "int"
  | "json"
  | "json_array"
  | "pg_text_array"
  | "text"
  | "timestamp_utc";

export type CountyPowerParityTargetRole = "control" | "derived_gate";

export interface CountyPowerParityTargetSpec {
  readonly columnTypeOverrides?: Readonly<Record<string, CountyPowerParityCanonicalType>>;
  readonly keyColumns: readonly string[];
  readonly name: CountyPowerGoldMartName;
  readonly postgresQuery: (args: {
    readonly effectiveDate: string;
    readonly month: string;
    readonly publicationRunId: string;
  }) => string;
  readonly role: CountyPowerParityTargetRole;
}

export interface CountyPowerParityAssertionRecord {
  readonly actual_value_text: string | null;
  readonly assertion_name: string;
  readonly blocking: boolean;
  readonly column_name: string | null;
  readonly details_json: string | null;
  readonly expected_value_text: string | null;
  readonly passed: boolean;
  readonly publication_run_id: string;
  readonly run_id: string;
  readonly severity: "error" | "warn";
  readonly target_name: CountyPowerGoldMartName;
  readonly target_role: CountyPowerParityTargetRole;
  readonly validated_at: string;
}

export interface CountyPowerParityProfileRecord {
  readonly canonical_schema_hash: string | null;
  readonly canonical_type: CountyPowerParityCanonicalType | null;
  readonly column_name: string | null;
  readonly max_value_text: string | null;
  readonly min_value_text: string | null;
  readonly null_count: number | null;
  readonly observed_type: string | null;
  readonly parity_checksum: string | null;
  readonly profile_json: string | null;
  readonly profile_kind: "column" | "dataset";
  readonly publication_run_id: string;
  readonly row_count: number | null;
  readonly run_id: string;
  readonly source_name: "parquet" | "postgres";
  readonly target_name: CountyPowerGoldMartName;
  readonly validated_at: string;
}

export interface CountyPowerParityResult {
  readonly failedAssertions: number;
  readonly passed: boolean;
  readonly qaArtifacts: readonly LakeManifestArtifactRecord[];
  readonly qaAssertionsPath: string;
  readonly qaProfilePath: string;
  readonly validatedAt: string;
}

export interface CountyPowerParityValidationArgs {
  readonly context: CountyPowerRunContext;
  readonly emitQa?: boolean;
  readonly env?: NodeJS.ProcessEnv;
  readonly failFast?: boolean;
  readonly manifest: CountyPowerBundleManifest;
  readonly publicationRunId: string;
}

export type CountyPowerParityDuckDbRunner = (
  options: DuckDbCliOptions
) => Promise<RunBufferedCommandResult>;

export type CountyPowerParityCsvExporter = (args: {
  readonly context: CountyPowerRunContext;
  readonly csvPath: string;
  readonly databaseUrl: string;
  readonly env: NodeJS.ProcessEnv;
  readonly query: string;
}) => Promise<void>;
