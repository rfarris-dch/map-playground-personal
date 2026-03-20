import { runQuery } from "@/db/postgres";
import type { AreaHistoryCoverageRow, AreaHistoryPointRow } from "./analysis-history.repo.types";

export function queryAreaHistoryPoints(args: {
  readonly geometryText: string;
  readonly periodLimit: number;
  readonly perspectives: readonly string[];
}): Promise<readonly AreaHistoryPointRow[]> {
  const includeColo = args.perspectives.includes("colo") ? 1 : 0;
  const includeHyperscale = args.perspectives.includes("hyperscale") ? 1 : 0;

  return runQuery<AreaHistoryPointRow>(
    `
WITH aoi AS (
  SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom_4326
),
source_rows AS (
  SELECT history.*
  FROM aoi
  CROSS JOIN LATERAL serve.area_capacity_quarterly_current_geometry(aoi.geom_4326, false) AS history
  WHERE (
    ($2 = 1 AND history.perspective = 'colo')
    OR ($3 = 1 AND history.perspective = 'hyperscale')
  )
),
aggregated AS (
  SELECT
    source_rows.period_id,
    source_rows.period_label,
    source_rows.year_num,
    source_rows.quarter_num,
    COALESCE(
      SUM(CASE WHEN source_rows.perspective = 'colo' THEN source_rows.commissioned_mw ELSE 0 END),
      0
    ) AS colocation_commissioned_mw,
    COALESCE(
      SUM(CASE WHEN source_rows.perspective = 'colo' THEN source_rows.available_mw ELSE 0 END),
      0
    ) AS colocation_available_mw,
    COALESCE(
      SUM(
        CASE
          WHEN source_rows.perspective = 'colo' THEN source_rows.under_construction_mw
          ELSE 0
        END
      ),
      0
    ) AS colocation_under_construction_mw,
    COALESCE(
      SUM(CASE WHEN source_rows.perspective = 'colo' THEN source_rows.planned_mw ELSE 0 END),
      0
    ) AS colocation_planned_mw,
    COALESCE(
      SUM(
        CASE
          WHEN source_rows.perspective = 'hyperscale' THEN source_rows.commissioned_mw
          ELSE 0
        END
      ),
      0
    ) AS hyperscale_owned_mw,
    COALESCE(
      SUM(
        CASE
          WHEN source_rows.perspective = 'hyperscale' THEN source_rows.under_construction_mw
          ELSE 0
        END
      ),
      0
    ) AS hyperscale_under_construction_mw,
    COALESCE(
      SUM(CASE WHEN source_rows.perspective = 'hyperscale' THEN source_rows.planned_mw ELSE 0 END),
      0
    ) AS hyperscale_planned_mw,
    COALESCE(
      SUM(
        CASE
          WHEN source_rows.perspective IN ('colo', 'hyperscale') THEN source_rows.commissioned_mw
          ELSE 0
        END
      ),
      0
    ) AS total_market_size_mw,
    COALESCE(SUM(source_rows.facility_count), 0)::integer AS facility_count
  FROM source_rows
  GROUP BY
    source_rows.period_id,
    source_rows.period_label,
    source_rows.year_num,
    source_rows.quarter_num
),
limited AS (
  SELECT *
  FROM aggregated
  ORDER BY year_num DESC, quarter_num DESC
  LIMIT $4
)
SELECT
  period_id,
  period_label,
  year_num,
  quarter_num,
  colocation_commissioned_mw,
  colocation_available_mw,
  colocation_under_construction_mw,
  colocation_planned_mw,
  hyperscale_owned_mw,
  hyperscale_under_construction_mw,
  hyperscale_planned_mw,
  total_market_size_mw,
  facility_count
FROM limited
ORDER BY year_num, quarter_num;
`,
    [args.geometryText, includeColo, includeHyperscale, args.periodLimit]
  );
}

export async function queryAreaHistoryCoverage(args: {
  readonly geometryText: string;
  readonly perspectives: readonly string[];
}): Promise<AreaHistoryCoverageRow | null> {
  const includeColo = args.perspectives.includes("colo") ? 1 : 0;
  const includeHyperscale = args.perspectives.includes("hyperscale") ? 1 : 0;

  const rows = await runQuery<AreaHistoryCoverageRow>(
    `
WITH aoi AS (
  SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom_4326
),
selected_facilities AS (
  SELECT
    facility.facility_id,
    facility.facility_kind
  FROM canon.dim_facility AS facility
  CROSS JOIN aoi
  WHERE facility.current_geom IS NOT NULL
    AND facility.current_geom && aoi.geom_4326
    AND ST_Intersects(facility.current_geom, aoi.geom_4326)
    AND (
      ($2 = 1 AND facility.facility_kind = 'colo')
      OR ($3 = 1 AND facility.facility_kind = 'hyperscale')
    )
),
history_facilities AS (
  SELECT DISTINCT
    history.facility_id,
    history.perspective
  FROM serve.facility_capacity_quarterly_live AS history
  CROSS JOIN aoi
  WHERE history.current_geom IS NOT NULL
    AND history.current_geom && aoi.geom_4326
    AND ST_Intersects(history.current_geom, aoi.geom_4326)
    AND (
      ($2 = 1 AND history.perspective = 'colo')
      OR ($3 = 1 AND history.perspective = 'hyperscale')
    )
),
selected_markets AS (
  SELECT COUNT(DISTINCT facility.current_market_id)::integer AS selected_market_count
  FROM canon.dim_facility AS facility
  CROSS JOIN aoi
  WHERE facility.current_geom IS NOT NULL
    AND facility.current_market_id IS NOT NULL
    AND facility.current_geom && aoi.geom_4326
    AND ST_Intersects(facility.current_geom, aoi.geom_4326)
    AND (
      ($2 = 1 AND facility.facility_kind = 'colo')
      OR ($3 = 1 AND facility.facility_kind = 'hyperscale')
    )
)
SELECT
  COUNT(*)::integer AS selected_facility_count,
  COUNT(*) FILTER (WHERE selected_facilities.facility_kind = 'colo')::integer
    AS selected_colocation_facility_count,
  COUNT(*) FILTER (WHERE selected_facilities.facility_kind = 'hyperscale')::integer
    AS selected_hyperscale_facility_count,
  COALESCE((SELECT COUNT(*)::integer FROM history_facilities), 0) AS included_facility_count,
  COALESCE(
    (SELECT COUNT(*)::integer FROM history_facilities WHERE perspective = 'colo'),
    0
  ) AS included_colocation_facility_count,
  COALESCE(
    (SELECT COUNT(*)::integer FROM history_facilities WHERE perspective = 'hyperscale'),
    0
  ) AS included_hyperscale_facility_count,
  COALESCE((SELECT selected_market_count FROM selected_markets), 0) AS selected_market_count
FROM selected_facilities;
`,
    [args.geometryText, includeColo, includeHyperscale]
  );

  return rows[0] ?? null;
}
