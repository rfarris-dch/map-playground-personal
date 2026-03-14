import type { AreaOfInterest } from "@map-migration/geo-kernel/area-of-interest";
import type { Warning } from "@map-migration/geo-kernel/warning";
import type { ParcelGeometryMode } from "@map-migration/http-contracts/parcels-http";
import {
  enrichParcelsByBbox,
  enrichParcelsByCounty,
  enrichParcelsByPolygon,
} from "@/geo/parcels/parcels.repo";
import {
  bboxExceedsLimits,
  PARCELS_MAX_POLYGON_JSON_CHARS,
  PARCELS_MAX_TILESET_TILES,
  resolvePolygonGeometry,
  resolveTileSetPolygonGeometry,
} from "@/geo/parcels/parcels-policy.service";
import {
  buildPolygonRepairWarning,
  normalizePolygonGeometryGeoJson,
} from "@/http/polygon-normalization.service";
import type { EnrichRowsResult } from "./parcels-route-aoi-query.service.types";

export type { EnrichRowsResult } from "./parcels-route-aoi-query.service.types";

interface AoiQueryArgs {
  readonly cursor: string | null;
  readonly includeGeometry: ParcelGeometryMode;
  readonly queryLimit: number;
}

interface AoiStrategy {
  readonly query: (aoi: AreaOfInterest, args: AoiQueryArgs) => Promise<EnrichRowsResult>;
  readonly validate: (aoi: AreaOfInterest) => string | null;
}

function policyRejected(
  message: string,
  error?: unknown
): Extract<EnrichRowsResult, { ok: false }> {
  return {
    ok: false,
    value: {
      error: error ?? new Error(message),
      message,
      reason: "policy_rejected",
    },
  };
}

function queryFailed(error: unknown): Extract<EnrichRowsResult, { ok: false }> {
  return {
    ok: false,
    value: {
      error,
      message: "parcel query failed",
      reason: "query_failed",
    },
  };
}

async function normalizePolygonGeometry(args: {
  readonly geometryText: string;
  readonly scope: "polygon AOI" | "tileSet AOI";
}): Promise<
  | {
      readonly ok: true;
      readonly geometryText: string;
      readonly warnings: readonly Warning[];
    }
  | Extract<EnrichRowsResult, { ok: false }>
> {
  try {
    const normalizedGeometry = await normalizePolygonGeometryGeoJson(args.geometryText);

    return {
      ok: true,
      geometryText: normalizedGeometry.geometryText,
      warnings: normalizedGeometry.wasRepaired
        ? [buildPolygonRepairWarning(args.scope, normalizedGeometry.invalidReason)]
        : [],
    };
  } catch (error) {
    return policyRejected(
      error instanceof Error
        ? `${args.scope} is invalid after repair: ${error.message}`
        : `${args.scope} is invalid after repair`,
      error
    );
  }
}

async function queryPolygonRows(args: {
  readonly cursor: string | null;
  readonly geometryText: string;
  readonly includeGeometry: ParcelGeometryMode;
  readonly queryLimit: number;
  readonly scope: "polygon AOI" | "tileSet AOI";
}): Promise<EnrichRowsResult> {
  const normalizedGeometry = await normalizePolygonGeometry({
    geometryText: args.geometryText,
    scope: args.scope,
  });
  if (!normalizedGeometry.ok) {
    return normalizedGeometry;
  }

  try {
    return {
      ok: true,
      rows: await enrichParcelsByPolygon(normalizedGeometry.geometryText, {
        includeGeometry: args.includeGeometry,
        limit: args.queryLimit,
        cursor: args.cursor,
      }),
      warnings: normalizedGeometry.warnings,
    };
  } catch (error) {
    return queryFailed(error);
  }
}

