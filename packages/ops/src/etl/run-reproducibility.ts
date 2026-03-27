import { writeJsonAtomic } from "./atomic-file-store";
import type {
  LoadRunEnvelopeResult,
  PersistRunEnvelopeArgs,
  RunArtifactReference,
  RunCodeReference,
  RunEnvelopeRecord,
  RunInputSnapshotRecord,
  RunReproducibilityKind,
  RunReproducibilitySummaryRecord,
  RunReproducibilitySurfaceScope,
  RunSourceSnapshotRecord,
} from "./run-reproducibility.types";
import type { BunSqlClient } from "./source-registry.types";
import { loadSourceRegistryEnvFileIfPresent } from "./source-registry-publish";

declare const Bun: {
  readonly sql: BunSqlClient;
};

let runReproducibilitySqlClient: BunSqlClient | null = null;

interface EnvelopeRowRecord {
  readonly artifact_refs_json: unknown;
  readonly code_hash: string;
  readonly code_refs_json: unknown;
  readonly config_hash: string;
  readonly config_json: unknown;
  readonly created_at: Date | string | null | undefined;
  readonly data_version: string | null | undefined;
  readonly downstream_objects_json: unknown;
  readonly effective_date: Date | string | null | undefined;
  readonly envelope_hash: string;
  readonly envelope_version: string;
  readonly formula_version: string | null | undefined;
  readonly ingestion_snapshot_ids_json: unknown;
  readonly input_state_hash: string;
  readonly methodology_id: string | null | undefined;
  readonly model_version: string | null | undefined;
  readonly month: Date | string | null | undefined;
  readonly notes: unknown;
  readonly output_counts_json: unknown;
  readonly output_hash: string | null | undefined;
  readonly output_tables_json: unknown;
  readonly registry_version: string | null | undefined;
  readonly replayability_tier: string;
  readonly replayed_from_run_id: string | null | undefined;
  readonly run_id: string;
  readonly run_kind: string;
  readonly run_recorded_at: Date | string;
  readonly source_version_ids_json: unknown;
  readonly status: string;
  readonly surface_scope: string;
  readonly updated_at: Date | string | null | undefined;
}

interface InputSnapshotRowRecord {
  readonly data_version: string | null | undefined;
  readonly details_json: unknown;
  readonly effective_date: Date | string | null | undefined;
  readonly manifest_hash: string | null | undefined;
  readonly manifest_path: string | null | undefined;
  readonly replay_mode: string;
  readonly snapshot_id: string;
  readonly snapshot_kind: string;
  readonly source_id: string | null | undefined;
  readonly source_version_id: string | null | undefined;
  readonly storage_uri: string | null | undefined;
}

interface SourceSnapshotRowRecord {
  readonly access_status: string | null | undefined;
  readonly completeness_observed: number | string | null | undefined;
  readonly details_json: unknown;
  readonly freshness_as_of: Date | string | null | undefined;
  readonly geographic_coverage_observed: number | string | null | undefined;
  readonly ingestion_health: string | null | undefined;
  readonly last_successful_ingest_at: Date | string | null | undefined;
  readonly latest_provider_update_seen_at: Date | string | null | undefined;
  readonly license_expiration_date: Date | string | null | undefined;
  readonly provider_version_label: string | null | undefined;
  readonly record_count: number | string | null | undefined;
  readonly runtime_alert_state: string | null | undefined;
  readonly runtime_state_hash: string;
  readonly source_as_of_date: Date | string | null | undefined;
  readonly source_id: string;
  readonly source_version_id: string | null | undefined;
  readonly staleness_state: string | null | undefined;
}

