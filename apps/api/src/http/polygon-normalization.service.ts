import type { Warning } from "@map-migration/geo-kernel/warning";
import { runQuery } from "@/db/postgres";

interface PolygonNormalizationRow {
  readonly invalid_reason_before_repair: string | null;
  readonly is_empty_after_repair: boolean;
  readonly is_valid_after_repair: boolean;
  readonly is_valid_before_repair: boolean;
  readonly normalized_geometry_text: string | null;
}

export interface NormalizedPolygonGeometry {
  readonly geometryText: string;
  readonly invalidReason: string | null;
  readonly wasRepaired: boolean;
}

export async function normalizePolygonGeometryGeoJson(
  geometryText: string
): Promise<NormalizedPolygonGeometry> {
  const rows = await runQuery<PolygonNormalizationRow>(
    `
WITH input AS (
  SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom_4326_raw
),
repair AS (
  SELECT
    ST_IsValid(geom_4326_raw) AS is_valid_before_repair,
    NULLIF(ST_IsValidReason(geom_4326_raw), 'Valid Geometry') AS invalid_reason_before_repair,
    ST_CollectionExtract(ST_MakeValid(geom_4326_raw), 3) AS repaired_geom_4326
  FROM input
)
SELECT
  is_valid_before_repair,
  invalid_reason_before_repair,
  ST_IsValid(repaired_geom_4326) AS is_valid_after_repair,
  ST_IsEmpty(repaired_geom_4326) AS is_empty_after_repair,
  ST_AsGeoJSON(repaired_geom_4326)::text AS normalized_geometry_text
FROM repair;
`,
    [geometryText]
  );

  const row = rows[0];
  if (typeof row === "undefined") {
    throw new Error("polygon geometry normalization returned no rows");
  }

  if (!row.is_valid_after_repair || row.is_empty_after_repair) {
    const invalidReason =
      typeof row.invalid_reason_before_repair === "string" &&
      row.invalid_reason_before_repair.trim().length > 0
        ? row.invalid_reason_before_repair.trim()
        : "polygon geometry could not be repaired into a valid polygon";
    throw new Error(invalidReason);
  }

  const normalizedGeometryText = row.normalized_geometry_text?.trim();
  if (typeof normalizedGeometryText !== "string" || normalizedGeometryText.length === 0) {
    throw new Error("polygon geometry normalization did not produce GeoJSON");
  }

  return {
    geometryText: normalizedGeometryText,
    invalidReason:
      typeof row.invalid_reason_before_repair === "string" &&
      row.invalid_reason_before_repair.trim().length > 0
        ? row.invalid_reason_before_repair.trim()
        : null,
    wasRepaired: !row.is_valid_before_repair,
  };
}

export function buildPolygonRepairWarning(scope: string, invalidReason: string | null): Warning {
  const reasonSuffix = invalidReason === null ? "" : ` (${invalidReason})`;

  return {
    code: "POLYGON_GEOMETRY_REPAIRED",
    message: `${scope} polygon was repaired before spatial query execution${reasonSuffix}`,
  };
}
