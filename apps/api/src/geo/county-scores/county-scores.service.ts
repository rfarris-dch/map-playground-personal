import type { CountyScore, CountyScoresStatusResponse } from "@map-migration/contracts";
import { mapCountyScoreRow } from "@/geo/county-scores/county-scores.mapper";
import type { CountyScoreRow, CountyScoresStatusRow } from "@/geo/county-scores/county-scores.repo";
import {
  getCountyScoresStatusSnapshot,
  listCountyScores,
} from "@/geo/county-scores/county-scores.repo";
import type {
  QueryCountyScoresArgs,
  QueryCountyScoresResult,
  QueryCountyScoresStatusResult,
} from "./county-scores.service.types";

const COUNTY_SCORES_RELATION_NAMES: readonly string[] = [
  "analytics.county_market_pressure_current",
  "analytics.dim_county",
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
      demand: hasFeature(availableFeatureFamilies, "demand"),
      gridFriction: hasFeature(availableFeatureFamilies, "grid_friction"),
      history: hasFeature(availableFeatureFamilies, "history"),
      infrastructure: hasFeature(availableFeatureFamilies, "infrastructure"),
      marketSeams: hasFeature(availableFeatureFamilies, "market_seams"),
      narratives: hasFeature(availableFeatureFamilies, "narratives"),
      policy: hasFeature(availableFeatureFamilies, "policy"),
      supplyTimeline: hasFeature(availableFeatureFamilies, "supply_timeline"),
    },
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
    [rows, statusRow] = await Promise.all([
      listCountyScores(requestedCountyIds),
      getCountyScoresStatusSnapshot(),
    ]);
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

export async function queryCountyScoresStatus(): Promise<QueryCountyScoresStatusResult> {
  let row: CountyScoresStatusRow;
  try {
    row = await getCountyScoresStatusSnapshot();
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