interface SummaryRowRecord {
  readonly config_hash: string;
  readonly data_version: string | null | undefined;
  readonly effective_date: Date | string | null | undefined;
  readonly envelope_hash: string;
  readonly envelope_version: string;
  readonly formula_version: string | null | undefined;
  readonly ingestion_snapshot_count: number | string | null | undefined;
  readonly input_state_hash: string;
  readonly methodology_id: string | null | undefined;
  readonly model_version: string | null | undefined;
  readonly output_hash: string | null | undefined;
  readonly registry_version: string | null | undefined;
  readonly replayability_tier: string;
  readonly replayed_from_run_id: string | null | undefined;
  readonly run_id: string;
  readonly run_kind: string;
  readonly run_recorded_at: Date | string;
  readonly source_version_count: number | string | null | undefined;
  readonly status: string;
  readonly surface_scope: string;
}

function readNullableText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readIsoValue(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readNullableNumber(value: number | string | null | undefined): number | null {
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

function readUnknownJson(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function readStringArray(value: unknown): readonly string[] {
  const parsed = readUnknownJson(value);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((entry) => {
    const normalized = readNullableText(typeof entry === "string" ? entry : null);
    return normalized === null ? [] : [normalized];
  });
}

function readRecord(value: unknown): Record<string, unknown> {
  const parsed = readUnknownJson(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  return Object.entries(parsed).reduce<Record<string, unknown>>((result, entry) => {
    const [key, fieldValue] = entry;
    result[key] = fieldValue;
    return result;
  }, {});
}

function mapRunCodeReferences(value: unknown): readonly RunCodeReference[] {
  const parsed = readUnknownJson(value);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return [];
    }

    const fileHash = readNullableText(Reflect.get(entry, "fileHash"));
    const filePath = readNullableText(Reflect.get(entry, "filePath"));
    const relativePath = readNullableText(Reflect.get(entry, "relativePath"));
    if (fileHash === null || filePath === null || relativePath === null) {
      return [];
    }

    return [
      {
        fileHash,
        filePath,
        relativePath,
      },
    ];
  });
}

function mapRunArtifactReferences(value: unknown): readonly RunArtifactReference[] {
  const parsed = readUnknownJson(value);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return [];
    }

    const artifactKind = readNullableText(Reflect.get(entry, "artifactKind"));
    const filePath = readNullableText(Reflect.get(entry, "filePath"));
    const relativePath = readNullableText(Reflect.get(entry, "relativePath"));
    if (artifactKind === null || filePath === null || relativePath === null) {
      return [];
    }

    return [
      {
        artifactKind,
        fileHash: readNullableText(Reflect.get(entry, "fileHash")),
        filePath,
        relativePath,
      },
    ];
  });
}

function mapEnvelopeRow(row: EnvelopeRowRecord): RunEnvelopeRecord {
  return {
    artifactRefsJson: mapRunArtifactReferences(row.artifact_refs_json),
    codeHash: row.code_hash,
    codeRefsJson: mapRunCodeReferences(row.code_refs_json),
    configHash: row.config_hash,
    configJson: readRecord(row.config_json),
    createdAt: readIsoValue(row.created_at),
    dataVersion: readNullableText(row.data_version),
    downstreamObjectsJson: readStringArray(row.downstream_objects_json),
    effectiveDate: readIsoValue(row.effective_date),
    envelopeHash: row.envelope_hash,
    envelopeVersion: "run-envelope-v1",
    formulaVersion: readNullableText(row.formula_version),
    ingestionSnapshotIdsJson: readStringArray(row.ingestion_snapshot_ids_json),
    inputStateHash: row.input_state_hash,
    methodologyId: readNullableText(row.methodology_id),
    modelVersion: readNullableText(row.model_version),
    month: readIsoValue(row.month),
    notesJson: readRecord(row.notes),
    outputCountsJson: readRecord(row.output_counts_json),
    outputHash: readNullableText(row.output_hash),
    outputTablesJson: readStringArray(row.output_tables_json),
    registryVersion: readNullableText(row.registry_version),
    replayabilityTier:
      row.replayability_tier === "strict" ||
      row.replayability_tier === "best_effort" ||
      row.replayability_tier === "not_replayable"
        ? row.replayability_tier
        : "not_replayable",
    replayedFromRunId: readNullableText(row.replayed_from_run_id),
    runId: row.run_id,
    runKind:
      row.run_kind === "publication" || row.run_kind === "analysis" || row.run_kind === "replay"
        ? row.run_kind
        : "publication",
    runRecordedAt: readIsoValue(row.run_recorded_at) ?? new Date(0).toISOString(),
    sourceVersionIdsJson: readStringArray(row.source_version_ids_json),
    status:
      row.status === "completed" || row.status === "failed" || row.status === "replayed"
        ? row.status
        : "failed",
    surfaceScope:
      row.surface_scope === "county" ||
      row.surface_scope === "corridor" ||
      row.surface_scope === "parcel"
        ? row.surface_scope
        : "county",
    updatedAt: readIsoValue(row.updated_at),
  };
}