const bboxAoiStrategy: AoiStrategy = {
  query: async (aoi, args) => {
    if (aoi.type !== "bbox") {
      return policyRejected("bbox AOI is invalid");
    }

    try {
      return {
        ok: true,
        rows: await enrichParcelsByBbox(aoi.bbox, {
          includeGeometry: args.includeGeometry,
          limit: args.queryLimit,
          cursor: args.cursor,
        }),
        warnings: [],
      };
    } catch (error) {
      return queryFailed(error);
    }
  },
  validate: (aoi) => {
    if (aoi.type !== "bbox") {
      return "bbox AOI is invalid";
    }

    return bboxExceedsLimits(aoi.bbox)
      ? "bbox exceeds configured limits; zoom in or reduce AOI"
      : null;
  },
};

const countyAoiStrategy: AoiStrategy = {
  query: async (aoi, args) => {
    if (aoi.type !== "county") {
      return policyRejected("county AOI is invalid");
    }

    try {
      return {
        ok: true,
        rows: await enrichParcelsByCounty(aoi.geoid, {
          includeGeometry: args.includeGeometry,
          limit: args.queryLimit,
          cursor: args.cursor,
        }),
        warnings: [],
      };
    } catch (error) {
      return queryFailed(error);
    }
  },
  validate: () => null,
};

const polygonAoiStrategy: AoiStrategy = {
  query: (aoi, args) => {
    if (aoi.type !== "polygon") {
      return Promise.resolve(policyRejected("polygon AOI is invalid"));
    }

    const polygonGeometry = resolvePolygonGeometry(aoi);
    return queryPolygonRows({
      cursor: args.cursor,
      geometryText: polygonGeometry.geometryText,
      includeGeometry: args.includeGeometry,
      queryLimit: args.queryLimit,
      scope: "polygon AOI",
    });
  },
  validate: (aoi) => {
    if (aoi.type !== "polygon") {
      return "polygon AOI is invalid";
    }

    const polygonGeometry = resolvePolygonGeometry(aoi);
    if (bboxExceedsLimits(polygonGeometry.bbox)) {
      return "polygon AOI exceeds configured bbox limits";
    }

    return polygonGeometry.geometryText.length > PARCELS_MAX_POLYGON_JSON_CHARS
      ? "polygon AOI payload is too large"
      : null;
  },
};

const tileSetAoiStrategy: AoiStrategy = {
  query: (aoi, args) => {
    if (aoi.type !== "tileSet") {
      return Promise.resolve(policyRejected("tileSet AOI is invalid"));
    }

    const tileSetGeometry = resolveTileSetPolygonGeometry(aoi);
    return queryPolygonRows({
      cursor: args.cursor,
      geometryText: tileSetGeometry.geometryText,
      includeGeometry: args.includeGeometry,
      queryLimit: args.queryLimit,
      scope: "tileSet AOI",
    });
  },
  validate: (aoi) => {
    if (aoi.type !== "tileSet") {
      return "tileSet AOI is invalid";
    }

    if (aoi.tiles.length > PARCELS_MAX_TILESET_TILES) {
      return "tileSet exceeds configured tile cap";
    }

    const tileSetGeometry = resolveTileSetPolygonGeometry(aoi);
    if (bboxExceedsLimits(tileSetGeometry.bbox)) {
      return "tileSet AOI exceeds configured bbox limits";
    }

    return tileSetGeometry.geometryText.length > PARCELS_MAX_POLYGON_JSON_CHARS
      ? "tileSet AOI payload is too large"
      : null;
  },
};

const aoiStrategies: Record<AreaOfInterest["type"], AoiStrategy> = {
  bbox: bboxAoiStrategy,
  county: countyAoiStrategy,
  polygon: polygonAoiStrategy,
  tileSet: tileSetAoiStrategy,
};

export function queryEnrichRowsByAoi(
  aoi: AreaOfInterest,
  includeGeometry: ParcelGeometryMode,
  queryLimit: number,
  cursor: string | null
): Promise<EnrichRowsResult> {
  const strategy = aoiStrategies[aoi.type];
  const validationMessage = strategy.validate(aoi);
  if (validationMessage !== null) {
    return Promise.resolve(policyRejected(validationMessage));
  }

  return strategy.query(aoi, {
    cursor,
    includeGeometry,
    queryLimit,
  });
}
