import { getRunReproducibilitySqlClient } from "./run-reproducibility";
import type { RunSourceSnapshotRecord } from "./run-reproducibility.types";
import { hashCanonicalJson } from "./run-reproducibility-hash";
import type { BunSqlClient } from "./source-registry.types";

interface RegistryVersionRow {
  readonly registry_version: string;
}

interface RegistrySourceIdRow {
  readonly source_id: string;
}

interface RegistrySourceSnapshotRow {
  readonly access_status: string | null | undefined;
  readonly code_entrypoint: string | null | undefined;
  readonly completeness_observed: number | string | null | undefined;
  readonly coverage_geography: string | null | undefined;
  readonly coverage_grain: string | null | undefined;
  readonly current_source_version_id: string | null | undefined;
  readonly evidence_type: string | null | undefined;
  readonly freshness_as_of: Date | string | null | undefined;
  readonly geographic_coverage_observed: number | string | null | undefined;
  readonly ingestion_health: string | null | undefined;
  readonly integration_state: string | null | undefined;
  readonly last_successful_ingest_at: Date | string | null | undefined;
  readonly latest_provider_update_seen_at: Date | string | null | undefined;
  readonly license_expiration_date: Date | string | null | undefined;
  readonly precision_tier: string | null | undefined;
  readonly provider_version_label: string | null | undefined;
  readonly record_count: number | string | null | undefined;
  readonly registry_version: string;
  readonly runtime_alert_state: string | null | undefined;
  readonly source_as_of_date: Date | string | null | undefined;
  readonly source_family: string | null | undefined;
  readonly source_id: string;
  readonly source_name: string;
  readonly staleness_state: string | null | undefined;
}

function readNullableText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readIsoValue(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return readNullableText(value);
}

function readNullableNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapRegistrySourceSnapshot(row: RegistrySourceSnapshotRow): RunSourceSnapshotRecord {
  const detailsJson = {
    codeEntrypoint: readNullableText(row.code_entrypoint),
    coverageGeography: readNullableText(row.coverage_geography),
    coverageGrain: readNullableText(row.coverage_grain),
    evidenceType: readNullableText(row.evidence_type),
    integrationState: readNullableText(row.integration_state),
    precisionTier: readNullableText(row.precision_tier),
    registryVersion: row.registry_version,
    sourceFamily: readNullableText(row.source_family),
    sourceName: row.source_name,
  };

  return {
    accessStatus:
      row.access_status === "accessible" ||
      row.access_status === "cached_only" ||
      row.access_status === "lost_access" ||
      row.access_status === "pending_renewal" ||
      row.access_status === "planned"
        ? row.access_status
        : null,
    completenessObserved: readNullableNumber(row.completeness_observed),
    detailsJson,
    freshnessAsOf: readIsoValue(row.freshness_as_of),
    geographicCoverageObserved: readNullableNumber(row.geographic_coverage_observed),
    ingestionHealth:
      row.ingestion_health === "healthy" ||
      row.ingestion_health === "degraded" ||
      row.ingestion_health === "failed" ||
      row.ingestion_health === "not_run"
        ? row.ingestion_health
        : null,
    lastSuccessfulIngestAt: readIsoValue(row.last_successful_ingest_at),
    latestProviderUpdateSeenAt: readIsoValue(row.latest_provider_update_seen_at),
    licenseExpirationDate: readIsoValue(row.license_expiration_date),
    providerVersionLabel: readNullableText(row.provider_version_label),
    recordCount: readNullableNumber(row.record_count),
    runtimeAlertState:
      row.runtime_alert_state === "none" ||
      row.runtime_alert_state === "warning" ||
      row.runtime_alert_state === "blocking" ||
      row.runtime_alert_state === "investigating"
        ? row.runtime_alert_state
        : null,
    runtimeStateHash: hashCanonicalJson({
      accessStatus: readNullableText(row.access_status),
      completenessObserved: readNullableNumber(row.completeness_observed),
      freshnessAsOf: readIsoValue(row.freshness_as_of),
      geographicCoverageObserved: readNullableNumber(row.geographic_coverage_observed),
      ingestionHealth: readNullableText(row.ingestion_health),
      lastSuccessfulIngestAt: readIsoValue(row.last_successful_ingest_at),
      latestProviderUpdateSeenAt: readIsoValue(row.latest_provider_update_seen_at),
      licenseExpirationDate: readIsoValue(row.license_expiration_date),
      providerVersionLabel: readNullableText(row.provider_version_label),
      recordCount: readNullableNumber(row.record_count),
      registryVersion: row.registry_version,
      runtimeAlertState: readNullableText(row.runtime_alert_state),
      sourceAsOfDate: readIsoValue(row.source_as_of_date),
      sourceId: row.source_id,
      sourceVersionId: readNullableText(row.current_source_version_id),
      stalenessState: readNullableText(row.staleness_state),
    }),
    sourceAsOfDate: readIsoValue(row.source_as_of_date),
    sourceId: row.source_id,
    sourceVersionId: readNullableText(row.current_source_version_id),
    stalenessState:
      row.staleness_state === "fresh" ||
      row.staleness_state === "aging" ||
      row.staleness_state === "stale" ||
      row.staleness_state === "critical" ||
      row.staleness_state === "unknown"
        ? row.staleness_state
        : null,
  };
}

