import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ensureDirectory, fileExists, writeTextAtomic } from "./atomic-file-store";
import { mergeLakeManifestArtifacts } from "./batch-artifact-layout";
import type { LakeManifestArtifactRecord } from "./batch-artifact-layout.types";
import { runBufferedCommand } from "./command-runner";
import type { RunBufferedCommandResult } from "./command-runner.types";
import { buildCountyPowerGoldMartSpecs } from "./county-power-gold-marts";
import type { CountyPowerGoldMartSpec } from "./county-power-gold-marts.types";
import type {
  CountyPowerParityAssertionRecord,
  CountyPowerParityCanonicalType,
  CountyPowerParityCsvExporter,
  CountyPowerParityDuckDbRunner,
  CountyPowerParityProfileRecord,
  CountyPowerParityResult,
  CountyPowerParityTargetRole,
  CountyPowerParityTargetSpec,
  CountyPowerParityValidationArgs,
} from "./county-power-parity.types";
import { writeDuckDbBootstrapSql } from "./duckdb-bootstrap";
import { runDuckDbCli } from "./duckdb-runner";

const FIELD_SEPARATOR = "\u001f";
const NULL_SENTINEL = "__NULL__";
const PARITY_DUCKDB_JSON_CAPTURE_MAX_BYTES = 32_000_000;
const PSQL_COPY_ROW_COUNT_RE = /COPY\s+(\d+)/;
const SQL_STRING_ESCAPE_RE = /'/g;
const TARGET_SEPARATOR = "\u001e";
const JSON_PAYLOAD_START_RE = /\[|{/;

interface DuckDbDescribeRow {
  readonly column_name: string;
  readonly column_type: string;
}

interface CountyPowerParityColumnSpec {
  readonly canonicalType: CountyPowerParityCanonicalType;
  readonly name: string;
}

interface CountyPowerParityColumnMetrics {
  readonly maxValueText: string | null;
  readonly minValueText: string | null;
  readonly nullCount: number;
}

interface CountyPowerParitySourceSnapshot {
  readonly columns: readonly CountyPowerParityColumnSpec[];
  readonly observedTypes: Readonly<Record<string, string | null>>;
  readonly parityChecksum: string;
  readonly rowCount: number;
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  readonly schemaHash: string;
}

interface CountyPowerParityTargetComparison {
  readonly assertions: readonly CountyPowerParityAssertionRecord[];
  readonly profiles: readonly CountyPowerParityProfileRecord[];
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function copyProcessEnvironment(
  envSource: NodeJS.ProcessEnv = process.env
): Record<string, string> {
  return Object.entries(envSource).reduce<Record<string, string>>((next, [key, value]) => {
    if (typeof value === "string") {
      next[key] = value;
    }

    return next;
  }, {});
}

function toSqlStringLiteral(value: string): string {
  return `'${value.replace(SQL_STRING_ESCAPE_RE, "''")}'`;
}

function summarizeCommandFailure(result: RunBufferedCommandResult): string {
  const trimmedStderr = result.stderr.trim();
  if (trimmedStderr.length > 0) {
    return trimmedStderr;
  }

  const trimmedStdout = result.stdout.trim();
  if (trimmedStdout.length > 0) {
    return trimmedStdout;
  }

  return "Command produced no output";
}

function collapseSqlWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripAnsiDisplayCodes(value: string): string {
  let stripped = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== "\u001b") {
      stripped += character;
      continue;
    }

    const nextCharacter = value[index + 1];
    if (nextCharacter !== "[") {
      continue;
    }

    index += 2;
    while (index < value.length && value[index] !== "m") {
      index += 1;
    }
  }

  return stripped;
}

function resolveDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const connectionString = env.DATABASE_URL ?? env.POSTGRES_URL;
  if (typeof connectionString === "string" && connectionString.trim().length > 0) {
    return connectionString.trim();
  }

  throw new Error("Missing DATABASE_URL or POSTGRES_URL");
}

