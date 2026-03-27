import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  BunSqlClient,
  SourceDefinitionSeedRow,
  SourceDependencyRuleSeedRow,
  SourceRegistryAccessStatus,
  SourceRegistryApprovalStatus,
  SourceRegistryConfidenceCap,
  SourceRegistryCsvRow,
  SourceRegistryDefaultRole,
  SourceRegistryDownstreamObjectType,
  SourceRegistryIngestionHealth,
  SourceRegistryLaunchCriticality,
  SourceRegistryPublishOptions,
  SourceRegistryPublishPaths,
  SourceRegistryPublishSummary,
  SourceRegistryRequiredness,
  SourceRegistryRuntimeAlertState,
  SourceRegistryRuntimeSeedRow,
  SourceRegistrySeedBundle,
  SourceRegistryStalenessState,
  SourceRegistryStatus,
  SourceRegistrySurfaceScope,
  SourceRegistryTruthModeCap,
  SourceVersionSeedRow,
} from "./source-registry.types";

declare const Bun: {
  sql: BunSqlClient;
};

const APPS_API_ENV_PATH = join("apps", "api", ".env");
const SOURCE_DEFINITIONS_CSV_PATH = join("source-registry", "source-definitions-v1.csv");
const SOURCE_VERSIONS_CSV_PATH = join("source-registry", "source-versions-v1.csv");
const SOURCE_DEPENDENCY_RULES_CSV_PATH = join("source-registry", "source-dependency-rules-v1.csv");

const SOURCE_DEFINITION_HEADERS = [
  "source_id",
  "registry_version",
  "source_name",
  "provider_name",
  "source_family",
  "source_type",
  "integration_state",
  "owner_team",
  "status",
  "surface_scopes",
  "default_role",
  "precision_tier",
  "launch_criticality",
  "coverage_geography",
  "coverage_grain",
  "geometry_type",
  "provider_update_cadence",
  "production_method",
  "evidence_type",
  "description",
  "known_gaps",
  "code_entrypoint",
  "effective_from",
  "effective_to",
];

const SOURCE_VERSION_HEADERS = [
  "source_version_id",
  "registry_version",
  "source_id",
  "provider_version_label",
  "source_as_of_date",
  "source_release_date",
  "schema_version",
  "geographic_extent_version",
  "change_type",
  "approval_status",
  "change_notes",
  "checksum_or_fingerprint",
  "effective_from",
  "effective_to",
];

const SOURCE_DEPENDENCY_RULE_HEADERS = [
  "dependency_rule_id",
  "registry_version",
  "source_id",
  "downstream_object_type",
  "downstream_object_id",
  "role_in_downstream",
  "requiredness",
  "warn_if_days_stale",
  "degrade_if_days_stale",
  "suppress_if_days_stale",
  "suppress_if_missing",
  "precision_tier_c_allowed_for_primary",
  "allowed_roles",
  "truth_mode_cap",
  "confidence_cap",
  "surface_scopes",
  "geography_scope",
  "effective_from",
  "effective_to",
];

const LOGICAL_REGISTRY_VERSION_RE = /^registry-v\d+$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

let sourceRegistrySqlClient: BunSqlClient | null = null;

function getSourceRegistrySqlClient(): BunSqlClient {
  resolveDatabaseUrl(process.env);
  if (sourceRegistrySqlClient !== null) {
    return sourceRegistrySqlClient;
  }

  sourceRegistrySqlClient = Bun.sql;
  return sourceRegistrySqlClient;
}

export async function closeSourceRegistrySqlClient(): Promise<void> {
  if (sourceRegistrySqlClient === null) {
    return;
  }

  const sqlClient = sourceRegistrySqlClient;
  sourceRegistrySqlClient = null;
  await sqlClient.close();
}

function resolveDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const connectionString = env.DATABASE_URL ?? env.POSTGRES_URL;
  if (typeof connectionString === "string" && connectionString.trim().length > 0) {
    return connectionString.trim();
  }

  throw new Error("Missing DATABASE_URL or POSTGRES_URL");
}

