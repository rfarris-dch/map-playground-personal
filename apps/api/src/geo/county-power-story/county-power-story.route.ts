import { ApiHeaders, ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  type CountyPowerStoryGeometryResponse,
  CountyPowerStoryGeometryResponseSchema,
  type CountyPowerStoryRequest,
  CountyPowerStoryRequestSchema,
  type CountyPowerStorySnapshotResponse,
  CountyPowerStorySnapshotResponseSchema,
  type CountyPowerStoryTimelineResponse,
  CountyPowerStoryTimelineResponseSchema,
} from "@map-migration/http-contracts/county-power-story-http";
import type { Env, Hono } from "hono";
import {
  queryCountyPowerStoryGeometry,
  queryCountyPowerStorySnapshot,
  queryCountyPowerStoryTimeline,
  queryCountyPowerStoryVectorTile,
} from "@/geo/county-power-story/county-power-story.service";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { buildResponseMeta, setCacheControlHeader } from "@/http/response-meta.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";
import { getDatasetCacheTtlSeconds } from "@/http/spatial-analysis-policy.service";

const VECTOR_TILE_CONTENT_TYPE = "application/vnd.mapbox-vector-tile";

function readTileCoordinate(value: string | undefined, name: string): number {
  if (typeof value !== "string") {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_COUNTY_POWER_STORY_TILE_REQUEST",
      message: "invalid county power story tile request",
      details: {
        [name]: "missing",
      },
    });
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_COUNTY_POWER_STORY_TILE_REQUEST",
      message: "invalid county power story tile request",
      details: {
        [name]: "empty",
      },
    });
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_COUNTY_POWER_STORY_TILE_REQUEST",
      message: "invalid county power story tile request",
      details: {
        [name]: value,
      },
    });
  }

  return parsed;
}

function createVectorTileResponse(args: {
  readonly bytes: Uint8Array;
  readonly cacheControl: string;
  readonly requestId: string;
}): Response {
  return new Response(Uint8Array.from(args.bytes), {
    status: 200,
    headers: {
      "Cache-Control": args.cacheControl,
      "Content-Type": VECTOR_TILE_CONTENT_TYPE,
      [ApiHeaders.requestId]: args.requestId,
    },
  });
}

function readRequest(args: {
  readonly publicationRunId?: string | undefined;
  readonly storyId: string | undefined;
  readonly window?: string | undefined;
}): CountyPowerStoryRequest {
  const parsed = CountyPowerStoryRequestSchema.safeParse(args);
  if (!parsed.success) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_COUNTY_POWER_STORY_REQUEST",
      message: "invalid county power story request",
      details: toDebugDetails(parsed.error),
    });
  }

  return parsed.data;
}

function buildCountyPowerStoryResponseMeta(args: {
  readonly dataVersion?: string | null | undefined;
  readonly recordCount: number;
  readonly requestId: string;
}) {
  return buildResponseMeta({
    dataVersion: args.dataVersion ?? "unpublished",
    recordCount: args.recordCount,
    requestId: args.requestId,
    sourceMode: getApiRuntimeConfig().countyIntelligenceSourceMode,
  });
}

function countyPowerStoryRouteError(reason: string, error: unknown) {
  if (reason === "source_unavailable") {
    return routeError({
      httpStatus: 503,
      code: "COUNTY_POWER_STORY_SOURCE_UNAVAILABLE",
      message: "county power story source is unavailable",
      details: toDebugDetails(error),
    });
  }

  if (reason === "query_failed") {
    return routeError({
      httpStatus: 503,
      code: "COUNTY_POWER_STORY_QUERY_FAILED",
      message: "county power story query failed",
      details: toDebugDetails(error),
    });
  }

  if (reason === "publication_run_not_found") {
    return routeError({
      httpStatus: 404,
      code: "COUNTY_POWER_STORY_PUBLICATION_NOT_FOUND",
      message: "county power story publication run was not found",
      details: toDebugDetails(error),
    });
  }

  return routeError({
    httpStatus: 500,
    code: "COUNTY_POWER_STORY_MAPPING_FAILED",
    message: "county power story mapping failed",
    details: toDebugDetails(error),
  });
}

