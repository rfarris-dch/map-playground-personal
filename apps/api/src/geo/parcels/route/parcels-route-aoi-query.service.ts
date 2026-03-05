import type { ParcelAoi, ParcelGeometryMode } from "@map-migration/contracts";
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
  resolveTileSetPolygonGeometry,
} from "@/geo/parcels/route/parcels-route-policy.service";
import type { EnrichRowsResult } from "./parcels-route-aoi-query.service.types";

export type { EnrichRowsResult } from "./parcels-route-aoi-query.service.types";

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
      return {
        ok: false,
        response: rejectWithPolicyError(
          c,
          requestId,
          "bbox exceeds configured limits; zoom in or reduce AOI"
        ),
      };
    }

    return {
      ok: true,
      rows: await enrichParcelsByBbox(aoi.bbox, { includeGeometry, limit: queryLimit, cursor }),
    };
  }

  if (aoi.type === "tileSet") {
    if (aoi.tiles.length > PARCELS_MAX_TILESET_TILES) {
      return {
        ok: false,
        response: rejectWithPolicyError(c, requestId, "tileSet exceeds configured tile cap"),
      };
    }

    const tileSetGeometry = resolveTileSetPolygonGeometry(aoi);

    if (bboxExceedsLimits(tileSetGeometry.bbox)) {
      return {
        ok: false,
        response: rejectWithPolicyError(c, requestId, "tileSet AOI exceeds configured bbox limits"),
      };
    }

    if (tileSetGeometry.geometryText.length > PARCELS_MAX_POLYGON_JSON_CHARS) {
      return {
        ok: false,
        response: rejectWithPolicyError(c, requestId, "tileSet AOI payload is too large"),
      };
    }

    return {
      ok: true,
      rows: await enrichParcelsByPolygon(tileSetGeometry.geometryText, {
        includeGeometry,
        limit: queryLimit,
        cursor,
      }),
    };
  }

  if (aoi.type === "polygon") {
    const geometryText = JSON.stringify(aoi.geometry);
    if (geometryText.length > PARCELS_MAX_POLYGON_JSON_CHARS) {
      return {
        ok: false,
        response: rejectWithPolicyError(c, requestId, "polygon AOI payload is too large"),
      };
    }

    return {
      ok: true,
      rows: await enrichParcelsByPolygon(geometryText, {
        includeGeometry,
        limit: queryLimit,
        cursor,
      }),
    };
  }

  return {
    ok: true,
    rows: await enrichParcelsByCounty(aoi.geoid, { includeGeometry, limit: queryLimit, cursor }),
  };
}
