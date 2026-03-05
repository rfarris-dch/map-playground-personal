import {
  buildParcelDetailQuery,
  buildParcelLookupByIdsQuery,
  buildParcelsEnrichByBboxQuery,
  buildParcelsEnrichByCountyQuery,
  buildParcelsEnrichByPolygonQuery,
  type ParcelBboxFilter,
  type ParcelEnrichQueryOptions,
  type ParcelGeometryModeSql,
} from "@map-migration/geo-sql";
import { runQuery } from "@/db/postgres";
import type { ParcelRow } from "./parcels.repo.types";

export type { ParcelRow } from "./parcels.repo.types";

export function getParcelById(
  parcelId: string,
  includeGeometry: ParcelGeometryModeSql
): Promise<ParcelRow[]> {
  const query = buildParcelDetailQuery(parcelId, includeGeometry);
  return runQuery<ParcelRow>(query.sql, query.params);
}

export function lookupParcelsByIds(
  parcelIds: readonly string[],
  includeGeometry: ParcelGeometryModeSql
): Promise<ParcelRow[]> {
  const query = buildParcelLookupByIdsQuery(parcelIds, includeGeometry);
  return runQuery<ParcelRow>(query.sql, query.params);
}

export function enrichParcelsByBbox(
  bbox: ParcelBboxFilter,
  options: ParcelEnrichQueryOptions
): Promise<ParcelRow[]> {
  const query = buildParcelsEnrichByBboxQuery(bbox, options);
  return runQuery<ParcelRow>(query.sql, query.params);
}

export function enrichParcelsByPolygon(
  geometryGeoJson: string,
  options: ParcelEnrichQueryOptions
): Promise<ParcelRow[]> {
  const query = buildParcelsEnrichByPolygonQuery(geometryGeoJson, options);
  return runQuery<ParcelRow>(query.sql, query.params);
}

export function enrichParcelsByCounty(
  geoid: string,
  options: ParcelEnrichQueryOptions
): Promise<ParcelRow[]> {
  const query = buildParcelsEnrichByCountyQuery(geoid, options);
  return runQuery<ParcelRow>(query.sql, query.params);
}
