import type {
  CountyCongestionSnapshotDebug,
  CountyOperatorZoneDebug,
  CountyQueuePoiReferenceDebug,
  CountyQueueResolutionDebug,
  CountyScoresCoverageByOperator,
  CountyScoresCoverageField,
  CountyScoresDebugCounty,
  CountyScoresResolutionSource,
} from "@map-migration/http-contracts/county-intelligence-debug-http";
import type {
  CountyScore,
  CountyScoresStatusResponse,
} from "@map-migration/http-contracts/county-intelligence-http";
import { mapCountyScoreRow } from "@/geo/county-intelligence/county-intelligence.mapper";
import type {
  CountyCongestionDebugRow,
  CountyOperatorZoneDebugRow,
  CountyQueuePoiReferenceDebugRow,
  CountyQueueResolutionDebugRow,
  CountyScoreRow,
  CountyScoresCoverageByOperatorRow,
  CountyScoresCoverageFieldRow,
  CountyScoresResolutionSourceRow,
  CountyScoresStatusRow,
} from "@/geo/county-intelligence/county-intelligence.repo";
import {
  getCountyScoresStatusSnapshot,
  listCountyCongestionDebug,
  listCountyOperatorZoneDebug,
  listCountyQueuePoiReferenceDebug,
  listCountyQueueResolutionDebug,
  listCountyScores,
  listCountyScoresCoverageByOperator,
  listCountyScoresCoverageFields,
  listCountyScoresResolutionBySource,
} from "@/geo/county-intelligence/county-intelligence.repo";
import type {
  QueryCountyScoresArgs,
  QueryCountyScoresCoverageResult,
  QueryCountyScoresDebugResult,
  QueryCountyScoresResolutionResult,
  QueryCountyScoresResult,
  QueryCountyScoresStatusResult,
} from "./county-intelligence.service.types";

const COUNTY_SCORES_RELATION_NAMES: readonly string[] = [
  "analytics.bridge_county_operator_zone",
  "analytics.county_market_pressure_current",
  "analytics.dim_county",
  "analytics.dim_queue_poi_reference",
  "analytics.fact_congestion_snapshot",
  "analytics.fact_gen_queue_county_resolution",
  "analytics.fact_publication",
];

function compareCountyScores(left: CountyScore, right: CountyScore): number {
  if (left.marketPressureIndex !== null && right.marketPressureIndex !== null) {
    if (left.marketPressureIndex !== right.marketPressureIndex) {
      return right.marketPressureIndex - left.marketPressureIndex;
    }
  } else if (left.marketPressureIndex === null && right.marketPressureIndex !== null) {
    return 1;
  } else if (left.marketPressureIndex !== null && right.marketPressureIndex === null) {
    return -1;
  }

  if (left.rankStatus !== right.rankStatus) {
    const rankOrder = new Map<string, number>([
      ["blocked", 0],
      ["ranked", 1],
      ["deferred", 2],
    ]);
    return (rankOrder.get(left.rankStatus) ?? 3) - (rankOrder.get(right.rankStatus) ?? 3);
  }

  return left.countyFips.localeCompare(right.countyFips);
}

function uniqueCountyIds(countyIds: readonly string[]): readonly string[] {
  return [...new Set(countyIds)];
}

function readBooleanFlag(value: boolean | number | string | null | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "t" || normalized === "1";
}

function isCountyScoresSourceUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();
  if (!normalizedMessage.includes("does not exist")) {
    return false;
  }

  return COUNTY_SCORES_RELATION_NAMES.some((relationName) => error.message.includes(relationName));
}

function isCountyReferenceAvailable(row: CountyScoreRow): boolean {
  return readBooleanFlag(row.has_county_reference);
}

function missingCountyIds(
  requestedCountyIds: readonly string[],
  rows: readonly CountyScoreRow[]
): readonly string[] {
  const returnedCountyIds = new Set(
    rows.filter((row) => isCountyReferenceAvailable(row)).map((row) => row.county_fips)
  );

  return requestedCountyIds.filter((countyId) => !returnedCountyIds.has(countyId));
}

