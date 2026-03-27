import type {
  BatchRunArtifactLayout,
  LakeManifestArtifactRecord,
} from "./batch-artifact-layout.types";
import type { RunBufferedCommandResult } from "./command-runner.types";
import type { DuckDbCliOptions } from "./duckdb-runner.types";
import type { FloodPlanetilerOverlayKind } from "./environmental-planetiler-inputs.types";

export type EnvironmentalFloodParityTargetName = "flood_overlay_100" | "flood_overlay_500";

export interface EnvironmentalFloodParityTargetSpec {
  readonly gpkgPath: string;
  readonly name: EnvironmentalFloodParityTargetName;
  readonly overlayKind: FloodPlanetilerOverlayKind;
}

export interface EnvironmentalFloodParityAssertionRecord {
  readonly actual_value_text: string | null;
  readonly assertion_name: string;
  readonly blocking: boolean;
  readonly column_name: string | null;
  readonly details_json: string | null;
  readonly expected_value_text: string | null;
  readonly passed: boolean;
  readonly run_id: string;
  readonly severity: "error" | "warn";
  readonly target_name: EnvironmentalFloodParityTargetName;
  readonly validated_at: string;
}

export interface EnvironmentalFloodParityProfileRecord {
  readonly canonical_schema_hash: string | null;
  readonly canonical_type: string | null;
  readonly column_name: string | null;
  readonly max_value_text: string | null;
  readonly min_value_text: string | null;
  readonly null_count: number | null;
  readonly observed_type: string | null;
  readonly parity_checksum: string | null;
  readonly profile_json: string | null;
  readonly profile_kind: "dataset";
  readonly row_count: number | null;
  readonly run_id: string;
  readonly source_name: "geopackage" | "postgres";
  readonly target_name: EnvironmentalFloodParityTargetName;
  readonly validated_at: string;
}

export interface EnvironmentalFloodParityResult {
  readonly failedAssertions: number;
  readonly passed: boolean;
  readonly qaArtifacts: readonly LakeManifestArtifactRecord[];
  readonly qaAssertionsPath: string;
  readonly qaProfilePath: string;
  readonly targetNames: readonly EnvironmentalFloodParityTargetName[];
  readonly validatedAt: string;
}

export interface EnvironmentalFloodParityValidationArgs {
  readonly context: BatchRunArtifactLayout;
  readonly dataVersion: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly failFast?: boolean;
  readonly outputRoot: string;
  readonly overlayKinds: readonly FloodPlanetilerOverlayKind[];
}

export type EnvironmentalFloodParityDuckDbRunner = (
  options: DuckDbCliOptions
) => Promise<RunBufferedCommandResult>;