function mapSourceSnapshotRow(row: SourceSnapshotRowRecord): RunSourceSnapshotRecord {
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
    detailsJson: readRecord(row.details_json),
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
    runtimeStateHash: row.runtime_state_hash,
    sourceAsOfDate: readIsoValue(row.source_as_of_date),
    sourceId: row.source_id,
    sourceVersionId: readNullableText(row.source_version_id),
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

function mapInputSnapshotRow(row: InputSnapshotRowRecord): RunInputSnapshotRecord {
  return {
    dataVersion: readNullableText(row.data_version),
    detailsJson: readRecord(row.details_json),
    effectiveDate: readIsoValue(row.effective_date),
    manifestHash: readNullableText(row.manifest_hash),
    manifestPath: readNullableText(row.manifest_path),
    replayMode:
      row.replay_mode === "strict_input" ||
      row.replay_mode === "self_snapshot" ||
      row.replay_mode === "best_effort_pointer"
        ? row.replay_mode
        : "best_effort_pointer",
    snapshotId: row.snapshot_id,
    snapshotKind: row.snapshot_kind,
    sourceId: readNullableText(row.source_id),
    sourceVersionId: readNullableText(row.source_version_id),
    storageUri: readNullableText(row.storage_uri),
  };
}

function mapSummaryRow(row: SummaryRowRecord): RunReproducibilitySummaryRecord {
  return {
    configHash: row.config_hash,
    dataVersion: readNullableText(row.data_version),
    effectiveDate: readIsoValue(row.effective_date),
    envelopeHash: row.envelope_hash,
    envelopeVersion: row.envelope_version,
    formulaVersion: readNullableText(row.formula_version),
    ingestionSnapshotCount: readNullableNumber(row.ingestion_snapshot_count) ?? 0,
    inputStateHash: row.input_state_hash,
    methodologyId: readNullableText(row.methodology_id),
    modelVersion: readNullableText(row.model_version),
    outputHash: readNullableText(row.output_hash),
    registryVersion: readNullableText(row.registry_version),
    replayabilityTier:
      row.replayability_tier === "strict" ||
      row.replayability_tier === "best_effort" ||
      row.replayability_tier === "not_replayable"
        ? row.replayability_tier
        : "not_replayable",
    replayedFromRunId: readNullableText(row.replayed_from_run_id),
    runId: row.run_id,
    runKind:
      row.run_kind === "publication" || row.run_kind === "analysis" || row.run_kind === "replay"
        ? row.run_kind
        : "publication",
    runRecordedAt: readIsoValue(row.run_recorded_at) ?? new Date(0).toISOString(),
    sourceVersionCount: readNullableNumber(row.source_version_count) ?? 0,
    status:
      row.status === "completed" || row.status === "failed" || row.status === "replayed"
        ? row.status
        : "failed",
    surfaceScope:
      row.surface_scope === "county" ||
      row.surface_scope === "corridor" ||
      row.surface_scope === "parcel"
        ? row.surface_scope
        : "county",
  };
}

function resolveDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const connectionString = env.DATABASE_URL ?? env.POSTGRES_URL;
  if (typeof connectionString === "string" && connectionString.trim().length > 0) {
    return connectionString.trim();
  }

  throw new Error("Missing DATABASE_URL or POSTGRES_URL");
}