function readNullableText(value: string | null | undefined): string | null {
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

function readNullableUnitInterval(value: number | string | null | undefined): number | null {
  const parsed = readNullableNumber(value);
  if (parsed === null || parsed < 0 || parsed > 1) {
    return null;
  }

  return parsed;
}

function readNonNegativeInteger(
  value: number | string | null | undefined,
  fieldName: string
): number {
  if (typeof value === "number") {
    if (Number.isInteger(value) && value >= 0) {
      return value;
    }

    throw new Error(`invalid ${fieldName}`);
  }

  if (typeof value !== "string") {
    throw new Error(`missing ${fieldName}`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`missing ${fieldName}`);
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`invalid ${fieldName}`);
  }

  return parsed;
}

function readNullableIsoDateTime(
  value: Date | string | null | undefined,
  fieldName: string
): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`invalid ${fieldName}`);
    }

    return value.toISOString();
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`invalid ${fieldName}`);
  }

  return parsed.toISOString();
}

function readNullableIsoDate(
  value: Date | string | null | undefined,
  fieldName: string
): string | null {
  const isoDateTime = readNullableIsoDateTime(value, fieldName);
  return isoDateTime === null ? null : isoDateTime.slice(0, 10);
}

function readStringArray(value: unknown, fieldName: string): readonly string[] {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return [];
    }

    return readStringArray(JSON.parse(normalized), fieldName);
  }

  if (typeof value === "undefined" || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`invalid ${fieldName}`);
  }

  return value.flatMap((entry) => {
    if (typeof entry !== "string") {
      throw new Error(`invalid ${fieldName}`);
    }

    const normalized = entry.trim();
    return normalized.length > 0 ? [normalized] : [];
  });
}

function readRequiredUnitInterval(
  value: number | string | null | undefined,
  fieldName: string
): number {
  const parsed = readNullableUnitInterval(value);
  if (parsed === null) {
    throw new Error(`invalid ${fieldName}`);
  }

  return parsed;
}

function readNullableConfidenceBadge(
  value: string | null | undefined
): CountyOperatorZoneDebug["operatorZoneConfidence"] {
  const normalized = readNullableText(value);
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }

  return null;
}

function hasFeature(availableFeatureFamilies: ReadonlySet<string>, featureName: string): boolean {
  return availableFeatureFamilies.has(featureName);
}

function hasPublishedCountyScores(status: Omit<CountyScoresStatusResponse, "meta">): boolean {
  return (
    status.datasetAvailable &&
    status.publicationRunId !== null &&
    status.dataVersion !== null &&
    status.formulaVersion !== null &&
    status.inputDataVersion !== null
  );
}

