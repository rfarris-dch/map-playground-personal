import {
  ApiDefaults,
  ApiHeaders,
  ApiRoutes,
  type FacilitiesDetailResponse,
  FacilitiesDetailResponseSchema,
  type FacilitiesFeatureCollection,
  FacilitiesFeatureCollectionSchema,
  type FacilityPerspective,
  parseBboxParam,
  parseFacilityPerspectiveParam,
  type ResponseMeta,
} from "@map-migration/contracts";
import { createRequestId } from "@map-migration/ops";
import type { Hono } from "hono";
import { mapFacilitiesRowsToFeatures, mapFacilityDetailRowToFeature } from "./facilities.mapper";
import {
  type FacilitiesBboxRow,
  type FacilityDetailRow,
  getFacilitiesBboxMaxRows,
  getFacilityById,
  listFacilitiesByBbox,
} from "./facilities.repo";

function clampLimit(raw: string | undefined, max: number, defaultValue: number): number {
  if (!raw) {
    return defaultValue;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return defaultValue;
  }

  return Math.min(Math.floor(value), max);
}

function defaultFacilityPerspective(): FacilityPerspective {
  return "colocation";
}

function resolvePerspectiveParam(
  value: string | undefined
):
  | {
      readonly ok: true;
      readonly perspective: FacilityPerspective;
    }
  | {
      readonly ok: false;
      readonly error: string;
    } {
  const parsed = parseFacilityPerspectiveParam(value);
  if (parsed !== null) {
    return {
      ok: true,
      perspective: parsed,
    };
  }

  if (typeof value !== "undefined") {
    return {
      ok: false,
      error: "perspective query param must be one of: colocation, hyperscale",
    };
  }

  return {
    ok: true,
    perspective: defaultFacilityPerspective(),
  };
}

function toDebugDetails(error: unknown): string | undefined {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  return String(error);
}

function buildResponseMeta(
  recordCount: number,
  truncated: boolean,
  warnings: ReadonlyArray<{ code: string; message: string }>
): ResponseMeta {
  return {
    sourceMode: ApiDefaults.facilitiesSourceMode,
    dataVersion: ApiDefaults.dataVersion,
    generatedAt: new Date().toISOString(),
    recordCount,
    truncated,
    warnings: [...warnings],
  };
}

function queryPostgisFacilitiesRows(
  bbox: { east: number; north: number; south: number; west: number },
  limit: number,
  perspective: FacilityPerspective
): Promise<readonly FacilitiesBboxRow[]> {
  return listFacilitiesByBbox({
    ...bbox,
    limit,
    perspective,
  });
}

function validateFacilitiesPayload(payload: FacilitiesFeatureCollection): void {
  if (process.env.NODE_ENV !== "production") {
    FacilitiesFeatureCollectionSchema.parse(payload);
  }
}

function validateFacilitiesDetailPayload(payload: FacilitiesDetailResponse): void {
  if (process.env.NODE_ENV !== "production") {
    FacilitiesDetailResponseSchema.parse(payload);
  }
}

function buildPostgisFacilitiesResponse(
  rows: readonly FacilitiesBboxRow[],
  limit: number,
  perspective: FacilityPerspective
): {
  readonly features: FacilitiesFeatureCollection["features"];
  readonly truncated: boolean;
  readonly warnings: ReadonlyArray<{ code: string; message: string }>;
} {
  const features = mapFacilitiesRowsToFeatures(rows, perspective);
  const truncated = rows.length >= limit;
  const warnings: Array<{ code: string; message: string }> = [];

  if (truncated) {
    warnings.push({
      code: "POSSIBLY_TRUNCATED",
      message: `Returned limit=${limit} rows. Zoom in if you expected more.`,
    });
  }

  return {
    features,
    truncated,
    warnings,
  };
}

export function registerFacilitiesRoute(app: Hono): void {
  const defaultLimit = 2000;

  app.get(ApiRoutes.facilities, async (c) => {
    const incomingRequestId = c.req.header(ApiHeaders.requestId);
    const requestId = incomingRequestId ?? createRequestId("api");
    c.header(ApiHeaders.requestId, requestId);

    const bboxRaw = c.req.query("bbox");
    const bbox = bboxRaw ? parseBboxParam(bboxRaw) : null;

    if (!bbox) {
      return c.json(
        {
          error: "bbox query param required: west,south,east,north",
          requestId,
        },
        400
      );
    }

    const perspectiveResolution = resolvePerspectiveParam(c.req.query("perspective"));
    if (!perspectiveResolution.ok) {
      return c.json(
        {
          error: perspectiveResolution.error,
          requestId,
        },
        400
      );
    }
    const perspective = perspectiveResolution.perspective;

    const maxRows = getFacilitiesBboxMaxRows(perspective);
    const limit = clampLimit(c.req.query("limit"), maxRows, defaultLimit);
    let rows: readonly FacilitiesBboxRow[];
    try {
      rows = await queryPostgisFacilitiesRows(bbox, limit, perspective);
    } catch (error) {
      return c.json(
        {
          error: "postgis query failed",
          requestId,
          details: toDebugDetails(error),
        },
        503
      );
    }

    let facilitiesResponse: ReturnType<typeof buildPostgisFacilitiesResponse>;
    try {
      facilitiesResponse = buildPostgisFacilitiesResponse(rows, limit, perspective);
    } catch (error) {
      return c.json(
        {
          error: "facility mapping failed",
          requestId,
          details: toDebugDetails(error),
        },
        500
      );
    }

    const payload: FacilitiesFeatureCollection = {
      type: "FeatureCollection",
      features: facilitiesResponse.features,
      meta: buildResponseMeta(
        facilitiesResponse.features.length,
        facilitiesResponse.truncated,
        facilitiesResponse.warnings
      ),
    };

    validateFacilitiesPayload(payload);

    return c.json(payload);
  });

  app.get(`${ApiRoutes.facilities}/:facility-id`, async (c) => {
    const incomingRequestId = c.req.header(ApiHeaders.requestId);
    const requestId = incomingRequestId ?? createRequestId("api");
    c.header(ApiHeaders.requestId, requestId);

    const perspectiveResolution = resolvePerspectiveParam(c.req.query("perspective"));
    if (!perspectiveResolution.ok) {
      return c.json(
        {
          error: perspectiveResolution.error,
          requestId,
        },
        400
      );
    }
    const perspective = perspectiveResolution.perspective;

    const facilityId = c.req.param("facility-id").trim();
    if (facilityId.length === 0) {
      return c.json(
        {
          error: "facility-id path param is required",
          requestId,
        },
        400
      );
    }

    let row: FacilityDetailRow | null;
    try {
      row = await getFacilityById(facilityId, perspective);
    } catch (error) {
      return c.json(
        {
          error: "postgis query failed",
          requestId,
          details: toDebugDetails(error),
        },
        503
      );
    }

    if (!row) {
      return c.json(
        {
          error: "facility not found",
          requestId,
        },
        404
      );
    }

    let mappedFeature: FacilitiesDetailResponse["feature"];
    try {
      mappedFeature = mapFacilityDetailRowToFeature(row, perspective);
    } catch (error) {
      return c.json(
        {
          error: "facility mapping failed",
          requestId,
          details: toDebugDetails(error),
        },
        500
      );
    }

    const payload: FacilitiesDetailResponse = {
      feature: mappedFeature,
      meta: buildResponseMeta(1, false, []),
    };

    validateFacilitiesDetailPayload(payload);

    return c.json(payload);
  });
}