export async function loadRunReproducibilityEnvFileIfPresent(
  projectRoot: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  await loadSourceRegistryEnvFileIfPresent(projectRoot, env);
}

export function getRunReproducibilitySqlClient(env: NodeJS.ProcessEnv = process.env): BunSqlClient {
  resolveDatabaseUrl(env);
  if (runReproducibilitySqlClient !== null) {
    return runReproducibilitySqlClient;
  }

  const sqlClient = Bun.sql;
  runReproducibilitySqlClient = sqlClient;
  return sqlClient;
}

export async function closeRunReproducibilitySqlClient(): Promise<void> {
  if (runReproducibilitySqlClient === null) {
    return;
  }

  const sqlClient = runReproducibilitySqlClient;
  runReproducibilitySqlClient = null;
  await sqlClient.close();
}

function toJsonString(value: unknown): string {
  return JSON.stringify(value);
}

async function insertEnvelope(sql: BunSqlClient, envelope: RunEnvelopeRecord): Promise<void> {
  await sql`
    INSERT INTO analytics_meta.run_reproducibility_envelope (
      surface_scope,
      run_kind,
      run_id,
      status,
      envelope_version,
      registry_version,
      model_version,
      formula_version,
      methodology_id,
      data_version,
      effective_date,
      month,
      run_recorded_at,
      replayed_from_run_id,
      replayability_tier,
      config_hash,
      code_hash,
      input_state_hash,
      envelope_hash,
      output_hash,
      source_version_ids_json,
      ingestion_snapshot_ids_json,
      downstream_objects_json,
      output_tables_json,
      output_counts_json,
      config_json,
      code_refs_json,
      artifact_refs_json,
      notes,
      updated_at
    ) VALUES (
      ${envelope.surfaceScope},
      ${envelope.runKind},
      ${envelope.runId},
      ${envelope.status},
      ${envelope.envelopeVersion},
      ${envelope.registryVersion},
      ${envelope.modelVersion},
      ${envelope.formulaVersion},
      ${envelope.methodologyId},
      ${envelope.dataVersion},
      ${envelope.effectiveDate},
      ${envelope.month},
      ${envelope.runRecordedAt},
      ${envelope.replayedFromRunId},
      ${envelope.replayabilityTier},
      ${envelope.configHash},
      ${envelope.codeHash},
      ${envelope.inputStateHash},
      ${envelope.envelopeHash},
      ${envelope.outputHash},
      ${toJsonString(envelope.sourceVersionIdsJson)}::jsonb,
      ${toJsonString(envelope.ingestionSnapshotIdsJson)}::jsonb,
      ${toJsonString(envelope.downstreamObjectsJson)}::jsonb,
      ${toJsonString(envelope.outputTablesJson)}::jsonb,
      ${toJsonString(envelope.outputCountsJson)}::jsonb,
      ${toJsonString(envelope.configJson)}::jsonb,
      ${toJsonString(envelope.codeRefsJson)}::jsonb,
      ${toJsonString(envelope.artifactRefsJson)}::jsonb,
      ${toJsonString(envelope.notesJson)}::jsonb,
      NOW()
    )
    ON CONFLICT (surface_scope, run_kind, run_id) DO UPDATE
    SET
      status = EXCLUDED.status,
      envelope_version = EXCLUDED.envelope_version,
      registry_version = EXCLUDED.registry_version,
      model_version = EXCLUDED.model_version,
      formula_version = EXCLUDED.formula_version,
      methodology_id = EXCLUDED.methodology_id,
      data_version = EXCLUDED.data_version,
      effective_date = EXCLUDED.effective_date,
      month = EXCLUDED.month,
      run_recorded_at = EXCLUDED.run_recorded_at,
      replayed_from_run_id = EXCLUDED.replayed_from_run_id,
      replayability_tier = EXCLUDED.replayability_tier,
      config_hash = EXCLUDED.config_hash,
      code_hash = EXCLUDED.code_hash,
      input_state_hash = EXCLUDED.input_state_hash,
      envelope_hash = EXCLUDED.envelope_hash,
      output_hash = EXCLUDED.output_hash,
      source_version_ids_json = EXCLUDED.source_version_ids_json,
      ingestion_snapshot_ids_json = EXCLUDED.ingestion_snapshot_ids_json,
      downstream_objects_json = EXCLUDED.downstream_objects_json,
      output_tables_json = EXCLUDED.output_tables_json,
      output_counts_json = EXCLUDED.output_counts_json,
      config_json = EXCLUDED.config_json,
      code_refs_json = EXCLUDED.code_refs_json,
      artifact_refs_json = EXCLUDED.artifact_refs_json,
      notes = EXCLUDED.notes,
      updated_at = NOW()
  `.execute();
}