function mapCountyScoresStatusRow(
  row: CountyScoresStatusRow
): Omit<CountyScoresStatusResponse, "meta"> {
  const availableFeatureFamilies = new Set(
    readStringArray(row.available_feature_families, "available_feature_families")
  );
  const missingFeatureFamilies = readStringArray(
    row.missing_feature_families,
    "missing_feature_families"
  );
  const rowCount = readNonNegativeInteger(row.row_count, "row_count");
  const sourceCountyCount = readNonNegativeInteger(row.source_county_count, "source_county_count");

  return {
    datasetAvailable:
      readNullableText(row.publication_status) === "published" &&
      readNullableText(row.publication_run_id) !== null &&
      rowCount > 0,
    publicationRunId: readNullableText(row.publication_run_id),
    publishedAt: readNullableIsoDateTime(row.published_at, "published_at"),
    methodologyId: readNullableText(row.methodology_id),
    dataVersion: readNullableText(row.data_version),
    inputDataVersion: readNullableText(row.input_data_version),
    formulaVersion: readNullableText(row.formula_version),
    rowCount,
    sourceCountyCount,
    rankedCountyCount: readNonNegativeInteger(row.ranked_county_count ?? 0, "ranked_county_count"),
    deferredCountyCount: readNonNegativeInteger(
      row.deferred_county_count ?? 0,
      "deferred_county_count"
    ),
    blockedCountyCount: readNonNegativeInteger(
      row.blocked_county_count ?? 0,
      "blocked_county_count"
    ),
    highConfidenceCount: readNonNegativeInteger(
      row.high_confidence_count ?? 0,
      "high_confidence_count"
    ),
    mediumConfidenceCount: readNonNegativeInteger(
      row.medium_confidence_count ?? 0,
      "medium_confidence_count"
    ),
    lowConfidenceCount: readNonNegativeInteger(
      row.low_confidence_count ?? 0,
      "low_confidence_count"
    ),
    freshCountyCount: readNonNegativeInteger(row.fresh_county_count ?? 0, "fresh_county_count"),
    availableFeatureFamilies: [...availableFeatureFamilies],
    missingFeatureFamilies: [...missingFeatureFamilies],
    featureCoverage: {
      congestion: hasFeature(availableFeatureFamilies, "congestion"),
      demand: hasFeature(availableFeatureFamilies, "demand"),
      gridFriction: hasFeature(availableFeatureFamilies, "grid_friction"),
      history: hasFeature(availableFeatureFamilies, "history"),
      infrastructure: hasFeature(availableFeatureFamilies, "infrastructure"),
      interconnectionQueue: hasFeature(availableFeatureFamilies, "interconnection_queue"),
      marketSeams: hasFeature(availableFeatureFamilies, "market_seams"),
      narratives: hasFeature(availableFeatureFamilies, "narratives"),
      operatingFootprints: hasFeature(availableFeatureFamilies, "operating_footprints"),
      policy: hasFeature(availableFeatureFamilies, "policy"),
      retailStructure: hasFeature(availableFeatureFamilies, "retail_structure"),
      supplyTimeline: hasFeature(availableFeatureFamilies, "supply_timeline"),
      transmission: hasFeature(availableFeatureFamilies, "transmission"),
      utilityTerritories: hasFeature(availableFeatureFamilies, "utility_territories"),
      wholesaleMarkets: hasFeature(availableFeatureFamilies, "wholesale_markets"),
    },
  };
}

function mapCountyScoresCoverageFieldRow(
  row: CountyScoresCoverageFieldRow
): CountyScoresCoverageField {
  return {
    fieldName: row.field_name,
    populatedCount: readNonNegativeInteger(row.populated_count, "populated_count"),
    totalCount: readNonNegativeInteger(row.total_count, "total_count"),
  };
}

function mapCountyScoresCoverageByOperatorRow(
  row: CountyScoresCoverageByOperatorRow
): CountyScoresCoverageByOperator {
  return {
    avgRtCongestionComponentCount: readNonNegativeInteger(
      row.avg_rt_congestion_component_count,
      "avg_rt_congestion_component_count"
    ),
    countyCount: readNonNegativeInteger(row.county_count, "county_count"),
    meteoZoneCount: readNonNegativeInteger(row.meteo_zone_count, "meteo_zone_count"),
    operatorWeatherZoneCount: readNonNegativeInteger(
      row.operator_weather_zone_count,
      "operator_weather_zone_count"
    ),
    operatorZoneLabelCount: readNonNegativeInteger(
      row.operator_zone_label_count,
      "operator_zone_label_count"
    ),
    p95ShadowPriceCount: readNonNegativeInteger(
      row.p95_shadow_price_count,
      "p95_shadow_price_count"
    ),
    primaryTduOrUtilityCount: readNonNegativeInteger(
      row.primary_tdu_or_utility_count,
      "primary_tdu_or_utility_count"
    ),
    wholesaleOperator: readNullableText(row.wholesale_operator) ?? "unknown",
  };
}

function mapCountyScoresResolutionSourceRow(
  row: CountyScoresResolutionSourceRow
): CountyScoresResolutionSource {
  return {
    sourceSystem: row.source_system,
    totalProjects: readNonNegativeInteger(row.total_projects, "total_projects"),
    unresolvedProjects: readNonNegativeInteger(row.unresolved_projects, "unresolved_projects"),
    totalSnapshots: readNonNegativeInteger(row.total_snapshots, "total_snapshots"),
    unresolvedSnapshots: readNonNegativeInteger(row.unresolved_snapshots, "unresolved_snapshots"),
    directResolutionCount: readNonNegativeInteger(
      row.direct_resolution_count,
      "direct_resolution_count"
    ),
    derivedResolutionCount: readNonNegativeInteger(
      row.derived_resolution_count,
      "derived_resolution_count"
    ),
    manualResolutionCount: readNonNegativeInteger(
      row.manual_resolution_count,
      "manual_resolution_count"
    ),
    lowConfidenceResolutionCount: readNonNegativeInteger(
      row.low_confidence_resolution_count,
      "low_confidence_resolution_count"
    ),
    samplePoiLabels: [...readStringArray(row.sample_poi_labels, "sample_poi_labels")],
    sampleLocationLabels: [
      ...readStringArray(row.sample_location_labels, "sample_location_labels"),
    ],
    sampleSnapshotPoiLabels: [
      ...readStringArray(row.sample_snapshot_poi_labels, "sample_snapshot_poi_labels"),
    ],
    sampleSnapshotLocationLabels: [
      ...readStringArray(row.sample_snapshot_location_labels, "sample_snapshot_location_labels"),
    ],
  };
}