export function registerCountyPowerStoryRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.countyPowerStoryGeometry, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const geometryResult = await queryCountyPowerStoryGeometry();
        if (!geometryResult.ok) {
          throw countyPowerStoryRouteError(geometryResult.value.reason, geometryResult.value.error);
        }

        setCacheControlHeader(honoContext, getDatasetCacheTtlSeconds("power"));

        const payload: CountyPowerStoryGeometryResponse = {
          type: "FeatureCollection",
          features: [...geometryResult.value.features],
          meta: buildCountyPowerStoryResponseMeta({
            dataVersion: getApiRuntimeConfig().dataVersion,
            recordCount: geometryResult.value.features.length,
            requestId,
          }),
        };

        return jsonOk(honoContext, CountyPowerStoryGeometryResponseSchema, payload, requestId);
      })
    )
  );

  app.get(`${ApiRoutes.countyPowerStoryTiles}/:z/:x/:y`, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const z = readTileCoordinate(honoContext.req.param("z"), "z");
        const x = readTileCoordinate(honoContext.req.param("x"), "x");
        const y = readTileCoordinate(honoContext.req.param("y"), "y");

        const tileResult = await queryCountyPowerStoryVectorTile({ z, x, y });
        if (!tileResult.ok) {
          throw countyPowerStoryRouteError(tileResult.value.reason, tileResult.value.error);
        }

        return createVectorTileResponse({
          bytes: tileResult.value.tile,
          cacheControl: `public, max-age=${String(getDatasetCacheTtlSeconds("power"))}`,
          requestId,
        });
      })
    )
  );

  app.get(`${ApiRoutes.countyPowerStory}/:storyId`, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const request = readRequest({
          publicationRunId: honoContext.req.query("publicationRunId"),
          storyId: honoContext.req.param("storyId"),
          window: honoContext.req.query("window"),
        });

        const snapshotResult = await queryCountyPowerStorySnapshot(request);
        if (!snapshotResult.ok) {
          throw countyPowerStoryRouteError(snapshotResult.value.reason, snapshotResult.value.error);
        }

        setCacheControlHeader(honoContext, getDatasetCacheTtlSeconds("county_scores"));

        const payload: CountyPowerStorySnapshotResponse = {
          storyId: snapshotResult.value.storyId,
          window: snapshotResult.value.window,
          publicationRunId: snapshotResult.value.publicationRunId,
          publishedAt: snapshotResult.value.publishedAt,
          dataVersion: snapshotResult.value.dataVersion,
          formulaVersion: snapshotResult.value.formulaVersion,
          inputDataVersion: snapshotResult.value.inputDataVersion,
          rows: [...snapshotResult.value.rows],
          meta: buildCountyPowerStoryResponseMeta({
            dataVersion: snapshotResult.value.dataVersion,
            recordCount: snapshotResult.value.rows.length,
            requestId,
          }),
        };

        return jsonOk(honoContext, CountyPowerStorySnapshotResponseSchema, payload, requestId);
      })
    )
  );

  app.get(`${ApiRoutes.countyPowerStory}/:storyId/timeline`, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const request = readRequest({
          publicationRunId: honoContext.req.query("publicationRunId"),
          storyId: honoContext.req.param("storyId"),
          window: "live",
        });

        const timelineResult = await queryCountyPowerStoryTimeline({
          publicationRunId: request.publicationRunId,
          storyId: request.storyId,
        });
        if (!timelineResult.ok) {
          throw countyPowerStoryRouteError(timelineResult.value.reason, timelineResult.value.error);
        }

        setCacheControlHeader(honoContext, getDatasetCacheTtlSeconds("county_scores"));

        const frameCount = timelineResult.value.frames.reduce(
          (count, frame) => count + frame.rows.length,
          0
        );
        const payload: CountyPowerStoryTimelineResponse = {
          storyId: timelineResult.value.storyId,
          publicationRunId: timelineResult.value.publicationRunId,
          publishedAt: timelineResult.value.publishedAt,
          dataVersion: timelineResult.value.dataVersion,
          formulaVersion: timelineResult.value.formulaVersion,
          inputDataVersion: timelineResult.value.inputDataVersion,
          frames: [...timelineResult.value.frames],
          meta: buildCountyPowerStoryResponseMeta({
            dataVersion: timelineResult.value.dataVersion,
            recordCount: frameCount,
            requestId,
          }),
        };

        return jsonOk(honoContext, CountyPowerStoryTimelineResponseSchema, payload, requestId);
      })
    )
  );
}
