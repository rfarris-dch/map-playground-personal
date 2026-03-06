import type { ParcelFieldReader } from "@/features/spatial-analysis/spatial-analysis-parcels.service.types";
import type { SpatialAnalysisParcelRecord } from "@/features/spatial-analysis/spatial-analysis-parcels.types";

export const SPATIAL_ANALYSIS_PARCEL_FOCUS_FIELDS: readonly string[] = [
  "address",
  "scity",
  "county",
  "state2",
  "szip",
  "lat",
  "lon",
  "parcelnumb",
  "tax_id",
  "ll_gisacre",
  "struct",
  "ll_bldg_count",
  "ll_bldg_footprint_sqft",
  "highest_parcel_elevation",
  "lowest_parcel_elevation",
  "roughness_rating",
  "zoning",
  "zoning_code_link",
  "zoning_type",
  "zoning_subtype",
  "fema_flood_zone",
  "fema_flood_zone_subtype",
  "landval",
  "parval",
  "taxamt",
  "taxyear",
  "transmission_line_distance",
  "population_density",
  "population_growth_next_5_years",
  "population_growth_past_5_years",
  "owner",
  "saledate",
  "saleprice",
];

function formatUnknownValue(value: unknown): string {
  if (value === null || typeof value === "undefined") {
    return "-";
  }

  if (typeof value === "string") {
    return value.length > 0 ? value : "-";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "-";
    }

    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "[invalid]";
  }
}

function readParcelState(parcel: SpatialAnalysisParcelRecord): string {
  return parcel.state2 ?? "-";
}

function readParcelNumber(parcel: SpatialAnalysisParcelRecord): string {
  const attrParcelNumber = parcel.attrs.parcelnumb;
  if (typeof attrParcelNumber === "string" && attrParcelNumber.length > 0) {
    return attrParcelNumber;
  }

  return parcel.parcelId;
}

function readParcelLatitude(parcel: SpatialAnalysisParcelRecord): string {
  const latFromAttrs = parcel.attrs.lat;
  if (typeof latFromAttrs === "number" && Number.isFinite(latFromAttrs)) {
    return String(latFromAttrs);
  }

  if (parcel.coordinates === null) {
    return "-";
  }

  return String(parcel.coordinates[1]);
}

function readParcelLongitude(parcel: SpatialAnalysisParcelRecord): string {
  const lonFromAttrs = parcel.attrs.lon;
  if (typeof lonFromAttrs === "number" && Number.isFinite(lonFromAttrs)) {
    return String(lonFromAttrs);
  }

  if (parcel.coordinates === null) {
    return "-";
  }

  return String(parcel.coordinates[0]);
}

function readParcelCounty(parcel: SpatialAnalysisParcelRecord): string {
  const countyText = formatUnknownValue(parcel.attrs.county);
  if (countyText !== "-") {
    return countyText;
  }

  return parcel.geoid ?? "-";
}

const SPECIAL_PARCEL_FIELD_READERS = new Map<string, ParcelFieldReader>([
  ["state2", readParcelState],
  ["parcelnumb", readParcelNumber],
  ["lat", readParcelLatitude],
  ["lon", readParcelLongitude],
  ["county", readParcelCounty],
]);

export function spatialAnalysisParcelFieldValue(
  parcel: SpatialAnalysisParcelRecord,
  field: string
): string {
  const fieldReader = SPECIAL_PARCEL_FIELD_READERS.get(field);
  if (typeof fieldReader === "function") {
    return fieldReader(parcel);
  }

  return formatUnknownValue(parcel.attrs[field]);
}