function mapCountyOperatorZoneDebugRow(row: CountyOperatorZoneDebugRow): CountyOperatorZoneDebug {
  return {
    allocationShare: readRequiredUnitInterval(row.allocation_share, "allocation_share"),
    operatorZoneConfidence: readNullableConfidenceBadge(row.operator_zone_confidence),
    operatorZoneLabel: row.operator_zone_label,
    operatorZoneType: row.operator_zone_type,
    resolutionMethod: row.resolution_method,
    sourceAsOfDate: readNullableIsoDate(row.source_as_of_date, "source_as_of_date"),
    wholesaleOperator: row.wholesale_operator,
  };
}

function mapCountyQueueResolutionDebugRow(
  row: CountyQueueResolutionDebugRow
): CountyQueueResolutionDebug {
  return {
    allocationShare: readRequiredUnitInterval(row.allocation_share, "allocation_share"),
    countyFips: row.county_fips,
    projectId: row.project_id,
    queuePoiLabel: readNullableText(row.queue_poi_label),
    resolverConfidence: row.resolver_confidence,
    resolverType: row.resolver_type,
    sourceLocationLabel: readNullableText(row.source_location_label),
    sourceSystem: row.source_system,
    stateAbbrev: readNullableText(row.state_abbrev),
  };
}

function mapCountyQueuePoiReferenceDebugRow(
  row: CountyQueuePoiReferenceDebugRow
): CountyQueuePoiReferenceDebug {
  return {
    countyFips: row.county_fips,
    operatorZoneLabel: readNullableText(row.operator_zone_label),
    operatorZoneType: readNullableText(row.operator_zone_type),
    queuePoiLabel: row.queue_poi_label,
    resolutionMethod: row.resolution_method,
    resolverConfidence: row.resolver_confidence,
    sourceAsOfDate: readNullableIsoDate(row.source_as_of_date, "source_as_of_date"),
    sourceSystem: row.source_system,
    stateAbbrev: readNullableText(row.state_abbrev),
  };
}

function mapCountyCongestionDebugRow(row: CountyCongestionDebugRow): CountyCongestionSnapshotDebug {
  return {
    avgRtCongestionComponent: readNullableNumber(row.avg_rt_congestion_component),
    negativePriceHourShare: readNullableUnitInterval(row.negative_price_hour_share),
    p95ShadowPrice: readNullableNumber(row.p95_shadow_price),
    sourceAsOfDate: readNullableIsoDate(row.source_as_of_date, "source_as_of_date"),
  };
}

function deferredCountyIds(rows: readonly CountyScore[]): readonly string[] {
  return rows.filter((row) => row.rankStatus === "deferred").map((row) => row.countyFips);
}

function blockedCountyIds(rows: readonly CountyScore[]): readonly string[] {
  return rows.filter((row) => row.rankStatus === "blocked").map((row) => row.countyFips);
}