function normalizeLineEndings(value: string): string {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

interface CsvParserState {
  currentField: string;
  row: string[];
  rows: string[][];
  withinQuotes: boolean;
}

function pushCsvField(state: CsvParserState): void {
  state.row.push(state.currentField);
  state.currentField = "";
}

function pushCsvRow(state: CsvParserState): void {
  if (!(state.row.length === 1 && state.row[0] === "")) {
    state.rows.push(state.row);
  }

  state.row = [];
}

function handleQuotedCsvCharacter(
  normalized: string,
  index: number,
  state: CsvParserState
): number {
  const character = normalized[index];
  if (character === undefined) {
    return index;
  }

  if (character !== '"') {
    state.currentField += character;
    return index;
  }

  const nextCharacter = normalized[index + 1];
  if (nextCharacter === '"') {
    state.currentField += '"';
    return index + 1;
  }

  state.withinQuotes = false;
  return index;
}

function handleUnquotedCsvCharacter(character: string, state: CsvParserState): boolean {
  if (character === '"') {
    state.withinQuotes = true;
    return true;
  }

  if (character === ",") {
    pushCsvField(state);
    return true;
  }

  if (character === "\n") {
    pushCsvField(state);
    pushCsvRow(state);
    return true;
  }

  return false;
}

function parseCsvContent(content: string): readonly (readonly string[])[] {
  const normalized = normalizeLineEndings(content);
  const state: CsvParserState = {
    currentField: "",
    row: [],
    rows: [],
    withinQuotes: false,
  };

  for (let index = 0; index < normalized.length; index++) {
    const character = normalized[index];
    if (character === undefined) {
      break;
    }

    if (state.withinQuotes) {
      index = handleQuotedCsvCharacter(normalized, index, state);
      continue;
    }

    if (handleUnquotedCsvCharacter(character, state)) {
      continue;
    }

    state.currentField += character;
  }

  if (state.withinQuotes) {
    throw new Error("CSV parse error: unterminated quoted field");
  }

  if (state.currentField.length > 0 || state.row.length > 0) {
    pushCsvField(state);
    pushCsvRow(state);
  }

  return state.rows;
}

function validateHeaders(
  actualHeaders: readonly string[],
  expectedHeaders: readonly string[],
  filePath: string
): void {
  const actual = actualHeaders.join(",");
  const expected = expectedHeaders.join(",");

  if (actual !== expected) {
    throw new Error(`Unexpected CSV headers in ${filePath}`);
  }
}

function convertRowsToRecords(
  rows: readonly (readonly string[])[],
  expectedHeaders: readonly string[],
  filePath: string
): readonly SourceRegistryCsvRow[] {
  if (rows.length === 0) {
    throw new Error(`CSV file is empty: ${filePath}`);
  }

  const headerRow = rows[0];
  if (headerRow === undefined) {
    throw new Error(`CSV file is empty: ${filePath}`);
  }

  const dataRows = rows.slice(1);
  validateHeaders(headerRow, expectedHeaders, filePath);

  return dataRows.map((row, rowIndex) => {
    if (row.length !== expectedHeaders.length) {
      throw new Error(`Unexpected column count in ${filePath} on data row ${String(rowIndex + 2)}`);
    }

    const record: Record<string, string> = {};
    for (let index = 0; index < expectedHeaders.length; index++) {
      const header = expectedHeaders[index];
      const value = row[index];
      if (header === undefined || value === undefined) {
        throw new Error(`Malformed CSV row in ${filePath} on data row ${String(rowIndex + 2)}`);
      }
      record[header] = value;
    }

    return record;
  });
}

function readRequiredField(record: SourceRegistryCsvRow, key: string, filePath: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`Missing ${key} in ${filePath}`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`Blank ${key} in ${filePath}`);
  }

  return trimmed;
}