export async function resolveRegistryVersion(
  requestedRegistryVersion: string | null | undefined,
  sqlClient: BunSqlClient = getRunReproducibilitySqlClient()
): Promise<string> {
  if (typeof requestedRegistryVersion === "string" && requestedRegistryVersion.trim().length > 0) {
    const rows = await sqlClient
      .unsafe<RegistryVersionRow[]>(
        `SELECT DISTINCT source_definition.registry_version
FROM registry.source_definition AS source_definition
WHERE source_definition.registry_version = $1
LIMIT 1`,
        [requestedRegistryVersion.trim()]
      )
      .execute();
    const explicitVersion = rows[0]?.registry_version;
    if (typeof explicitVersion === "string" && explicitVersion.trim().length > 0) {
      return explicitVersion;
    }

    throw new Error(`Registry version not found: ${requestedRegistryVersion.trim()}`);
  }

  const rows = await sqlClient
    .unsafe<RegistryVersionRow[]>(
      `SELECT source_definition.registry_version
FROM registry.source_definition AS source_definition
WHERE source_definition.effective_to IS NULL
GROUP BY source_definition.registry_version
ORDER BY MAX(source_definition.effective_from) DESC, source_definition.registry_version DESC
LIMIT 1`
    )
    .execute();
  const latestVersion = rows[0]?.registry_version;
  if (typeof latestVersion === "string" && latestVersion.trim().length > 0) {
    return latestVersion;
  }

  throw new Error("No published registry version found");
}

export async function listSourceIdsByCodeEntrypoint(
  registryVersion: string,
  codeEntrypoint: string,
  sqlClient: BunSqlClient = getRunReproducibilitySqlClient()
): Promise<readonly string[]> {
  const rows = await sqlClient
    .unsafe<RegistrySourceIdRow[]>(
      `SELECT source_definition.source_id
FROM registry.source_definition AS source_definition
JOIN registry.source_version AS source_version
  ON source_version.source_id = source_definition.source_id
  AND source_version.registry_version = source_definition.registry_version
WHERE source_definition.registry_version = $1
  AND source_definition.effective_to IS NULL
  AND source_definition.status = 'active'
  AND source_definition.code_entrypoint = $2
  AND source_version.approval_status = 'approved'
  AND source_version.effective_to IS NULL
ORDER BY source_definition.source_id`,
      [registryVersion, codeEntrypoint]
    )
    .execute();

  return rows.map((row) => row.source_id);
}

export async function listSourceSnapshotsForRegistryVersion(
  registryVersion: string,
  sourceIds: readonly string[],
  sqlClient: BunSqlClient = getRunReproducibilitySqlClient()
): Promise<readonly RunSourceSnapshotRecord[]> {
  if (sourceIds.length === 0) {
    return [];
  }

  const sourceIdPlaceholders = sourceIds
    .map((_sourceId, index) => `$${String(index + 2)}`)
    .join(", ");

  const rows = await sqlClient
    .unsafe<RegistrySourceSnapshotRow[]>(
      `SELECT
  source_definition.source_id,
  source_definition.registry_version,
  source_definition.source_name,
  source_definition.source_family,
  source_definition.integration_state,
  source_definition.coverage_geography,
  source_definition.coverage_grain,
  source_definition.precision_tier,
  source_definition.evidence_type,
  source_definition.code_entrypoint,
  source_runtime_status.current_source_version_id,
  source_version.provider_version_label,
  source_version.source_as_of_date,
  source_runtime_status.freshness_as_of,
  source_runtime_status.staleness_state,
  source_runtime_status.ingestion_health,
  source_runtime_status.access_status,
  source_runtime_status.runtime_alert_state,
  source_runtime_status.last_successful_ingest_at,
  source_runtime_status.latest_provider_update_seen_at,
  source_runtime_status.record_count,
  source_runtime_status.completeness_observed,
  source_runtime_status.geographic_coverage_observed,
  source_runtime_status.license_expiration_date
FROM registry.source_definition AS source_definition
LEFT JOIN registry.source_runtime_status AS source_runtime_status
  ON source_runtime_status.source_id = source_definition.source_id
  AND source_runtime_status.current_registry_version = source_definition.registry_version
LEFT JOIN registry.source_version AS source_version
  ON source_version.source_version_id = source_runtime_status.current_source_version_id
  AND source_version.registry_version = source_definition.registry_version
WHERE source_definition.registry_version = $1
  AND source_definition.source_id IN (${sourceIdPlaceholders})
ORDER BY source_definition.source_id`,
      [registryVersion, ...sourceIds]
    )
    .execute();

  return rows.map(mapRegistrySourceSnapshot);
}
