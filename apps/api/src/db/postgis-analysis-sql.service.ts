import { parsePositiveIntFlag } from "@/config/env-parsing.service";

export const SPATIAL_ANALYTICS_EQUAL_AREA_SRID = parsePositiveIntFlag(
  process.env.SPATIAL_ANALYTICS_EQUAL_AREA_SRID,
  5070
);

export function equalAreaTransformSql(geometrySql: string): string {
  return `ST_Transform(${geometrySql}, ${String(SPATIAL_ANALYTICS_EQUAL_AREA_SRID)})`;
}

export function equalAreaSqKmSql(geometrySql: string): string {
  return `ST_Area(${equalAreaTransformSql(geometrySql)}) / 1000000.0`;
}