function readOptionalField(record: SourceRegistryCsvRow, key: string): string | null {
  const value = record[key];
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseLogicalRegistryVersion(value: string, filePath: string): string {
  if (!LOGICAL_REGISTRY_VERSION_RE.test(value)) {
    throw new Error(`Unexpected logical registry version in ${filePath}: ${value}`);
  }

  return value;
}

function parseSourceStatus(value: string, filePath: string): SourceRegistryStatus {
  switch (value) {
    case "active":
    case "planned":
    case "deprecated":
    case "blocked":
      return value;
    default:
      throw new Error(`Invalid source status in ${filePath}: ${value}`);
  }
}

function parseDefaultRole(value: string, filePath: string): SourceRegistryDefaultRole {
  switch (value) {
    case "primary":
    case "contextual":
    case "validation":
    case "fallback":
      return value;
    default:
      throw new Error(`Invalid source role in ${filePath}: ${value}`);
  }
}

function parsePrecisionTier(value: string, filePath: string): "A" | "B" | "C" {
  switch (value) {
    case "A":
    case "B":
    case "C":
      return value;
    default:
      throw new Error(`Invalid precision tier in ${filePath}: ${value}`);
  }
}

function parseLaunchCriticality(value: string, filePath: string): SourceRegistryLaunchCriticality {
  switch (value) {
    case "blocking":
    case "gated":
    case "supporting":
    case "deferred":
      return value;
    default:
      throw new Error(`Invalid launch criticality in ${filePath}: ${value}`);
  }
}

function parseApprovalStatus(value: string, filePath: string): SourceRegistryApprovalStatus {
  switch (value) {
    case "approved":
    case "planned":
    case "deprecated":
    case "blocked":
      return value;
    default:
      throw new Error(`Invalid approval status in ${filePath}: ${value}`);
  }
}

function parseDownstreamObjectType(
  value: string,
  filePath: string
): SourceRegistryDownstreamObjectType {
  switch (value) {
    case "metric":
    case "feature":
    case "score":
    case "surface":
    case "packet_section":
    case "model_input":
      return value;
    default:
      throw new Error(`Invalid downstream object type in ${filePath}: ${value}`);
  }
}

function parseRequiredness(value: string, filePath: string): SourceRegistryRequiredness {
  switch (value) {
    case "required":
    case "optional":
    case "enhancing":
      return value;
    default:
      throw new Error(`Invalid requiredness in ${filePath}: ${value}`);
  }
}

function parseTruthModeCap(value: string, filePath: string): SourceRegistryTruthModeCap {
  switch (value) {
    case "full":
    case "validated_screening":
    case "derived_screening":
    case "context_only":
    case "internal_only":
      return value;
    default:
      throw new Error(`Invalid truth mode cap in ${filePath}: ${value}`);
  }
}

function parseConfidenceCap(
  value: string | null,
  filePath: string
): SourceRegistryConfidenceCap | null {
  if (value === null) {
    return null;
  }

  switch (value) {
    case "high":
    case "medium":
    case "low":
      return value;
    default:
      throw new Error(`Invalid confidence cap in ${filePath}: ${value}`);
  }
}

function parseSurfaceScope(value: string, filePath: string): SourceRegistrySurfaceScope {
  switch (value) {
    case "county":
    case "corridor":
    case "parcel":
      return value;
    default:
      throw new Error(`Invalid surface scope in ${filePath}: ${value}`);
  }
}

function parsePipeDelimitedValues(
  value: string,
  filePath: string,
  fieldName: string
): readonly string[] {
  const normalizedValues = value
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (normalizedValues.length === 0) {
    throw new Error(`Expected at least one value for ${fieldName} in ${filePath}`);
  }

  return normalizedValues;
}

function parseSurfaceScopes(
  value: string,
  filePath: string,
  fieldName: string
): readonly SourceRegistrySurfaceScope[] {
  return parsePipeDelimitedValues(value, filePath, fieldName).map((entry) =>
    parseSurfaceScope(entry, filePath)
  );
}

function parseAllowedRoles(
  value: string,
  filePath: string,
  fieldName: string
): readonly SourceRegistryDefaultRole[] {
  return parsePipeDelimitedValues(value, filePath, fieldName).map((entry) =>
    parseDefaultRole(entry, filePath)
  );
}

function parseOptionalPositiveInteger(value: string | null, filePath: string, fieldName: string) {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${fieldName} in ${filePath}: ${value}`);
  }

  return parsed;
}

function parseBooleanField(value: string, filePath: string, fieldName: string): boolean {
  switch (value.trim().toLowerCase()) {
    case "true":
      return true;
    case "false":
      return false;
    default:
      throw new Error(`Invalid ${fieldName} in ${filePath}: ${value}`);
  }
}

function decodeSourceDefinitionRow(
  record: SourceRegistryCsvRow,
  filePath: string
): SourceDefinitionSeedRow {
  return {
    logicalRegistryVersion: parseLogicalRegistryVersion(
      readRequiredField(record, "registry_version", filePath),
      filePath
    ),
    sourceId: readRequiredField(record, "source_id", filePath),
    sourceName: readRequiredField(record, "source_name", filePath),
    providerName: readRequiredField(record, "provider_name", filePath),
    sourceFamily: readRequiredField(record, "source_family", filePath),
    sourceType: readRequiredField(record, "source_type", filePath),
    integrationState: readRequiredField(record, "integration_state", filePath),
    ownerTeam: readRequiredField(record, "owner_team", filePath),
    status: parseSourceStatus(readRequiredField(record, "status", filePath), filePath),
    surfaceScopes: parseSurfaceScopes(
      readRequiredField(record, "surface_scopes", filePath),
      filePath,
      "surface_scopes"
    ),
    defaultRole: parseDefaultRole(readRequiredField(record, "default_role", filePath), filePath),
    precisionTier: parsePrecisionTier(
      readRequiredField(record, "precision_tier", filePath),
      filePath
    ),
    launchCriticality: parseLaunchCriticality(
      readRequiredField(record, "launch_criticality", filePath),
      filePath
    ),
    coverageGeography: readRequiredField(record, "coverage_geography", filePath),
    coverageGrain: readRequiredField(record, "coverage_grain", filePath),
    geometryType: readRequiredField(record, "geometry_type", filePath),
    providerUpdateCadence: readRequiredField(record, "provider_update_cadence", filePath),
    productionMethod: readRequiredField(record, "production_method", filePath),
    evidenceType: readRequiredField(record, "evidence_type", filePath),
    description: readRequiredField(record, "description", filePath),
    knownGaps: readRequiredField(record, "known_gaps", filePath),
    codeEntrypoint: readRequiredField(record, "code_entrypoint", filePath),
    effectiveFrom: readRequiredField(record, "effective_from", filePath),
    effectiveTo: readOptionalField(record, "effective_to"),
  };
}

function decodeSourceVersionRow(
  record: SourceRegistryCsvRow,
  filePath: string
): SourceVersionSeedRow {
  return {
    logicalRegistryVersion: parseLogicalRegistryVersion(
      readRequiredField(record, "registry_version", filePath),
      filePath
    ),
    sourceVersionId: readRequiredField(record, "source_version_id", filePath),
    sourceId: readRequiredField(record, "source_id", filePath),
    providerVersionLabel: readRequiredField(record, "provider_version_label", filePath),
    sourceAsOfDate: readOptionalField(record, "source_as_of_date"),
    sourceReleaseDate: readOptionalField(record, "source_release_date"),
    schemaVersion: readRequiredField(record, "schema_version", filePath),
    geographicExtentVersion: readRequiredField(record, "geographic_extent_version", filePath),
    changeType: readRequiredField(record, "change_type", filePath),
    approvalStatus: parseApprovalStatus(
      readRequiredField(record, "approval_status", filePath),
      filePath
    ),
    changeNotes: readRequiredField(record, "change_notes", filePath),
    checksumOrFingerprint: readOptionalField(record, "checksum_or_fingerprint"),
    effectiveFrom: readRequiredField(record, "effective_from", filePath),
    effectiveTo: readOptionalField(record, "effective_to"),
  };
}

function decodeSourceDependencyRuleRow(
  record: SourceRegistryCsvRow,
  filePath: string
): SourceDependencyRuleSeedRow {
  const warnIfDaysStale = parseOptionalPositiveInteger(
    readOptionalField(record, "warn_if_days_stale"),
    filePath,
    "warn_if_days_stale"
  );
  const degradeIfDaysStale = parseOptionalPositiveInteger(
    readOptionalField(record, "degrade_if_days_stale"),
    filePath,
    "degrade_if_days_stale"
  );
  const suppressIfDaysStale = parseOptionalPositiveInteger(
    readOptionalField(record, "suppress_if_days_stale"),
    filePath,
    "suppress_if_days_stale"
  );

  if (
    warnIfDaysStale !== null &&
    degradeIfDaysStale !== null &&
    warnIfDaysStale > degradeIfDaysStale
  ) {
    throw new Error(`warn_if_days_stale exceeds degrade_if_days_stale in ${filePath}`);
  }

  if (
    degradeIfDaysStale !== null &&
    suppressIfDaysStale !== null &&
    degradeIfDaysStale > suppressIfDaysStale
  ) {
    throw new Error(`degrade_if_days_stale exceeds suppress_if_days_stale in ${filePath}`);
  }

  return {
    logicalRegistryVersion: parseLogicalRegistryVersion(
      readRequiredField(record, "registry_version", filePath),
      filePath
    ),
    dependencyRuleId: readRequiredField(record, "dependency_rule_id", filePath),
    sourceId: readRequiredField(record, "source_id", filePath),
    downstreamObjectType: parseDownstreamObjectType(
      readRequiredField(record, "downstream_object_type", filePath),
      filePath
    ),
    downstreamObjectId: readRequiredField(record, "downstream_object_id", filePath),
    roleInDownstream: parseDefaultRole(
      readRequiredField(record, "role_in_downstream", filePath),
      filePath
    ),
    requiredness: parseRequiredness(readRequiredField(record, "requiredness", filePath), filePath),
    warnIfDaysStale,
    degradeIfDaysStale,
    suppressIfDaysStale,
    suppressIfMissing: parseBooleanField(
      readRequiredField(record, "suppress_if_missing", filePath),
      filePath,
      "suppress_if_missing"
    ),
    precisionTierCAllowedForPrimary: parseBooleanField(
      readRequiredField(record, "precision_tier_c_allowed_for_primary", filePath),
      filePath,
      "precision_tier_c_allowed_for_primary"
    ),
    allowedRoles: parseAllowedRoles(
      readRequiredField(record, "allowed_roles", filePath),
      filePath,
      "allowed_roles"
    ),
    truthModeCap: parseTruthModeCap(
      readRequiredField(record, "truth_mode_cap", filePath),
      filePath
    ),
    confidenceCap: parseConfidenceCap(readOptionalField(record, "confidence_cap"), filePath),
    surfaceScopes: parseSurfaceScopes(
      readRequiredField(record, "surface_scopes", filePath),
      filePath,
      "surface_scopes"
    ),
    geographyScope: readRequiredField(record, "geography_scope", filePath),
    effectiveFrom: readRequiredField(record, "effective_from", filePath),
    effectiveTo: readOptionalField(record, "effective_to"),
  };
}

function readCsvFile(path: string): Promise<string> {
  return readFile(path, "utf8");
}

async function readSourceDefinitionSeeds(
  path: string
): Promise<readonly SourceDefinitionSeedRow[]> {
  const content = await readCsvFile(path);
  const rows = parseCsvContent(content);
  const records = convertRowsToRecords(rows, SOURCE_DEFINITION_HEADERS, path);
  return records.map((record) => decodeSourceDefinitionRow(record, path));
}

async function readSourceVersionSeeds(path: string): Promise<readonly SourceVersionSeedRow[]> {
  const content = await readCsvFile(path);
  const rows = parseCsvContent(content);
  const records = convertRowsToRecords(rows, SOURCE_VERSION_HEADERS, path);
  return records.map((record) => decodeSourceVersionRow(record, path));
}

async function readSourceDependencyRuleSeeds(
  path: string
): Promise<readonly SourceDependencyRuleSeedRow[]> {
  const content = await readCsvFile(path);
  const rows = parseCsvContent(content);
  const records = convertRowsToRecords(rows, SOURCE_DEPENDENCY_RULE_HEADERS, path);
  return records.map((record) => decodeSourceDependencyRuleRow(record, path));
}

function ensureUniqueKey(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}

function resolveLogicalRegistryVersion(values: readonly string[]): string {
  if (values.length === 0) {
    throw new Error("Source Registry seeds are empty");
  }

  const [firstValue, ...restValues] = values;
  if (firstValue === undefined) {
    throw new Error("Source Registry seeds are empty");
  }

  for (const value of restValues) {
    if (value !== firstValue) {
      throw new Error("Source Registry seed files do not agree on logical registry version");
    }
  }

  return firstValue;
}

function validateSourceRegistrySeedBundle(bundle: SourceRegistrySeedBundle): void {
  ensureUniqueKey(
    bundle.definitions.map((row) => row.sourceId),
    "source definition source_id"
  );
  ensureUniqueKey(
    bundle.versions.map((row) => `${row.sourceId}:${row.sourceVersionId}`),
    "source version"
  );
  ensureUniqueKey(
    bundle.dependencyRules.map((row) => row.dependencyRuleId),
    "source dependency rule"
  );

  const sourceIds = new Set(bundle.definitions.map((row) => row.sourceId));
  const versionsBySourceId = new Map<string, SourceVersionSeedRow[]>();

  for (const version of bundle.versions) {
    if (!sourceIds.has(version.sourceId)) {
      throw new Error(`Source version references unknown source definition: ${version.sourceId}`);
    }

    const versions = versionsBySourceId.get(version.sourceId);
    if (versions === undefined) {
      versionsBySourceId.set(version.sourceId, [version]);
      continue;
    }

    versions.push(version);
  }

  for (const dependencyRule of bundle.dependencyRules) {
    if (!sourceIds.has(dependencyRule.sourceId)) {
      throw new Error(
        `Source dependency rule references unknown source definition: ${dependencyRule.sourceId}`
      );
    }
  }

  for (const definition of bundle.definitions) {
    if (!versionsBySourceId.has(definition.sourceId)) {
      throw new Error(`Missing source version for source definition: ${definition.sourceId}`);
    }
  }
}

export function resolveSourceRegistryPublishPaths(projectRoot: string): SourceRegistryPublishPaths {
  return {
    definitionsCsvPath: join(projectRoot, SOURCE_DEFINITIONS_CSV_PATH),
    versionsCsvPath: join(projectRoot, SOURCE_VERSIONS_CSV_PATH),
    dependencyRulesCsvPath: join(projectRoot, SOURCE_DEPENDENCY_RULES_CSV_PATH),
  };
}

export async function readSourceRegistrySeedBundle(
  projectRoot: string
): Promise<SourceRegistrySeedBundle> {
  const paths = resolveSourceRegistryPublishPaths(projectRoot);
  const [definitions, versions, dependencyRules] = await Promise.all([
    readSourceDefinitionSeeds(paths.definitionsCsvPath),
    readSourceVersionSeeds(paths.versionsCsvPath),
    readSourceDependencyRuleSeeds(paths.dependencyRulesCsvPath),
  ]);

  const logicalRegistryVersion = resolveLogicalRegistryVersion([
    ...definitions.map((row) => row.logicalRegistryVersion),
    ...versions.map((row) => row.logicalRegistryVersion),
    ...dependencyRules.map((row) => row.logicalRegistryVersion),
  ]);

  const bundle: SourceRegistrySeedBundle = {
    definitions,
    versions,
    dependencyRules,
    logicalRegistryVersion,
  };

  validateSourceRegistrySeedBundle(bundle);
  return bundle;
}

function approvalStatusPriority(status: SourceRegistryApprovalStatus): number {
  switch (status) {
    case "approved":
      return 4;
    case "planned":
      return 3;
    case "deprecated":
      return 2;
    case "blocked":
      return 1;
    default:
      return 0;
  }
}

function compareSourceVersionPriority(
  left: SourceVersionSeedRow,
  right: SourceVersionSeedRow
): number {
  const approvalDifference =
    approvalStatusPriority(right.approvalStatus) - approvalStatusPriority(left.approvalStatus);
  if (approvalDifference !== 0) {
    return approvalDifference;
  }

  if (left.effectiveFrom !== right.effectiveFrom) {
    return left.effectiveFrom < right.effectiveFrom ? 1 : -1;
  }

  if (left.sourceVersionId === right.sourceVersionId) {
    return 0;
  }

  return left.sourceVersionId < right.sourceVersionId ? 1 : -1;
}

export function resolveSourceRegistryAccessStatus(
  integrationState: string
): SourceRegistryAccessStatus {
  if (integrationState.startsWith("live_") || integrationState.startsWith("downloaded_")) {
    return "accessible";
  }

  if (integrationState.startsWith("planned_") || integrationState === "approved_not_integrated") {
    return "planned";
  }

  return "planned";
}

function parseSeedTimestamp(value: string | null): Date | null {
  if (value === null) {
    return null;
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return null;
  }

  const timestamp =
    trimmedValue.includes("T") || trimmedValue.endsWith("Z")
      ? trimmedValue
      : `${trimmedValue}T00:00:00Z`;
  const parsedTimestamp = new Date(timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    throw new Error(`Invalid source registry timestamp: ${value}`);
  }

  return parsedTimestamp;
}

function selectSourceVersionFreshnessTimestamp(version: SourceVersionSeedRow): Date | null {
  const sourceAsOfTimestamp = parseSeedTimestamp(version.sourceAsOfDate);
  if (sourceAsOfTimestamp !== null) {
    return sourceAsOfTimestamp;
  }

  return parseSeedTimestamp(version.sourceReleaseDate);
}

interface SourceRegistryFreshnessThresholds {
  readonly agingDays: number;
  readonly freshDays: number;
  readonly staleDays: number;
}

function resolveSourceRegistryFreshnessThresholds(
  providerUpdateCadence: string
): SourceRegistryFreshnessThresholds | null {
  switch (providerUpdateCadence) {
    case "near_real_time":
      return { agingDays: 7, freshDays: 2, staleDays: 14 };
    case "continuous":
    case "ongoing":
      return { agingDays: 30, freshDays: 7, staleDays: 60 };
    case "contract_defined":
    case "monthly_or_quarterly":
      return { agingDays: 120, freshDays: 45, staleDays: 240 };
    case "irregular":
    case "periodic":
      return { agingDays: 365, freshDays: 90, staleDays: 730 };
    case "annual":
    case "monthly_and_annual":
      return { agingDays: 730, freshDays: 365, staleDays: 1095 };
    case "ad_hoc":
    case "as_received":
    case "review_cycle":
      return null;
    default:
      return null;
  }
}

function resolveSourceRegistryStalenessState(
  providerUpdateCadence: string,
  publishedAt: Date,
  freshnessTimestamp: Date | null,
  accessStatus: SourceRegistryAccessStatus,
  approvalStatus: SourceRegistryApprovalStatus
): SourceRegistryStalenessState {
  if (
    accessStatus !== "accessible" ||
    approvalStatus !== "approved" ||
    freshnessTimestamp === null
  ) {
    return "unknown";
  }

  const thresholds = resolveSourceRegistryFreshnessThresholds(providerUpdateCadence);
  if (thresholds === null) {
    return "unknown";
  }

  const ageInDays = Math.max(
    0,
    Math.floor((publishedAt.getTime() - freshnessTimestamp.getTime()) / MILLISECONDS_PER_DAY)
  );
  if (ageInDays <= thresholds.freshDays) {
    return "fresh";
  }
  if (ageInDays <= thresholds.agingDays) {
    return "aging";
  }
  if (ageInDays <= thresholds.staleDays) {
    return "stale";
  }

  return "critical";
}

function resolveSourceRegistryIngestionHealth(
  accessStatus: SourceRegistryAccessStatus,
  approvalStatus: SourceRegistryApprovalStatus,
  freshnessTimestamp: Date | null
): SourceRegistryIngestionHealth {
  if (accessStatus !== "accessible" || approvalStatus !== "approved") {
    return "not_run";
  }

  if (freshnessTimestamp === null) {
    return "degraded";
  }

  return "healthy";
}

function resolveSourceRegistryRuntimeAlertState(
  stalenessState: SourceRegistryStalenessState,
  ingestionHealth: SourceRegistryIngestionHealth
): SourceRegistryRuntimeAlertState {
  if (stalenessState === "critical") {
    return "blocking";
  }

  if (stalenessState === "stale" || ingestionHealth === "degraded") {
    return "warning";
  }

  return "none";
}

export function resolveInitialSourceRegistryRuntimeRows(
  bundle: SourceRegistrySeedBundle,
  registryVersion: string,
  publishedAt: Date
): readonly SourceRegistryRuntimeSeedRow[] {
  const versionsBySourceId = new Map<string, SourceVersionSeedRow[]>();
  for (const version of bundle.versions) {
    const versions = versionsBySourceId.get(version.sourceId);
    if (versions === undefined) {
      versionsBySourceId.set(version.sourceId, [version]);
      continue;
    }

    versions.push(version);
  }

  return bundle.definitions.map((definition) => {
    const versions = versionsBySourceId.get(definition.sourceId);
    if (versions === undefined || versions.length === 0) {
      throw new Error(`Missing source version for runtime status seeding: ${definition.sourceId}`);
    }

    const [currentVersion] = [...versions].sort(compareSourceVersionPriority);
    if (currentVersion === undefined) {
      throw new Error(`Missing source version for runtime status seeding: ${definition.sourceId}`);
    }

    const accessStatus = resolveSourceRegistryAccessStatus(definition.integrationState);
    const freshnessTimestamp = selectSourceVersionFreshnessTimestamp(currentVersion);
    const stalenessState = resolveSourceRegistryStalenessState(
      definition.providerUpdateCadence,
      publishedAt,
      freshnessTimestamp,
      accessStatus,
      currentVersion.approvalStatus
    );
    const ingestionHealth = resolveSourceRegistryIngestionHealth(
      accessStatus,
      currentVersion.approvalStatus,
      freshnessTimestamp
    );
    const runtimeAlertState = resolveSourceRegistryRuntimeAlertState(
      stalenessState,
      ingestionHealth
    );
    const freshnessTimestampIso = freshnessTimestamp?.toISOString() ?? null;

    return {
      sourceId: definition.sourceId,
      currentRegistryVersion: registryVersion,
      currentSourceVersionId: currentVersion.sourceVersionId,
      freshnessAsOf: freshnessTimestampIso,
      stalenessState,
      ingestionHealth,
      accessStatus,
      lastSuccessfulIngestAt:
        currentVersion.approvalStatus === "approved" ? publishedAt.toISOString() : null,
      latestProviderUpdateSeenAt: freshnessTimestampIso,
      runtimeAlertState,
    };
  });
}

function formatUtcPart(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

export function generateSourceRegistryVersion(publishedAt: Date): string {
  return [
    "registry-v1-",
    formatUtcPart(publishedAt.getUTCFullYear(), 4),
    formatUtcPart(publishedAt.getUTCMonth() + 1, 2),
    formatUtcPart(publishedAt.getUTCDate(), 2),
    "T",
    formatUtcPart(publishedAt.getUTCHours(), 2),
    formatUtcPart(publishedAt.getUTCMinutes(), 2),
    formatUtcPart(publishedAt.getUTCSeconds(), 2),
    "Z",
  ].join("");
}

function extractDatePortion(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function escapePostgresArrayElement(value: string): string {
  const escaped = value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `"${escaped}"`;
}

function toPostgresTextArrayLiteral(values: readonly string[]): string {
  return `{${values.map((value) => escapePostgresArrayElement(value)).join(",")}}`;
}

function stripInlineComment(value: string): string {
  const hashIndex = value.indexOf("#");
  if (hashIndex < 0) {
    return value;
  }

  return value.slice(0, hashIndex);
}

function decodeQuotedEnvValue(value: string): string {
  if (value.length < 2) {
    return value;
  }

  const firstCharacter = value[0];
  const lastCharacter = value.at(-1);
  if (
    (firstCharacter === '"' && lastCharacter === '"') ||
    (firstCharacter === "'" && lastCharacter === "'")
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export async function loadSourceRegistryEnvFileIfPresent(
  projectRoot: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  if (
    (typeof env.DATABASE_URL === "string" && env.DATABASE_URL.trim().length > 0) ||
    (typeof env.POSTGRES_URL === "string" && env.POSTGRES_URL.trim().length > 0)
  ) {
    return;
  }

  const envFilePath = join(projectRoot, APPS_API_ENV_PATH);
  let content: string;
  try {
    content = await readCsvFile(envFilePath);
  } catch {
    return;
  }

  for (const rawLine of normalizeLineEndings(content).split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (key.length === 0 || env[key] !== undefined) {
      continue;
    }

    const rawValue = line.slice(separatorIndex + 1).trim();
    env[key] = decodeQuotedEnvValue(stripInlineComment(rawValue).trim());
  }
}

async function markSupersededRegistryVersions(
  sql: BunSqlClient,
  registryVersion: string,
  effectiveToDate: string
): Promise<void> {
  await sql`
    UPDATE registry.source_definition
    SET effective_to = ${effectiveToDate}
    WHERE effective_to IS NULL
      AND registry_version <> ${registryVersion}
  `.execute();

  await sql`
    UPDATE registry.source_version
    SET effective_to = ${effectiveToDate}
    WHERE effective_to IS NULL
      AND registry_version <> ${registryVersion}
  `.execute();

  await sql`
    UPDATE registry.source_dependency_rule
    SET effective_to = ${effectiveToDate}
    WHERE effective_to IS NULL
      AND registry_version <> ${registryVersion}
  `.execute();
}

async function insertSourceDefinition(
  sql: BunSqlClient,
  row: SourceDefinitionSeedRow,
  registryVersion: string
): Promise<void> {
  const surfaceScopes = toPostgresTextArrayLiteral(row.surfaceScopes);
  await sql`
    INSERT INTO registry.source_definition (
      source_id,
      registry_version,
      source_name,
      provider_name,
      source_family,
      source_type,
      integration_state,
      owner_team,
      status,
      surface_scopes,
      default_role,
      precision_tier,
      launch_criticality,
      coverage_geography,
      coverage_grain,
      geometry_type,
      provider_update_cadence,
      production_method,
      evidence_type,
      description,
      known_gaps,
      code_entrypoint,
      effective_from,
      effective_to
    ) VALUES (
      ${row.sourceId},
      ${registryVersion},
      ${row.sourceName},
      ${row.providerName},
      ${row.sourceFamily},
      ${row.sourceType},
      ${row.integrationState},
      ${row.ownerTeam},
      ${row.status},
      ${surfaceScopes}::text[],
      ${row.defaultRole},
      ${row.precisionTier},
      ${row.launchCriticality},
      ${row.coverageGeography},
      ${row.coverageGrain},
      ${row.geometryType},
      ${row.providerUpdateCadence},
      ${row.productionMethod},
      ${row.evidenceType},
      ${row.description},
      ${row.knownGaps},
      ${row.codeEntrypoint},
      ${row.effectiveFrom},
      ${row.effectiveTo}
    )
  `.execute();
}

async function insertSourceVersion(
  sql: BunSqlClient,
  row: SourceVersionSeedRow,
  registryVersion: string
): Promise<void> {
  await sql`
    INSERT INTO registry.source_version (
      source_version_id,
      registry_version,
      source_id,
      provider_version_label,
      source_as_of_date,
      source_release_date,
      schema_version,
      geographic_extent_version,
      change_type,
      approval_status,
      change_notes,
      checksum_or_fingerprint,
      effective_from,
      effective_to
    ) VALUES (
      ${row.sourceVersionId},
      ${registryVersion},
      ${row.sourceId},
      ${row.providerVersionLabel},
      ${row.sourceAsOfDate},
      ${row.sourceReleaseDate},
      ${row.schemaVersion},
      ${row.geographicExtentVersion},
      ${row.changeType},
      ${row.approvalStatus},
      ${row.changeNotes},
      ${row.checksumOrFingerprint},
      ${row.effectiveFrom},
      ${row.effectiveTo}
    )
  `.execute();
}

async function insertSourceDependencyRule(
  sql: BunSqlClient,
  row: SourceDependencyRuleSeedRow,
  registryVersion: string
): Promise<void> {
  const allowedRoles = toPostgresTextArrayLiteral(row.allowedRoles);
  const surfaceScopes = toPostgresTextArrayLiteral(row.surfaceScopes);
  await sql`
    INSERT INTO registry.source_dependency_rule (
      dependency_rule_id,
      registry_version,
      source_id,
      downstream_object_type,
      downstream_object_id,
      role_in_downstream,
      requiredness,
      warn_if_days_stale,
      degrade_if_days_stale,
      suppress_if_days_stale,
      suppress_if_missing,
      precision_tier_c_allowed_for_primary,
      allowed_roles,
      truth_mode_cap,
      confidence_cap,
      surface_scopes,
      geography_scope,
      effective_from,
      effective_to
    ) VALUES (
      ${row.dependencyRuleId},
      ${registryVersion},
      ${row.sourceId},
      ${row.downstreamObjectType},
      ${row.downstreamObjectId},
      ${row.roleInDownstream},
      ${row.requiredness},
      ${row.warnIfDaysStale},
      ${row.degradeIfDaysStale},
      ${row.suppressIfDaysStale},
      ${row.suppressIfMissing},
      ${row.precisionTierCAllowedForPrimary},
      ${allowedRoles}::text[],
      ${row.truthModeCap},
      ${row.confidenceCap},
      ${surfaceScopes}::text[],
      ${row.geographyScope},
      ${row.effectiveFrom},
      ${row.effectiveTo}
    )
  `.execute();
}

async function upsertSourceRuntimeStatus(
  sql: BunSqlClient,
  row: SourceRegistryRuntimeSeedRow
): Promise<void> {
  await sql`
    INSERT INTO registry.source_runtime_status (
      source_id,
      current_registry_version,
      current_source_version_id,
      freshness_as_of,
      last_successful_ingest_at,
      latest_provider_update_seen_at,
      staleness_state,
      ingestion_health,
      access_status,
      runtime_alert_state
    ) VALUES (
      ${row.sourceId},
      ${row.currentRegistryVersion},
      ${row.currentSourceVersionId},
      ${row.freshnessAsOf},
      ${row.lastSuccessfulIngestAt},
      ${row.latestProviderUpdateSeenAt},
      ${row.stalenessState},
      ${row.ingestionHealth},
      ${row.accessStatus},
      ${row.runtimeAlertState}
    )
    ON CONFLICT (source_id) DO UPDATE
    SET
      current_registry_version = EXCLUDED.current_registry_version,
      current_source_version_id = EXCLUDED.current_source_version_id,
      freshness_as_of = EXCLUDED.freshness_as_of,
      last_successful_ingest_at = EXCLUDED.last_successful_ingest_at,
      latest_provider_update_seen_at = EXCLUDED.latest_provider_update_seen_at,
      staleness_state = EXCLUDED.staleness_state,
      ingestion_health = EXCLUDED.ingestion_health,
      access_status = EXCLUDED.access_status,
      runtime_alert_state = EXCLUDED.runtime_alert_state,
      updated_at = now()
  `.execute();
}

export async function publishSourceRegistry(
  options: SourceRegistryPublishOptions
): Promise<SourceRegistryPublishSummary> {
  const env = options.env ?? process.env;
  await loadSourceRegistryEnvFileIfPresent(options.projectRoot, env);
  resolveDatabaseUrl(env);
  if (env.DATABASE_URL !== undefined && process.env.DATABASE_URL === undefined) {
    process.env.DATABASE_URL = env.DATABASE_URL;
  }
  if (env.POSTGRES_URL !== undefined && process.env.POSTGRES_URL === undefined) {
    process.env.POSTGRES_URL = env.POSTGRES_URL;
  }

  const publishedAt = options.publishedAt ?? new Date();
  const registryVersion =
    typeof options.registryVersion === "string" && options.registryVersion.trim().length > 0
      ? options.registryVersion.trim()
      : generateSourceRegistryVersion(publishedAt);

  const bundle = await readSourceRegistrySeedBundle(options.projectRoot);
  const runtimeRows = resolveInitialSourceRegistryRuntimeRows(bundle, registryVersion, publishedAt);
  const sqlClient = getSourceRegistrySqlClient();

  await sqlClient.begin("read write", async (sql) => {
    await markSupersededRegistryVersions(sql, registryVersion, extractDatePortion(publishedAt));

    for (const definition of bundle.definitions) {
      await insertSourceDefinition(sql, definition, registryVersion);
    }

    for (const version of bundle.versions) {
      await insertSourceVersion(sql, version, registryVersion);
    }

    for (const dependencyRule of bundle.dependencyRules) {
      await insertSourceDependencyRule(sql, dependencyRule, registryVersion);
    }

    for (const runtimeRow of runtimeRows) {
      await upsertSourceRuntimeStatus(sql, runtimeRow);
    }
  });

  return {
    dependencyRuleCount: bundle.dependencyRules.length,
    definitionCount: bundle.definitions.length,
    logicalRegistryVersion: bundle.logicalRegistryVersion,
    publishedAt: publishedAt.toISOString(),
    registryVersion,
    runtimeStatusCount: runtimeRows.length,
    versionCount: bundle.versions.length,
  };
}