function readCopiedRowCount(result: RunBufferedCommandResult): number | null {
  const match = result.stdout.match(PSQL_COPY_ROW_COUNT_RE);
  if (match?.[1] === undefined) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

function normalizeObservedTypeToCanonicalType(type: string): CountyPowerParityCanonicalType {
  const normalized = type.toUpperCase();
  if (
    normalized.includes("BIGINT") ||
    normalized.includes("INTEGER") ||
    normalized.includes("INT")
  ) {
    return "int";
  }
  if (
    normalized.includes("DECIMAL") ||
    normalized.includes("NUMERIC") ||
    normalized.includes("DOUBLE") ||
    normalized.includes("FLOAT") ||
    normalized.includes("REAL")
  ) {
    return "decimal";
  }
  if (normalized.includes("BOOLEAN") || normalized.includes("BOOL")) {
    return "bool";
  }
  if (normalized.includes("TIMESTAMP")) {
    return "timestamp_utc";
  }
  if (normalized.includes("DATE")) {
    return "date";
  }
  if (normalized.includes("JSON")) {
    return "json";
  }
  if (normalized.endsWith("[]")) {
    return "pg_text_array";
  }

  return "text";
}

function resolveCountyPowerParityTargetSpecs(): readonly CountyPowerParityTargetSpec[] {
  return [
    {
      columnTypeOverrides: {
        deferred_reason_codes_json: "json_array",
        pillar_value_states_json: "json",
        source_provenance_json: "json",
        top_constraints_json: "json_array",
        top_drivers_json: "json_array",
        utility_context_json: "json",
        what_changed_30d_json: "json_array",
        what_changed_60d_json: "json_array",
        what_changed_90d_json: "json_array",
      },
      keyColumns: ["county_geoid"],
      name: "county_score_snapshot",
      postgresQuery: ({ publicationRunId }) => `SELECT *
FROM analytics.fact_market_analysis_score_snapshot
WHERE publication_run_id = ${toSqlStringLiteral(publicationRunId)}
ORDER BY county_geoid`,
      role: "control",
    },
    {
      columnTypeOverrides: {
        available_feature_families: "pg_text_array",
        missing_feature_families: "pg_text_array",
        notes: "json",
        source_versions_json: "json",
      },
      keyColumns: ["publication_run_id"],
      name: "publication_summary",
      postgresQuery: ({ publicationRunId }) => `SELECT *
FROM analytics.fact_publication
WHERE publication_run_id = ${toSqlStringLiteral(publicationRunId)}
ORDER BY publication_run_id`,
      role: "control",
    },
    {
      keyColumns: ["field_name"],
      name: "coverage_fields",
      postgresQuery: ({ publicationRunId }) => `WITH current_scores AS (
  SELECT *
  FROM analytics.fact_market_analysis_score_snapshot
  WHERE publication_run_id = ${toSqlStringLiteral(publicationRunId)}
)
SELECT
  field_coverage.field_name,
  field_coverage.populated_count,
  field_coverage.total_count
FROM (
  SELECT
    'wholesaleOperator'::text AS field_name,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(wholesale_operator), '') IS NOT NULL)::integer
      AS populated_count,
    COUNT(*)::integer AS total_count
  FROM current_scores
  UNION ALL
  SELECT
    'balancingAuthority'::text,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(balancing_authority), '') IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
  UNION ALL
  SELECT
    'primaryTduOrUtility'::text,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(primary_tdu_or_utility), '') IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
  UNION ALL
  SELECT
    'operatorZoneLabel'::text,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(operator_zone_label), '') IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
  UNION ALL
  SELECT
    'operatorWeatherZone'::text,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(operator_weather_zone), '') IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
  UNION ALL
  SELECT
    'meteoZone'::text,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(meteo_zone), '') IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
  UNION ALL
  SELECT
    'avgRtCongestionComponent'::text,
    COUNT(*) FILTER (WHERE avg_rt_congestion_component IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
  UNION ALL
  SELECT
    'p95ShadowPrice'::text,
    COUNT(*) FILTER (WHERE p95_shadow_price IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
  UNION ALL
  SELECT
    'queueProjectCountActive'::text,
    COUNT(*) FILTER (WHERE queue_project_count_active IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
  UNION ALL
  SELECT
    'queueMwActive'::text,
    COUNT(*) FILTER (WHERE queue_mw_active IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
) AS field_coverage
ORDER BY field_coverage.field_name`,
      role: "derived_gate",
    },
    {
      keyColumns: ["wholesale_operator"],
      name: "coverage_by_operator",
      postgresQuery: ({ publicationRunId }) => `SELECT
  COALESCE(NULLIF(BTRIM(wholesale_operator), ''), 'unknown') AS wholesale_operator,
  COUNT(*)::integer AS county_count,
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(operator_zone_label), '') IS NOT NULL)::integer
    AS operator_zone_label_count,
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(operator_weather_zone), '') IS NOT NULL)::integer
    AS operator_weather_zone_count,
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(meteo_zone), '') IS NOT NULL)::integer
    AS meteo_zone_count,
  COUNT(*) FILTER (WHERE avg_rt_congestion_component IS NOT NULL)::integer
    AS avg_rt_congestion_component_count,
  COUNT(*) FILTER (WHERE p95_shadow_price IS NOT NULL)::integer AS p95_shadow_price_count,
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(primary_tdu_or_utility), '') IS NOT NULL)::integer
    AS primary_tdu_or_utility_count
FROM analytics.fact_market_analysis_score_snapshot
WHERE publication_run_id = ${toSqlStringLiteral(publicationRunId)}
GROUP BY COALESCE(NULLIF(BTRIM(wholesale_operator), ''), 'unknown')
ORDER BY COALESCE(NULLIF(BTRIM(wholesale_operator), ''), 'unknown')`,
      role: "derived_gate",
    },
    {
      columnTypeOverrides: {
        sample_location_labels: "json_array",
        sample_poi_labels: "json_array",
        sample_snapshot_location_labels: "json_array",
        sample_snapshot_poi_labels: "json_array",
      },
      keyColumns: ["source_system"],
      name: "resolution_by_source",
      postgresQuery: ({ effectiveDate }) => `WITH latest_projects AS (
  SELECT *
  FROM analytics.fact_gen_queue_project
),
latest_resolutions AS (
  SELECT *
  FROM analytics.fact_gen_queue_county_resolution
  WHERE effective_date = ${toSqlStringLiteral(effectiveDate)}::date
),
latest_unresolved AS (
  SELECT *
  FROM analytics.fact_gen_queue_unresolved
  WHERE effective_date = ${toSqlStringLiteral(effectiveDate)}::date
),
latest_snapshots AS (
  SELECT *
  FROM analytics.fact_gen_queue_snapshot
  WHERE effective_date = ${toSqlStringLiteral(effectiveDate)}::date
),
project_totals AS (
  SELECT source_system, COUNT(*)::integer AS total_projects
  FROM latest_projects
  GROUP BY source_system
),
snapshot_totals AS (
  SELECT source_system, COUNT(*)::integer AS total_snapshots
  FROM latest_snapshots
  GROUP BY source_system
),
resolution_totals AS (
  SELECT
    source_system,
    COUNT(*) FILTER (
      WHERE resolver_type = 'manual_override'
    )::integer AS manual_resolution_count,
    COUNT(*) FILTER (
      WHERE resolver_type IN ('explicit_county', 'explicit_multi_county')
    )::integer AS direct_resolution_count,
    COUNT(*) FILTER (
      WHERE resolver_type NOT IN ('manual_override', 'explicit_county', 'explicit_multi_county')
    )::integer AS derived_resolution_count,
    COUNT(*) FILTER (WHERE resolver_confidence = 'low')::integer
      AS low_confidence_resolution_count
  FROM latest_resolutions
  GROUP BY source_system
),
unresolved_projects AS (
  SELECT
    unresolved.source_system,
    COUNT(*)::integer AS unresolved_projects
  FROM latest_unresolved AS unresolved
  GROUP BY unresolved.source_system
),
unresolved_snapshots AS (
  SELECT
    snapshot.source_system,
    COUNT(*)::integer AS unresolved_snapshots
  FROM latest_snapshots AS snapshot
  LEFT JOIN latest_resolutions AS resolution
    ON resolution.project_id = snapshot.project_id
    AND resolution.source_system = snapshot.source_system
  WHERE snapshot.county_geoid IS NULL
    AND resolution.project_id IS NULL
  GROUP BY snapshot.source_system
),
unresolved_project_samples AS (
  SELECT
    unresolved.source_system,
    unresolved.project_id,
    NULLIF(BTRIM(unresolved.queue_poi_label), '') AS queue_poi_label,
    NULLIF(BTRIM(unresolved.raw_location_label), '') AS queue_name,
    ROW_NUMBER() OVER (
      PARTITION BY unresolved.source_system
      ORDER BY unresolved.project_id
    ) AS sample_rank
  FROM latest_unresolved AS unresolved
),
sample_labels AS (
  SELECT
    source_system,
    TO_JSON(
      COALESCE(
        ARRAY_AGG(queue_poi_label) FILTER (
          WHERE sample_rank <= 5
            AND queue_poi_label IS NOT NULL
        ),
        '{}'::text[]
      )
    ) AS sample_poi_labels,
    TO_JSON(
      COALESCE(
        ARRAY_AGG(queue_name) FILTER (
          WHERE sample_rank <= 5
            AND queue_name IS NOT NULL
        ),
        '{}'::text[]
      )
    ) AS sample_location_labels
  FROM unresolved_project_samples
  GROUP BY source_system
),
unresolved_snapshot_samples AS (
  SELECT
    snapshot.source_system,
    snapshot.project_id,
    NULLIF(BTRIM(project.queue_poi_label), '') AS queue_poi_label,
    NULLIF(BTRIM(project.queue_name), '') AS queue_name,
    ROW_NUMBER() OVER (
      PARTITION BY snapshot.source_system
      ORDER BY snapshot.project_id
    ) AS sample_rank
  FROM latest_snapshots AS snapshot
  LEFT JOIN latest_projects AS project
    ON project.project_id = snapshot.project_id
    AND project.source_system = snapshot.source_system
  LEFT JOIN latest_resolutions AS resolution
    ON resolution.project_id = snapshot.project_id
    AND resolution.source_system = snapshot.source_system
  WHERE snapshot.county_geoid IS NULL
    AND resolution.project_id IS NULL
),
sample_snapshot_labels AS (
  SELECT
    source_system,
    TO_JSON(
      COALESCE(
        ARRAY_AGG(queue_poi_label) FILTER (
          WHERE sample_rank <= 5
            AND queue_poi_label IS NOT NULL
        ),
        '{}'::text[]
      )
    ) AS sample_snapshot_poi_labels,
    TO_JSON(
      COALESCE(
        ARRAY_AGG(queue_name) FILTER (
          WHERE sample_rank <= 5
            AND queue_name IS NOT NULL
        ),
        '{}'::text[]
      )
    ) AS sample_snapshot_location_labels
  FROM unresolved_snapshot_samples
  GROUP BY source_system
),
source_systems AS (
  SELECT source_system FROM project_totals
  UNION
  SELECT source_system FROM snapshot_totals
  UNION
  SELECT source_system FROM resolution_totals
  UNION
  SELECT source_system FROM unresolved_projects
  UNION
  SELECT source_system FROM unresolved_snapshots
  UNION
  SELECT source_system FROM latest_unresolved
)
SELECT
  source_systems.source_system,
  COALESCE(project_totals.total_projects, 0) AS total_projects,
  COALESCE(unresolved_projects.unresolved_projects, 0) AS unresolved_projects,
  COALESCE(snapshot_totals.total_snapshots, 0) AS total_snapshots,
  COALESCE(unresolved_snapshots.unresolved_snapshots, 0) AS unresolved_snapshots,
  COALESCE(resolution_totals.direct_resolution_count, 0) AS direct_resolution_count,
  COALESCE(resolution_totals.derived_resolution_count, 0) AS derived_resolution_count,
  COALESCE(resolution_totals.manual_resolution_count, 0) AS manual_resolution_count,
  COALESCE(resolution_totals.low_confidence_resolution_count, 0)
    AS low_confidence_resolution_count,
  COALESCE(sample_labels.sample_poi_labels, '[]'::json) AS sample_poi_labels,
  COALESCE(sample_labels.sample_location_labels, '[]'::json) AS sample_location_labels,
  COALESCE(sample_snapshot_labels.sample_snapshot_poi_labels, '[]'::json)
    AS sample_snapshot_poi_labels,
  COALESCE(sample_snapshot_labels.sample_snapshot_location_labels, '[]'::json)
    AS sample_snapshot_location_labels,
  ${toSqlStringLiteral(effectiveDate)}::date AS effective_date
FROM source_systems
LEFT JOIN project_totals
  ON project_totals.source_system = source_systems.source_system
LEFT JOIN unresolved_projects
  ON unresolved_projects.source_system = source_systems.source_system
LEFT JOIN snapshot_totals
  ON snapshot_totals.source_system = source_systems.source_system
LEFT JOIN unresolved_snapshots
  ON unresolved_snapshots.source_system = source_systems.source_system
LEFT JOIN resolution_totals
  ON resolution_totals.source_system = source_systems.source_system
LEFT JOIN sample_labels
  ON sample_labels.source_system = source_systems.source_system
LEFT JOIN sample_snapshot_labels
  ON sample_snapshot_labels.source_system = source_systems.source_system
ORDER BY source_systems.source_system`,
      role: "derived_gate",
    },
    {
      keyColumns: [
        "county_fips",
        "wholesale_operator",
        "operator_zone_label",
        "operator_zone_type",
      ],
      name: "qa_operator_zone",
      postgresQuery: ({ effectiveDate }) => `SELECT
  bridge.county_geoid AS county_fips,
  bridge.wholesale_operator,
  bridge.operator_zone_label,
  bridge.operator_zone_type,
  bridge.operator_zone_confidence,
  bridge.resolution_method,
  bridge.allocation_share,
  bridge.source_as_of_date
FROM analytics.bridge_county_operator_zone AS bridge
WHERE bridge.effective_date = ${toSqlStringLiteral(effectiveDate)}::date
ORDER BY bridge.county_geoid, bridge.wholesale_operator, bridge.operator_zone_label, bridge.operator_zone_type`,
      role: "derived_gate",
    },
    {
      keyColumns: ["county_fips"],
      name: "qa_congestion",
      postgresQuery: ({ effectiveDate, month }) => `SELECT
  snapshot.county_geoid AS county_fips,
  snapshot.avg_rt_congestion_component,
  snapshot.p95_shadow_price,
  snapshot.negative_price_hour_share,
  snapshot.source_as_of_date
FROM analytics.fact_congestion_snapshot AS snapshot
WHERE snapshot.effective_date = ${toSqlStringLiteral(effectiveDate)}::date
  AND snapshot.month = ${toSqlStringLiteral(month)}::date
ORDER BY snapshot.county_geoid`,
      role: "derived_gate",
    },
  ];
}

function stableStringifyJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringifyJson(item)).join(",")}]`;
  }
  if (isJsonRecord(value)) {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${stableStringifyJson(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function parseJsonLike(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parsePgTextArray(value: string): readonly string[] {
  if (value.startsWith("[") && value.endsWith("]")) {
    const parsed = parseJsonLike(value);
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [value];
  }
  if (!(value.startsWith("{") && value.endsWith("}"))) {
    return [value];
  }

  const entries: string[] = [];
  let current = "";
  let escapeNext = false;
  let inQuotes = false;
  const inner = value.slice(1, -1);
  if (inner.length === 0) {
    return [];
  }

  for (const character of inner) {
    if (escapeNext) {
      current += character;
      escapeNext = false;
      continue;
    }
    if (character === "\\") {
      escapeNext = true;
      continue;
    }
    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (character === "," && !inQuotes) {
      entries.push(current);
      current = "";
      continue;
    }

    current += character;
  }
  entries.push(current);

  return entries.map((entry) => entry.trim());
}

function normalizeDecimalString(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) {
    return trimmed;
  }

  if (Object.is(numeric, -0)) {
    return "0";
  }

  return numeric.toString();
}

function normalizeTimestampValue(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function normalizeDateValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function normalizeBooleanValue(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "t" || normalized === "true") {
    return "true";
  }
  if (normalized === "0" || normalized === "f" || normalized === "false") {
    return "false";
  }

  return value;
}

function normalizeJsonLikeValue(value: unknown): string {
  if (typeof value === "string") {
    return stableStringifyJson(parseJsonLike(value));
  }

  return stableStringifyJson(value);
}

function normalizePgTextArrayValue(value: unknown): string {
  if (Array.isArray(value)) {
    return stableStringifyJson(value.map((entry) => String(entry)));
  }
  if (typeof value === "string") {
    return stableStringifyJson(parsePgTextArray(value));
  }

  return stableStringifyJson([String(value)]);
}

function normalizeValue(value: unknown, type: CountyPowerParityCanonicalType): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" && value.length === 0) {
    return type === "text" ? "" : normalizeValue(value.trim(), type);
  }

  switch (type) {
    case "bool":
      return normalizeBooleanValue(String(value));
    case "date":
      return normalizeDateValue(String(value));
    case "decimal":
      return normalizeDecimalString(String(value));
    case "int":
      return normalizeDecimalString(String(value));
    case "json":
      return normalizeJsonLikeValue(value);
    case "json_array":
      return normalizeJsonLikeValue(value);
    case "pg_text_array":
      return normalizePgTextArrayValue(value);
    case "text":
      return String(value);
    case "timestamp_utc":
      return normalizeTimestampValue(String(value));
    default:
      return String(value);
  }
}

function canonicalValueForChecksum(
  row: Readonly<Record<string, unknown>>,
  column: CountyPowerParityColumnSpec
): string {
  return normalizeValue(row[column.name], column.canonicalType) ?? NULL_SENTINEL;
}

function compareCanonicalValues(
  type: CountyPowerParityCanonicalType,
  left: string,
  right: string
): number {
  if (type === "int" || type === "decimal") {
    return Number(left) - Number(right);
  }
  if (type === "bool") {
    return normalizeBooleanValue(left).localeCompare(normalizeBooleanValue(right));
  }

  return left.localeCompare(right);
}

function shouldProfileMinMax(type: CountyPowerParityCanonicalType): boolean {
  return type !== "json" && type !== "json_array" && type !== "pg_text_array";
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function buildSchemaHash(columns: readonly CountyPowerParityColumnSpec[]): string {
  return hashText(
    columns.map((column) => `${column.name}:${column.canonicalType}`).join(TARGET_SEPARATOR)
  );
}

function buildParityChecksum(args: {
  readonly columns: readonly CountyPowerParityColumnSpec[];
  readonly keyColumns: readonly string[];
  readonly rows: readonly Readonly<Record<string, unknown>>[];
}): string {
  const sortedRows = [...args.rows].sort((left, right) => {
    for (const keyColumn of args.keyColumns) {
      const column = args.columns.find((candidate) => candidate.name === keyColumn);
      if (column === undefined) {
        continue;
      }

      const leftValue = canonicalValueForChecksum(left, column);
      const rightValue = canonicalValueForChecksum(right, column);
      const comparison = leftValue.localeCompare(rightValue);
      if (comparison !== 0) {
        return comparison;
      }
    }

    return 0;
  });
  const serialized = sortedRows
    .map((row) =>
      args.columns.map((column) => canonicalValueForChecksum(row, column)).join(FIELD_SEPARATOR)
    )
    .join(TARGET_SEPARATOR);

  return hashText(serialized);
}

function computeColumnMetrics(args: {
  readonly column: CountyPowerParityColumnSpec;
  readonly rows: readonly Readonly<Record<string, unknown>>[];
}): CountyPowerParityColumnMetrics {
  let nullCount = 0;
  let minValueText: string | null = null;
  let maxValueText: string | null = null;

  for (const row of args.rows) {
    const normalizedValue = normalizeValue(row[args.column.name], args.column.canonicalType);
    if (normalizedValue === null) {
      nullCount += 1;
      continue;
    }

    if (!shouldProfileMinMax(args.column.canonicalType)) {
      continue;
    }
    if (
      minValueText === null ||
      compareCanonicalValues(args.column.canonicalType, normalizedValue, minValueText) < 0
    ) {
      minValueText = normalizedValue;
    }
    if (
      maxValueText === null ||
      compareCanonicalValues(args.column.canonicalType, normalizedValue, maxValueText) > 0
    ) {
      maxValueText = normalizedValue;
    }
  }

  return {
    maxValueText,
    minValueText,
    nullCount,
  };
}

function buildDuckDbReadRowsSql(args: {
  readonly inputPath: string;
  readonly inputType: "csv" | "parquet";
  readonly keyColumns: readonly string[];
}): string {
  const source =
    args.inputType === "csv"
      ? `read_csv_auto(${toSqlStringLiteral(args.inputPath)}, HEADER = true, SAMPLE_SIZE = -1)`
      : `read_parquet(${toSqlStringLiteral(args.inputPath)}, hive_partitioning = false)`;

  return `SELECT *
