import type { ParcelAoi, ParcelGeometryMode, Warning } from "@map-migration/contracts";
import type { Context } from "hono";
import {
  enrichParcelsByBbox,
  enrichParcelsByCounty,
  enrichParcelsByPolygon,
} from "@/geo/parcels/parcels.repo";
import { rejectWithPolicyError } from "@/geo/parcels/route/parcels-route-errors.service";
import {
  bboxExceedsLimits,
  PARCELS_MAX_POLYGON_JSON_CHARS,
  PARCELS_MAX_TILESET_TILES,
  resolvePolygonGeometry,
  resolveTileSetPolygonGeometry,
} from "@/geo/parcels/route/parcels-route-policy.service";
import {
  buildPolygonRepairWarning,
  normalizePolygonGeometryGeoJson,
} from "@/http/polygon-normalization.service";
import type { EnrichRowsResult } from "./parcels-route-aoi-query.service.types";

export type { EnrichRowsResult } from "./parcels-route-aoi-query.service.types";

async function normalizePolygonAoi(args: {
  readonly c: Context;
  readonly requestId: string;
  readonly scope: "polygon AOI" | "tileSet AOI";
  readonly geometryText: string;
}): Promise<
  | {
      readonly ok: true;
      readonly geometryText: string;
      readonly warnings: readonly Warning[];
    }
  | {
      readonly ok: false;
      readonly response: Response;
    }
> {
  const warnings: Warning[] = [];

  try {
    const normalizedGeometry = await normalizePolygonGeometryGeoJson(args.geometryText);
    if (normalizedGeometry.wasRepaired) {
      warnings.push(buildPolygonRepairWarning(args.scope, normalizedGeometry.invalidReason));
    }

    return {
      ok: true,
      geometryText: normalizedGeometry.geometryText,
      warnings,
    };
  } catch (error) {
    return {
      ok: false,
      response: rejectWithPolicyError(
        args.c,
        args.requestId,
        error instanceof Error
          ? `${args.scope} is invalid after repair: ${error.message}`
          : `${args.scope} is invalid after repair`
      ),
    };
  }
}

async function queryPolygonRows(args: {
  readonly c: Context;
  readonly requestId: string;
  readonly scope: "polygon AOI" | "tileSet AOI";
  readonly geometryText: string;
  readonly includeGeometry: ParcelGeometryMode;
  readonly queryLimit: number;
  readonly cursor: string | null;
}): Promise<EnrichRowsResult> {
  const normalizedGeometry = await normalizePolygonAoi({
    c: args.c,
    requestId: args.requestId,
    scope: args.scope,
    geometryText: args.geometryText,
  });
  if (!normalizedGeometry.ok) {
    return normalizedGeometry;
  }

  return {
    ok: true,
    rows: await enrichParcelsByPolygon(normalizedGeometry.geometryText, {
      includeGeometry: args.includeGeometry,
      limit: args.queryLimit,
      cursor: args.cursor,
    }),
    warnings: normalizedGeometry.warnings,
  };
}

function rejectPolygonPolicy(args: {
  readonly c: Context;
  readonly requestId: string;
  readonly message: string;
}): EnrichRowsResult {
  return {
    ok: false,
    response: rejectWithPolicyError(args.c, args.requestId, args.message),
  };
}

export async function queryEnrichRowsByAoi(
  c: Context,
  requestId: string,
  aoi: ParcelAoi,
  includeGeometry: ParcelGeometryMode,
  queryLimit: number,
  cursor: string | null
): Promise<EnrichRowsResult> {
  if (aoi.type === "bbox") {
    if (bboxExceedsLimits(aoi.bbox)) {
      return rejectPolygonPolicy({
        c,
        requestId,
        message: "bbox exceeds configured limits; zoom in or reduce AOI",
      });
    }

    return {
      ok: true,
      rows: await enrichParcelsByBbox(aoi.bbox, { includeGeometry, limit: queryLimit, cursor }),
      warnings: [],
    };
  }

  if (aoi.type === "tileSet") {
    if (aoi.tiles.length > PARCELS_MAX_TILESET_TILES) {
      return rejectPolygonPolicy({
        c,
        requestId,
        message: "tileSet exceeds configured tile cap",
      });
    }

    const tileSetGeometry = resolveTileSetPolygonGeometry(aoi);

    if (bboxExceedsLimits(tileSetGeometry.bbox)) {
      return rejectPolygonPolicy({
        c,
        requestId,
        message: "tileSet AOI exceeds configured bbox limits",
      });
    }

    if (tileSetGeometry.geometryText.length > PARCELS_MAX_POLYGON_JSON_CHARS) {
      return rejectPolygonPolicy({
        c,
        requestId,
        message: "tileSet AOI payload is too large",
      });
    }

    return queryPolygonRows({
      c,
      requestId,
      scope: "tileSet AOI",
      geometryText: tileSetGeometry.geometryText,
      includeGeometry,
      queryLimit,
      cursor,
    });
  }

  if (aoi.type === "polygon") {
    const polygonGeometry = resolvePolygonGeometry(aoi);

    if (bboxExceedsLimits(polygonGeometry.bbox)) {
      return rejectPolygonPolicy({
        c,
        requestId,
        message: "polygon AOI exceeds configured bbox limits",
      });
    }

    if (polygonGeometry.geometryText.length > PARCELS_MAX_POLYGON_JSON_CHARS) {
      return rejectPolygonPolicy({
        c,
        requestId,
        message: "polygon AOI payload is too large",
      });
    }

    return queryPolygonRows({
      c,
      requestId,
      scope: "polygon AOI",
      geometryText: polygonGeometry.geometryText,
      includeGeometry,
      queryLimit,
      cursor,
    });
  }

  return {
    ok: true,
    rows: await enrichParcelsByCounty(aoi.geoid, { includeGeometry, limit: queryLimit, cursor }),
    warnings: [],
  };
}