async function insertSourceSnapshots(
  sql: BunSqlClient,
  envelope: RunEnvelopeRecord,
  sourceSnapshots: readonly RunSourceSnapshotRecord[]
): Promise<void> {
  await sql`
    DELETE FROM analytics_meta.run_reproducibility_source_snapshot
    WHERE surface_scope = ${envelope.surfaceScope}
      AND run_kind = ${envelope.runKind}
      AND run_id = ${envelope.runId}
  `.execute();

  for (const snapshot of sourceSnapshots) {
    await sql`
      INSERT INTO analytics_meta.run_reproducibility_source_snapshot (
        surface_scope,
        run_kind,
        run_id,
        source_id,
        source_version_id,
        provider_version_label,
        source_as_of_date,
        freshness_as_of,
        staleness_state,
        ingestion_health,
        access_status,
        runtime_alert_state,
        last_successful_ingest_at,
        latest_provider_update_seen_at,
        record_count,
        completeness_observed,
        geographic_coverage_observed,
        license_expiration_date,
        runtime_state_hash,
        details_json
      ) VALUES (
        ${envelope.surfaceScope},
        ${envelope.runKind},
        ${envelope.runId},
        ${snapshot.sourceId},
        ${snapshot.sourceVersionId},
        ${snapshot.providerVersionLabel},
        ${snapshot.sourceAsOfDate},
        ${snapshot.freshnessAsOf},
        ${snapshot.stalenessState},
        ${snapshot.ingestionHealth},
        ${snapshot.accessStatus},
        ${snapshot.runtimeAlertState},
        ${snapshot.lastSuccessfulIngestAt},
        ${snapshot.latestProviderUpdateSeenAt},
        ${snapshot.recordCount},
        ${snapshot.completenessObserved},
        ${snapshot.geographicCoverageObserved},
        ${snapshot.licenseExpirationDate},
        ${snapshot.runtimeStateHash},
        ${toJsonString(snapshot.detailsJson)}::jsonb
      )
    `.execute();
  }
}

async function insertInputSnapshots(
  sql: BunSqlClient,
  envelope: RunEnvelopeRecord,
  inputSnapshots: readonly RunInputSnapshotRecord[]
): Promise<void> {
  await sql`
    DELETE FROM analytics_meta.run_reproducibility_input_snapshot
    WHERE surface_scope = ${envelope.surfaceScope}
      AND run_kind = ${envelope.runKind}
      AND run_id = ${envelope.runId}
  `.execute();

  for (const snapshot of inputSnapshots) {
    await sql`
      INSERT INTO analytics_meta.run_reproducibility_input_snapshot (
        surface_scope,
        run_kind,
        run_id,
        snapshot_kind,
        snapshot_id,
        source_id,
        source_version_id,
        manifest_path,
        manifest_hash,
        storage_uri,
        effective_date,
        data_version,
        replay_mode,
        details_json
      ) VALUES (
        ${envelope.surfaceScope},
        ${envelope.runKind},
        ${envelope.runId},
        ${snapshot.snapshotKind},
        ${snapshot.snapshotId},
        ${snapshot.sourceId},
        ${snapshot.sourceVersionId},
        ${snapshot.manifestPath},
        ${snapshot.manifestHash},
        ${snapshot.storageUri},
        ${snapshot.effectiveDate},
        ${snapshot.dataVersion},
        ${snapshot.replayMode},
        ${toJsonString(snapshot.detailsJson)}::jsonb
      )
    `.execute();
  }
}

