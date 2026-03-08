import type { CountyScore } from "@map-migration/contracts";
import type { CountyScoreRow } from "./county-scores.repo";

const COUNTY_FIPS_PATTERN = /^[0-9]{5}$/;

function readCountyFips(value: string): string {
  const normalized = value.trim();
  if (!COUNTY_FIPS_PATTERN.test(normalized)) {
    throw new Error(`invalid county_fips: ${value}`);
  }

  return normalized;
}

function readNullableText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readNullableStateAbbrev(value: string | null | undefined): string | null {
  const normalized = readNullableText(value);
  if (normalized === null) {
    return null;
  }

  return normalized.length === 2 ? normalized : null;
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

function readBooleanFlag(
  value: boolean | number | string | null | undefined,
  fieldName: string
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }

    throw new Error(`invalid ${fieldName}`);
  }

  if (typeof value !== "string") {
    throw new Error(`missing ${fieldName}`);
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "t" || normalized === "1") {
    return true;
  }

  if (normalized === "false" || normalized === "f" || normalized === "0") {
    return false;
  }

  throw new Error(`invalid ${fieldName}`);
}

function readNullableVersion(
  value: number | string | null | undefined,
  fieldName: string
): string | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`invalid ${fieldName}`);
    }

    return String(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

export function mapCountyScoreRow(row: CountyScoreRow): CountyScore {
  const hasCountyScore = readBooleanFlag(row.has_county_score, "has_county_score");

  return {
    countyFips: readCountyFips(row.county_fips),
    countyName: readNullableText(row.county_name),
    stateAbbrev: readNullableStateAbbrev(row.state_abbrev),
    scoreStatus: hasCountyScore ? "scored" : "unavailable",
    compositeScore: readNullableNumber(row.composite_score),
    demandScore: readNullableNumber(row.demand_score),
    generationScore: readNullableNumber(row.generation_score),
    policyScore: readNullableNumber(row.policy_score),
    formulaVersion: readNullableVersion(row.formula_version, "formula_version"),
    inputDataVersion: readNullableVersion(row.input_data_version, "input_data_version"),
  };
}