FROM ${source}
ORDER BY ${args.keyColumns.join(", ")}`;
}

function buildDuckDbDescribeSql(args: {
  readonly inputPath: string;
  readonly inputType: "csv" | "parquet";
}): string {
  const source =
    args.inputType === "csv"
      ? `read_csv_auto(${toSqlStringLiteral(args.inputPath)}, HEADER = true, SAMPLE_SIZE = -1)`
      : `read_parquet(${toSqlStringLiteral(args.inputPath)}, hive_partitioning = false)`;

  return `SELECT *
FROM (
  DESCRIBE SELECT *
  FROM ${source}
)`;
}

function decodeDuckDbJsonRows(value: string): readonly Readonly<Record<string, unknown>>[] {
  const normalized = stripAnsiDisplayCodes(value).trim();
  if (normalized.length === 0) {
    return [];
  }

  const payloadStart = normalized.search(JSON_PAYLOAD_START_RE);
  const payload = payloadStart >= 0 ? normalized.slice(payloadStart) : normalized;
  const parsed = JSON.parse(payload);
  if (!(Array.isArray(parsed) && parsed.every((entry) => isJsonRecord(entry)))) {
    throw new Error("Expected DuckDB JSON output to be an array of records");
  }

  return parsed;
}

function decodeDuckDbDescribeRows(
  rows: readonly Readonly<Record<string, unknown>>[]
): readonly DuckDbDescribeRow[] {
  return rows.flatMap((row) => {
    const columnName = row.column_name;
    const columnType = row.column_type;
    if (typeof columnName !== "string" || typeof columnType !== "string") {
      return [];
    }

    return [
      {
        column_name: columnName,
        column_type: columnType,
      },
    ];
  });
}

function resolveColumnSpecs(args: {
  readonly overrides: Readonly<Record<string, CountyPowerParityCanonicalType>> | undefined;
  readonly parquetSchema: readonly DuckDbDescribeRow[];
  readonly postgresSchema: readonly DuckDbDescribeRow[];
}): {
  readonly columns: readonly CountyPowerParityColumnSpec[];
  readonly parquetObservedTypes: Readonly<Record<string, string | null>>;
  readonly postgresObservedTypes: Readonly<Record<string, string | null>>;
} {
  const orderedNames = args.parquetSchema.map((column) => column.column_name);
  for (const column of args.postgresSchema) {
    if (!orderedNames.includes(column.column_name)) {
      orderedNames.push(column.column_name);
    }
  }

  const parquetObservedTypes: Record<string, string | null> = {};
  const postgresObservedTypes: Record<string, string | null> = {};
  const columns = orderedNames.map((columnName) => {
    const parquetObservedType =
      args.parquetSchema.find((column) => column.column_name === columnName)?.column_type ?? null;
    const postgresObservedType =
      args.postgresSchema.find((column) => column.column_name === columnName)?.column_type ?? null;
    const inferredType = normalizeObservedTypeToCanonicalType(
      parquetObservedType ?? postgresObservedType ?? "VARCHAR"
    );

    parquetObservedTypes[columnName] = parquetObservedType;
    postgresObservedTypes[columnName] = postgresObservedType;

    return {
      canonicalType: args.overrides?.[columnName] ?? inferredType,
      name: columnName,
    };
  });

  return {
    columns,
    parquetObservedTypes,
    postgresObservedTypes,
  };
}

function buildProfiles(args: {
  readonly observedTypes: Readonly<Record<string, string | null>>;
  readonly publicationRunId: string;
  readonly role: CountyPowerParityTargetRole;
  readonly runId: string;
  readonly sourceName: "parquet" | "postgres";
  readonly sourceSnapshot: CountyPowerParitySourceSnapshot;
  readonly targetName: CountyPowerGoldMartSpec["name"];
  readonly validatedAt: string;
}): readonly CountyPowerParityProfileRecord[] {
  const datasetProfile: CountyPowerParityProfileRecord = {
    canonical_schema_hash: args.sourceSnapshot.schemaHash,
    canonical_type: null,
    column_name: null,
    max_value_text: null,
    min_value_text: null,
    null_count: null,
    observed_type: null,
    parity_checksum: args.sourceSnapshot.parityChecksum,
    profile_json: JSON.stringify({
      role: args.role,
    }),
    profile_kind: "dataset",
    publication_run_id: args.publicationRunId,
    row_count: args.sourceSnapshot.rowCount,
    run_id: args.runId,
    source_name: args.sourceName,
    target_name: args.targetName,
    validated_at: args.validatedAt,
  };

  const columnProfiles = args.sourceSnapshot.columns.map((column) => {
    const columnMetrics = computeColumnMetrics({
      column,
      rows: args.sourceSnapshot.rows,
    });

    return {
      canonical_schema_hash: null,
      canonical_type: column.canonicalType,
      column_name: column.name,
      max_value_text: columnMetrics.maxValueText,
      min_value_text: columnMetrics.minValueText,
      null_count: columnMetrics.nullCount,
      observed_type: args.observedTypes[column.name] ?? null,
      parity_checksum: null,
      profile_json: null,
      profile_kind: "column",
      publication_run_id: args.publicationRunId,
      row_count: null,
      run_id: args.runId,
      source_name: args.sourceName,
      target_name: args.targetName,
      validated_at: args.validatedAt,
    } satisfies CountyPowerParityProfileRecord;
  });

  return [datasetProfile, ...columnProfiles];
}

function buildAssertion(args: {
  readonly actualValueText: string | null;
  readonly assertionName: string;
  readonly blocking: boolean;
  readonly columnName?: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly expectedValueText: string | null;
  readonly passed: boolean;
  readonly publicationRunId: string;
  readonly role: CountyPowerParityTargetRole;
  readonly runId: string;
  readonly targetName: CountyPowerGoldMartSpec["name"];
  readonly validatedAt: string;
}): CountyPowerParityAssertionRecord {
  return {
    actual_value_text: args.actualValueText,
    assertion_name: args.assertionName,
    blocking: args.blocking,
    column_name: args.columnName ?? null,
    details_json: JSON.stringify(args.details),
    expected_value_text: args.expectedValueText,
    passed: args.passed,
    publication_run_id: args.publicationRunId,
    run_id: args.runId,
    severity: args.blocking ? "error" : "warn",
    target_name: args.targetName,
    target_role: args.role,
    validated_at: args.validatedAt,
  };
}

function buildTargetComparison(args: {
  readonly parquetSnapshot: CountyPowerParitySourceSnapshot;
  readonly postgresSnapshot: CountyPowerParitySourceSnapshot;
  readonly publicationRunId: string;
  readonly role: CountyPowerParityTargetRole;
  readonly runId: string;
  readonly targetName: CountyPowerGoldMartSpec["name"];
  readonly validatedAt: string;
}): CountyPowerParityTargetComparison {
  const assertions: CountyPowerParityAssertionRecord[] = [
    buildAssertion({
      actualValueText: String(args.parquetSnapshot.rowCount),
      assertionName: "row_count",
      blocking: true,
      details: {
        parquet: args.parquetSnapshot.rowCount,
        postgres: args.postgresSnapshot.rowCount,
      },
      expectedValueText: String(args.postgresSnapshot.rowCount),
      passed: args.parquetSnapshot.rowCount === args.postgresSnapshot.rowCount,
      publicationRunId: args.publicationRunId,
      role: args.role,
      runId: args.runId,
      targetName: args.targetName,
      validatedAt: args.validatedAt,
    }),
    buildAssertion({
      actualValueText: args.parquetSnapshot.schemaHash,
      assertionName: "canonical_schema_hash",
      blocking: true,
      details: {
        parquet: args.parquetSnapshot.schemaHash,
        postgres: args.postgresSnapshot.schemaHash,
      },
      expectedValueText: args.postgresSnapshot.schemaHash,
      passed: args.parquetSnapshot.schemaHash === args.postgresSnapshot.schemaHash,
      publicationRunId: args.publicationRunId,
      role: args.role,
      runId: args.runId,
      targetName: args.targetName,
      validatedAt: args.validatedAt,
    }),
    buildAssertion({
      actualValueText: args.parquetSnapshot.parityChecksum,
      assertionName: "parity_checksum",
      blocking: true,
      details: {
        parquet: args.parquetSnapshot.parityChecksum,
        postgres: args.postgresSnapshot.parityChecksum,
      },
      expectedValueText: args.postgresSnapshot.parityChecksum,
      passed: args.parquetSnapshot.parityChecksum === args.postgresSnapshot.parityChecksum,
      publicationRunId: args.publicationRunId,
      role: args.role,
      runId: args.runId,
      targetName: args.targetName,
      validatedAt: args.validatedAt,
    }),
  ];

  for (const column of args.parquetSnapshot.columns) {
    const parquetMetrics = computeColumnMetrics({
      column,
      rows: args.parquetSnapshot.rows,
    });
    const postgresMetrics = computeColumnMetrics({
      column,
      rows: args.postgresSnapshot.rows,
    });

    assertions.push(
      buildAssertion({
        actualValueText: String(parquetMetrics.nullCount),
        assertionName: "null_count",
        blocking: true,
        columnName: column.name,
        details: {
          parquet: parquetMetrics.nullCount,
          postgres: postgresMetrics.nullCount,
        },
        expectedValueText: String(postgresMetrics.nullCount),
        passed: parquetMetrics.nullCount === postgresMetrics.nullCount,
        publicationRunId: args.publicationRunId,
        role: args.role,
        runId: args.runId,
        targetName: args.targetName,
        validatedAt: args.validatedAt,
      })
    );

    if (!shouldProfileMinMax(column.canonicalType)) {
      continue;
    }

    assertions.push(
      buildAssertion({
        actualValueText: parquetMetrics.minValueText,
        assertionName: "min_value",
        blocking: true,
        columnName: column.name,
        details: {
          parquet: parquetMetrics.minValueText,
          postgres: postgresMetrics.minValueText,
        },
        expectedValueText: postgresMetrics.minValueText,
        passed: parquetMetrics.minValueText === postgresMetrics.minValueText,
        publicationRunId: args.publicationRunId,
        role: args.role,
        runId: args.runId,
        targetName: args.targetName,
        validatedAt: args.validatedAt,
      }),
      buildAssertion({
        actualValueText: parquetMetrics.maxValueText,
        assertionName: "max_value",
        blocking: true,
        columnName: column.name,
        details: {
          parquet: parquetMetrics.maxValueText,
          postgres: postgresMetrics.maxValueText,
        },
        expectedValueText: postgresMetrics.maxValueText,
        passed: parquetMetrics.maxValueText === postgresMetrics.maxValueText,
        publicationRunId: args.publicationRunId,
        role: args.role,
        runId: args.runId,
        targetName: args.targetName,
        validatedAt: args.validatedAt,
      })
    );
  }

  const profiles = [
    ...buildProfiles({
      observedTypes: args.postgresSnapshot.observedTypes,
      publicationRunId: args.publicationRunId,
      role: args.role,
      runId: args.runId,
      sourceName: "postgres",
      sourceSnapshot: args.postgresSnapshot,
      targetName: args.targetName,
      validatedAt: args.validatedAt,
    }),
    ...buildProfiles({
      observedTypes: args.parquetSnapshot.observedTypes,
      publicationRunId: args.publicationRunId,
      role: args.role,
      runId: args.runId,
      sourceName: "parquet",
      sourceSnapshot: args.parquetSnapshot,
      targetName: args.targetName,
      validatedAt: args.validatedAt,
    }),
  ];

  return {
    assertions,
    profiles,
  };
}

function buildQaArtifacts(): readonly LakeManifestArtifactRecord[] {
  return [
    {
      format: "parquet",
      layer: "parity_assertions",
      partitionKeys: [],
      phase: "qa-plain",
      relativePath: "qa/assertions.parquet",
    },
    {
      format: "parquet",
      layer: "parity_profile",
      partitionKeys: [],
      phase: "qa-plain",
      relativePath: "qa/profile.parquet",
    },
  ];
}

function encodeNdjsonRows(rows: readonly unknown[]): string {
  const content = rows.map((row) => JSON.stringify(row)).join("\n");
  return content.length > 0 ? `${content}\n` : "";
}

function ensureDuckDbControlSurface(args: CountyPowerParityValidationArgs["context"]): void {
  ensureDirectory(args.runDuckDbDir);
  if (!fileExists(args.runDuckDbBootstrapPath)) {
    writeDuckDbBootstrapSql(args.runDuckDbBootstrapPath);
  }
  ensureDirectory(args.qaDir);
}

function runPsqlCopyCommand(args: {
  readonly csvPath: string;
  readonly cwd: string;
  readonly databaseUrl: string;
  readonly env: NodeJS.ProcessEnv;
  readonly query: string;
}): Promise<RunBufferedCommandResult> {
  return runBufferedCommand({
    args: [
      args.databaseUrl,
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `\\copy (${collapseSqlWhitespace(args.query)}) TO ${toSqlStringLiteral(args.csvPath)} WITH (FORMAT csv, HEADER true)`,
    ],
    command: "psql",
    cwd: args.cwd,
    env: copyProcessEnvironment(args.env),
  });
}

async function exportCountyPowerParityCsv(args: {
  readonly context: CountyPowerParityValidationArgs["context"];
  readonly csvPath: string;
  readonly databaseUrl: string;
  readonly env: NodeJS.ProcessEnv;
  readonly query: string;
}): Promise<void> {
  const result = await runPsqlCopyCommand({
    csvPath: args.csvPath,
    cwd: args.context.runDir,
    databaseUrl: args.databaseUrl,
    env: args.env,
    query: args.query,
  });
  if (result.exitCode !== 0) {
    throw new Error(`county power parity export failed: ${summarizeCommandFailure(result)}`);
  }

  const copiedRowCount = readCopiedRowCount(result);
  if (copiedRowCount === null) {
    throw new Error(`county power parity export did not report a row count for ${args.csvPath}`);
  }
  if (!fileExists(args.csvPath)) {
    throw new Error(`county power parity export missing CSV: ${args.csvPath}`);
  }
}

async function readDuckDbRows(args: {
  readonly bootstrapPath: string;
  readonly cwd: string;
  readonly databasePath: string;
  readonly env: NodeJS.ProcessEnv;
  readonly runner: CountyPowerParityDuckDbRunner;
  readonly sql: string;
}): Promise<readonly Readonly<Record<string, unknown>>[]> {
  const result = await args.runner({
    bootstrapPath: args.bootstrapPath,
    cwd: args.cwd,
    databasePath: args.databasePath,
    env: args.env,
    outputMode: "json",
    readOnly: true,
    stdoutCaptureMaxBytes: PARITY_DUCKDB_JSON_CAPTURE_MAX_BYTES,
    sql: args.sql,
  });
  if (result.exitCode !== 0) {
    throw new Error(`county power parity read failed: ${summarizeCommandFailure(result)}`);
  }

  return decodeDuckDbJsonRows(result.stdout);
}

async function writeQaArtifacts(args: {
  readonly assertions: readonly CountyPowerParityAssertionRecord[];
  readonly context: CountyPowerParityValidationArgs["context"];
  readonly env: NodeJS.ProcessEnv;
  readonly profiles: readonly CountyPowerParityProfileRecord[];
  readonly runner: CountyPowerParityDuckDbRunner;
}): Promise<void> {
  const tempDir = mkdtempSync(join(args.context.runDir, ".county-power-parity-"));

  try {
    const assertionsJsonPath = join(tempDir, "assertions.ndjson");
    const profileJsonPath = join(tempDir, "profile.ndjson");
    writeTextAtomic(assertionsJsonPath, encodeNdjsonRows(args.assertions));
    writeTextAtomic(profileJsonPath, encodeNdjsonRows(args.profiles));

    const result = await args.runner({
      bootstrapPath: args.context.runDuckDbBootstrapPath,
      cwd: args.context.runDir,
      databasePath: args.context.runDuckDbPath,
      env: args.env,
      sql: `COPY (
  SELECT *
  FROM read_ndjson_auto(${toSqlStringLiteral(assertionsJsonPath)})
) TO ${toSqlStringLiteral(args.context.qaAssertionsPath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD
);

COPY (
  SELECT *
  FROM read_ndjson_auto(${toSqlStringLiteral(profileJsonPath)})
) TO ${toSqlStringLiteral(args.context.qaProfilePath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD
);`,
    });

    if (result.exitCode !== 0) {
      throw new Error(`county power parity QA write failed: ${summarizeCommandFailure(result)}`);
    }
    if (!(fileExists(args.context.qaAssertionsPath) && fileExists(args.context.qaProfilePath))) {
      throw new Error("county power parity QA artifacts are missing");
    }
  } finally {
    rmSync(tempDir, {
      force: true,
      recursive: true,
    });
  }
}

function buildSourceSnapshot(args: {
  readonly columns: readonly CountyPowerParityColumnSpec[];
  readonly keyColumns: readonly string[];
  readonly observedTypes: Readonly<Record<string, string | null>>;
  readonly rows: readonly Readonly<Record<string, unknown>>[];
}): CountyPowerParitySourceSnapshot {
  return {
    columns: args.columns,
    observedTypes: args.observedTypes,
    parityChecksum: buildParityChecksum({
      columns: args.columns,
      keyColumns: args.keyColumns,
      rows: args.rows,
    }),
    rowCount: args.rows.length,
    rows: args.rows,
    schemaHash: buildSchemaHash(args.columns),
  };
}

export async function validateCountyPowerPublicationParity(
  args: CountyPowerParityValidationArgs & {
    readonly exporter?: CountyPowerParityCsvExporter;
    readonly runner?: CountyPowerParityDuckDbRunner;
  }
): Promise<CountyPowerParityResult> {
  const env = args.env ?? process.env;
  const databaseUrl = resolveDatabaseUrl(env);
  const exporter = args.exporter ?? exportCountyPowerParityCsv;
  const runner = args.runner ?? runDuckDbCli;
  const validatedAt = new Date().toISOString();
  const goldSpecs = buildCountyPowerGoldMartSpecs({
    context: args.context,
    publicationRunId: args.publicationRunId,
  });
  const targetSpecs = resolveCountyPowerParityTargetSpecs();
  const tempDir = mkdtempSync(join(args.context.runDir, ".county-power-parity-sources-"));
  const assertions: CountyPowerParityAssertionRecord[] = [];
  const profiles: CountyPowerParityProfileRecord[] = [];
  const qaArtifacts = buildQaArtifacts();

  if (args.manifest.effectiveDate === null || args.manifest.month === null) {
    throw new Error("County power parity validation requires effectiveDate and month");
  }

  ensureDuckDbControlSurface(args.context);

  try {
    for (const targetSpec of targetSpecs) {
      const goldSpec = goldSpecs.find((candidate) => candidate.name === targetSpec.name);
      if (goldSpec === undefined) {
        throw new Error(`Missing county power gold spec for ${targetSpec.name}`);
      }
      if (!fileExists(goldSpec.outputFilePath)) {
        throw new Error(`Missing county power gold artifact: ${goldSpec.outputFilePath}`);
      }

      const comparatorCsvPath = join(tempDir, `${targetSpec.name}.csv`);
      await exporter({
        context: args.context,
        csvPath: comparatorCsvPath,
        databaseUrl,
        env,
        query: targetSpec.postgresQuery({
          effectiveDate: args.manifest.effectiveDate,
          month: args.manifest.month,
          publicationRunId: args.publicationRunId,
        }),
      });

      const [parquetRows, postgresRows, parquetSchemaRows, postgresSchemaRows] = await Promise.all([
        readDuckDbRows({
          bootstrapPath: args.context.runDuckDbBootstrapPath,
          cwd: args.context.runDir,
          databasePath: args.context.runDuckDbPath,
          env,
          runner,
          sql: buildDuckDbReadRowsSql({
            inputPath: goldSpec.outputFilePath,
            inputType: "parquet",
            keyColumns: targetSpec.keyColumns,
          }),
        }),
        readDuckDbRows({
          bootstrapPath: args.context.runDuckDbBootstrapPath,
          cwd: args.context.runDir,
          databasePath: args.context.runDuckDbPath,
          env,
          runner,
          sql: buildDuckDbReadRowsSql({
            inputPath: comparatorCsvPath,
            inputType: "csv",
            keyColumns: targetSpec.keyColumns,
          }),
        }),
        readDuckDbRows({
          bootstrapPath: args.context.runDuckDbBootstrapPath,
          cwd: args.context.runDir,
          databasePath: args.context.runDuckDbPath,
          env,
          runner,
          sql: buildDuckDbDescribeSql({
            inputPath: goldSpec.outputFilePath,
            inputType: "parquet",
          }),
        }),
        readDuckDbRows({
          bootstrapPath: args.context.runDuckDbBootstrapPath,
          cwd: args.context.runDir,
          databasePath: args.context.runDuckDbPath,
          env,
          runner,
          sql: buildDuckDbDescribeSql({
            inputPath: comparatorCsvPath,
            inputType: "csv",
          }),
        }),
      ]);

      const parquetSchema = decodeDuckDbDescribeRows(parquetSchemaRows);
      const postgresSchema = decodeDuckDbDescribeRows(postgresSchemaRows);
      const resolvedColumns = resolveColumnSpecs({
        overrides: targetSpec.columnTypeOverrides,
        parquetSchema,
        postgresSchema,
      });

      const comparison = buildTargetComparison({
        parquetSnapshot: buildSourceSnapshot({
          columns: resolvedColumns.columns,
          keyColumns: targetSpec.keyColumns,
          observedTypes: resolvedColumns.parquetObservedTypes,
          rows: parquetRows,
        }),
        postgresSnapshot: buildSourceSnapshot({
          columns: resolvedColumns.columns,
          keyColumns: targetSpec.keyColumns,
          observedTypes: resolvedColumns.postgresObservedTypes,
          rows: postgresRows,
        }),
        publicationRunId: args.publicationRunId,
        role: targetSpec.role,
        runId: args.context.runId,
        targetName: targetSpec.name,
        validatedAt,
      });

      assertions.push(...comparison.assertions);
      profiles.push(...comparison.profiles);

      if (
        (args.failFast ?? false) &&
        comparison.assertions.some((assertion) => assertion.blocking && !assertion.passed)
      ) {
        break;
      }
    }

    if (args.emitQa ?? true) {
      await writeQaArtifacts({
        assertions,
        context: args.context,
        env,
        profiles,
        runner,
      });
      mergeLakeManifestArtifacts({
        artifacts: qaArtifacts,
        dataVersion: args.manifest.dataVersion,
        effectiveDate: args.manifest.effectiveDate,
        layout: args.context,
        month: args.manifest.month,
      });
    }

    const failedAssertions = assertions.filter(
      (assertion) => assertion.blocking && !assertion.passed
    ).length;

    return {
      failedAssertions,
      passed: failedAssertions === 0,
      qaArtifacts: args.emitQa === false ? [] : qaArtifacts,
      qaAssertionsPath: args.context.qaAssertionsPath,
      qaProfilePath: args.context.qaProfilePath,
      validatedAt,
    };
  } finally {
    rmSync(tempDir, {
      force: true,
      recursive: true,
    });
  }
}