export async function persistRunReproducibilityEnvelope(
  args: PersistRunEnvelopeArgs
): Promise<void> {
  const sqlClient = args.sqlClient ?? getRunReproducibilitySqlClient();
  await sqlClient.begin("read write", async (sql) => {
    await insertEnvelope(sql, args.envelope);
    await insertSourceSnapshots(sql, args.envelope, args.sourceSnapshots);
    await insertInputSnapshots(sql, args.envelope, args.inputSnapshots);
  });
}

export async function loadRunReproducibilityEnvelope(
  surfaceScope: RunReproducibilitySurfaceScope,
  runKind: RunReproducibilityKind,
  runId: string,
  sqlClient: BunSqlClient = getRunReproducibilitySqlClient()
): Promise<LoadRunEnvelopeResult | null> {
  const envelopeRows = await sqlClient
    .unsafe<EnvelopeRowRecord[]>(
      `SELECT *
FROM analytics_meta.run_reproducibility_envelope
WHERE surface_scope = $1
  AND run_kind = $2
  AND run_id = $3
LIMIT 1`,
      [surfaceScope, runKind, runId]
    )
    .execute();
  const envelopeRow = envelopeRows[0];
  if (envelopeRow === undefined) {
    return null;
  }

  const sourceRows = await sqlClient
    .unsafe<SourceSnapshotRowRecord[]>(
      `SELECT *
FROM analytics_meta.run_reproducibility_source_snapshot
WHERE surface_scope = $1
  AND run_kind = $2
  AND run_id = $3
ORDER BY source_id`,
      [surfaceScope, runKind, runId]
    )
    .execute();
  const inputRows = await sqlClient
    .unsafe<InputSnapshotRowRecord[]>(
      `SELECT *
FROM analytics_meta.run_reproducibility_input_snapshot
WHERE surface_scope = $1
  AND run_kind = $2
  AND run_id = $3
ORDER BY snapshot_kind, snapshot_id`,
      [surfaceScope, runKind, runId]
    )
    .execute();

  return {
    envelope: mapEnvelopeRow(envelopeRow),
    inputSnapshots: inputRows.map(mapInputSnapshotRow),
    sourceSnapshots: sourceRows.map(mapSourceSnapshotRow),
  };
}

export async function readRunReproducibilitySummary(
  surfaceScope: RunReproducibilitySurfaceScope,
  runKind: RunReproducibilityKind,
  runId: string,
  sqlClient: BunSqlClient = getRunReproducibilitySqlClient()
): Promise<RunReproducibilitySummaryRecord | null> {
  const rows = await sqlClient
    .unsafe<SummaryRowRecord[]>(
      `SELECT *
FROM analytics_meta.v_run_reproducibility_summary
WHERE surface_scope = $1
  AND run_kind = $2
  AND run_id = $3
LIMIT 1`,
      [surfaceScope, runKind, runId]
    )
    .execute();
  const row = rows[0];
  return row === undefined ? null : mapSummaryRow(row);
}

export function writeRunEnvelopeCopyToDisk(path: string, result: LoadRunEnvelopeResult): void {
  writeJsonAtomic(path, {
    envelope: result.envelope,
    inputSnapshots: result.inputSnapshots,
    sourceSnapshots: result.sourceSnapshots,
  });
}