export async function queryCountyScores(
  args: QueryCountyScoresArgs
): Promise<QueryCountyScoresResult> {
  const requestedCountyIds = uniqueCountyIds(args.countyIds);

  let rows: readonly CountyScoreRow[];
  let statusRow: CountyScoresStatusRow;
  try {
    if (args.statusSnapshot === undefined) {
      [rows, statusRow] = await Promise.all([
        listCountyScores(requestedCountyIds),
        getCountyScoresStatusSnapshot(),
      ]);
    } else {
      [rows, statusRow] = [await listCountyScores(requestedCountyIds), args.statusSnapshot];
    }
  } catch (error) {
    if (isCountyScoresSourceUnavailable(error)) {
      return {
        ok: false,
        value: {
          reason: "source_unavailable",
          error,
        },
      };
    }

    return {
      ok: false,
      value: {
        reason: "query_failed",
        error,
      },
    };
  }

  try {
    const status = mapCountyScoresStatusRow(statusRow);
    if (!hasPublishedCountyScores(status)) {
      return {
        ok: false,
        value: {
          reason: "source_unavailable",
          error: new Error("county market-pressure publication is unavailable"),
        },
      };
    }

    const publicationDataVersion = status.dataVersion;
    if (publicationDataVersion === null) {
      throw new Error("missing county scores publication data version");
    }

    const mappedRows = rows
      .filter((row) => isCountyReferenceAvailable(row))
      .map((row) => mapCountyScoreRow(row))
      .sort(compareCountyScores);

    return {
      ok: true,
      value: {
        blockedCountyIds: blockedCountyIds(mappedRows),
        dataVersion: publicationDataVersion,
        deferredCountyIds: deferredCountyIds(mappedRows),
        rows: mappedRows,
        missingCountyIds: missingCountyIds(requestedCountyIds, rows),
        requestedCountyIds,
      },
    };
  } catch (error) {
    return {
      ok: false,
      value: {
        reason: "mapping_failed",
        error,
      },
    };
  }
}

export async function queryCountyScoresStatus(args?: {
  readonly statusSnapshot?: CountyScoresStatusRow | undefined;
}): Promise<QueryCountyScoresStatusResult> {
  let row: CountyScoresStatusRow;
  try {
    row = args?.statusSnapshot ?? (await getCountyScoresStatusSnapshot());
  } catch (error) {
    if (isCountyScoresSourceUnavailable(error)) {
      return {
        ok: false,
        value: {
          reason: "source_unavailable",
          error,
        },
      };
    }

    return {
      ok: false,
      value: {
        reason: "query_failed",
        error,
      },
    };
  }

  try {
    return {
      ok: true,
      value: mapCountyScoresStatusRow(row),
    };
  } catch (error) {
    return {
      ok: false,
      value: {
        reason: "mapping_failed",
        error,
      },
    };
  }
}

export async function queryCountyScoresCoverage(): Promise<QueryCountyScoresCoverageResult> {
  const statusResult = await queryCountyScoresStatus();
  if (!statusResult.ok) {
    return {
      ok: false,
      value: statusResult.value,
    };
  }

  try {
    const [fieldRows, operatorRows] = await Promise.all([
      listCountyScoresCoverageFields(),
      listCountyScoresCoverageByOperator(),
    ]);

    return {
      ok: true,
      value: {
        publicationRunId: statusResult.value.publicationRunId,
        dataVersion: statusResult.value.dataVersion,
        rowCount: statusResult.value.rowCount,
        fields: fieldRows.map((row) => mapCountyScoresCoverageFieldRow(row)),
        byWholesaleOperator: operatorRows.map((row) => mapCountyScoresCoverageByOperatorRow(row)),
      },
    };
  } catch (error) {
    if (isCountyScoresSourceUnavailable(error)) {
      return {
        ok: false,
        value: {
          reason: "source_unavailable",
          error,
        },
      };
    }

    return {
      ok: false,
      value: {
        reason: "query_failed",
        error,
      },
    };
  }
}

export async function queryCountyScoresResolution(): Promise<QueryCountyScoresResolutionResult> {
  const statusResult = await queryCountyScoresStatus();
  if (!statusResult.ok) {
    return {
      ok: false,
      value: statusResult.value,
    };
  }

  try {
    const rows = await listCountyScoresResolutionBySource();
    const bySource = rows.map((row) => mapCountyScoresResolutionSourceRow(row));
    const firstRow = rows[0];

    return {
      ok: true,
      value: {
        publicationRunId: statusResult.value.publicationRunId,
        dataVersion: statusResult.value.dataVersion,
        effectiveDate:
          typeof firstRow === "undefined"
            ? null
            : readNullableIsoDate(firstRow.effective_date, "effective_date"),
        unresolvedProjectCount: bySource.reduce((sum, row) => sum + row.unresolvedProjects, 0),
        unresolvedSnapshotCount: bySource.reduce((sum, row) => sum + row.unresolvedSnapshots, 0),
        bySource,
      },
    };
  } catch (error) {
    if (isCountyScoresSourceUnavailable(error)) {
      return {
        ok: false,
        value: {
          reason: "source_unavailable",
          error,
        },
      };
    }

    return {
      ok: false,
      value: {
        reason: "query_failed",
        error,
      },
    };
  }
}

