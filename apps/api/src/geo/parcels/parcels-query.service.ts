import { mapParcelRowsToFeatures, mapParcelRowToFeature } from "@/geo/parcels/parcels.mapper";
import { getParcelById, lookupParcelsByIds } from "@/geo/parcels/parcels.repo";
import { queryEnrichRowsByAoi } from "@/geo/parcels/route/parcels-route-aoi-query.service";
import type {
  LookupParcelFeaturesArgs,
  QueryParcelDetailArgs,
  QueryParcelDetailResult,
  QueryParcelFeaturesByAoiArgs,
  QueryParcelFeaturesResult,
} from "./parcels-query.service.types";

export type {
  LookupParcelFeaturesArgs,
  QueryParcelDetailArgs,
  QueryParcelDetailResult,
  QueryParcelFeaturesByAoiArgs,
  QueryParcelFeaturesResult,
} from "./parcels-query.service.types";

export async function queryParcelDetailFeature(
  args: QueryParcelDetailArgs
): Promise<QueryParcelDetailResult> {
  const rowsResult = getParcelById(args.parcelId, args.includeGeometry);
  let rows: Awaited<typeof rowsResult>;
  try {
    rows = await rowsResult;
  } catch (error) {
    return {
      ok: false,
      value: {
        error,
        reason: "query_failed",
      },
    };
  }

  const row = rows[0];
  if (typeof row === "undefined") {
    return {
      ok: false,
      value: {
        error: new Error("parcel not found"),
        reason: "not_found",
      },
    };
  }

  try {
    const feature = mapParcelRowToFeature(row);
    if (feature === null) {
      return {
        ok: false,
        value: {
          error: new Error("parcel mapping failed"),
          reason: "mapping_failed",
        },
      };
    }

    return {
      ok: true,
      value: {
        feature,
      },
    };
  } catch (error) {
    return {
      ok: false,
      value: {
        error,
        reason: "mapping_failed",
      },
    };
  }
}

export async function lookupParcelFeatures(
  args: LookupParcelFeaturesArgs
): Promise<QueryParcelFeaturesResult> {
  const rowsResult = lookupParcelsByIds(args.parcelIds, args.includeGeometry);
  let rows: Awaited<typeof rowsResult>;
  try {
    rows = await rowsResult;
  } catch (error) {
    return {
      ok: false,
      value: {
        error,
        message: "parcel query failed",
        reason: "query_failed",
      },
    };
  }

  try {
    return {
      ok: true,
      value: {
        features: mapParcelRowsToFeatures(rows),
        warnings: [],
      },
    };
  } catch (error) {
    return {
      ok: false,
      value: {
        error,
        message: "parcel mapping failed",
        reason: "mapping_failed",
      },
    };
  }
}

export async function queryParcelFeaturesByAoi(
  args: QueryParcelFeaturesByAoiArgs
): Promise<QueryParcelFeaturesResult> {
  const rowsResult = await queryEnrichRowsByAoi(
    args.aoi,
    args.includeGeometry,
    args.queryLimit,
    args.cursor
  );
  if (!rowsResult.ok) {
    return rowsResult;
  }

  try {
    return {
      ok: true,
      value: {
        features: mapParcelRowsToFeatures(rowsResult.rows),
        warnings: rowsResult.warnings,
      },
    };
  } catch (error) {
    return {
      ok: false,
      value: {
        error,
        message: "parcel mapping failed",
        reason: "mapping_failed",
      },
    };
  }
}
