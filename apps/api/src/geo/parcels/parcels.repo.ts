import {
  buildParcelDetailQuery,
  buildParcelLookupByIdsQuery,
  buildParcelsEnrichByBboxQuery,
  buildParcelsEnrichByCountyQuery,
  buildParcelsEnrichByPolygonQuery,
  type ParcelBboxFilter,
  type ParcelGeometryModeSql,
} from "@map-migration/geo-sql";
import { runQuery } from "../../db/postgres";

export interface ParcelRow {
  readonly attrs_json: unknown;
  readonly geoid: string | null | undefined;
  readonly geom_json: unknown;
  readonly ingestion_run_id: string | null | undefined;
  readonly parcel_id: string;
  readonly source_oid: number | string | null | undefined;
  readonly source_updated_at: Date | string | null | undefined;
  readonly state2: string | null | undefined;
}

interface ParcelEnrichQueryOptions {
  readonly cursor?: string | null;
  readonly includeGeometry: ParcelGeometryModeSql;
  readonly limit: number;
}

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