export async function queryCountyScoresDebug(
  args: QueryCountyScoresArgs
): Promise<QueryCountyScoresDebugResult> {
  const statusResult = await queryCountyScoresStatus();
  if (!statusResult.ok) {
    return {
      ok: false,
      value: statusResult.value,
    };
  }

  const countyScoresResult = await queryCountyScores(args);
  if (!countyScoresResult.ok) {
    return {
      ok: false,
      value: countyScoresResult.value,
    };
  }

  const requestedCountyIds = uniqueCountyIds(args.countyIds);

  try {
    const [operatorZoneRows, queueResolutionRows, queuePoiReferenceRows, congestionRows] =
      await Promise.all([
        listCountyOperatorZoneDebug(requestedCountyIds),
        listCountyQueueResolutionDebug(requestedCountyIds),
        listCountyQueuePoiReferenceDebug(requestedCountyIds),
        listCountyCongestionDebug(requestedCountyIds),
      ]);

    const scoreByCountyFips = new Map(
      countyScoresResult.value.rows.map((row) => [row.countyFips, row] as const)
    );
    const operatorZonesByCounty = new Map<string, CountyOperatorZoneDebug[]>();
    const queueResolutionsByCounty = new Map<string, CountyQueueResolutionDebug[]>();
    const queuePoiReferencesByCounty = new Map<string, CountyQueuePoiReferenceDebug[]>();
    const congestionByCounty = new Map<string, CountyCongestionSnapshotDebug>();

    for (const row of operatorZoneRows) {
      const mappedRow = mapCountyOperatorZoneDebugRow(row);
      const countyRows = operatorZonesByCounty.get(row.county_fips) ?? [];
      countyRows.push(mappedRow);
      operatorZonesByCounty.set(row.county_fips, countyRows);
    }

    for (const row of queueResolutionRows) {
      const mappedRow = mapCountyQueueResolutionDebugRow(row);
      const countyRows = queueResolutionsByCounty.get(row.county_fips) ?? [];
      countyRows.push(mappedRow);
      queueResolutionsByCounty.set(row.county_fips, countyRows);
    }

    for (const row of queuePoiReferenceRows) {
      const mappedRow = mapCountyQueuePoiReferenceDebugRow(row);
      const countyRows = queuePoiReferencesByCounty.get(row.county_fips) ?? [];
      countyRows.push(mappedRow);
      queuePoiReferencesByCounty.set(row.county_fips, countyRows);
    }

    for (const row of congestionRows) {
      congestionByCounty.set(row.county_fips, mapCountyCongestionDebugRow(row));
    }

    const counties: CountyScoresDebugCounty[] = requestedCountyIds.map((countyFips) => ({
      congestionSnapshot: congestionByCounty.get(countyFips) ?? null,
      countyFips,
      operatorZones: operatorZonesByCounty.get(countyFips) ?? [],
      queuePoiReferences: queuePoiReferencesByCounty.get(countyFips) ?? [],
      queueResolutions: queueResolutionsByCounty.get(countyFips) ?? [],
      score: scoreByCountyFips.get(countyFips) ?? null,
    }));

    return {
      ok: true,
      value: {
        publicationRunId: statusResult.value.publicationRunId,
        dataVersion: statusResult.value.dataVersion,
        counties,
      },
    };
  } catch (error) {
    if (isCountyScoresSourceUnavailable(error)) {
      return {
        ok: false,
        value: {
          reason: "source_unavailable",
          error,
        },
      };
    }

    return {
      ok: false,
      value: {
        reason: "query_failed",
        error,
      },
    };
  }
}
