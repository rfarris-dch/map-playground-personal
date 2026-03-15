import {
  fetchResponseEffect,
  isRequestEffectError,
  runEffectPromise,
} from "@map-migration/core-runtime/effect";
import { ApiHeaders, ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  UsgsWaterTileContentTypeSchema,
  UsgsWaterTilePathSchema,
} from "@map-migration/http-contracts/tiles-http";
import { Effect } from "effect";
import type { Env, Hono } from "hono";
import { toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { upstreamError, upstreamStatusError } from "@/http/route-error-taxonomy.service";
import { validationRouteError } from "@/http/validation-error.service";

const USGS_WATER_TILE_URL =
  "https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/tile";

const USGS_TILE_TIMEOUT_MS = 12_000;
const USGS_TILE_MAX_ATTEMPTS = 3;

function shouldRetryUpstreamResponse(response: Response): boolean {
  return response.status === 408 || response.status === 429 || response.status >= 500;
}

function retryDelayMs(attempt: number): number {
  return 250 * 2 ** Math.max(0, attempt);
}

function looksLikePng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function looksLikeJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function imageContentType(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  if (looksLikePng(bytes)) {
    return "image/png";
  }

  if (looksLikeJpeg(bytes)) {
    return "image/jpeg";
  }

  return null;
}

function createTileResponse(args: {
  readonly body: Uint8Array;
  readonly cacheControl: string;
  readonly contentType: string;
  readonly requestId: string;
  readonly tileCache: string;
}): Response {
  const normalizedBody = args.body.slice();

  return new Response(new Blob([normalizedBody], { type: args.contentType }), {
    status: 200,
    headers: {
      "Cache-Control": args.cacheControl,
      "Content-Type": args.contentType,
      [ApiHeaders.requestId]: args.requestId,
      "X-Tile-Cache": args.tileCache,
    },
  });
}

async function fetchUpstreamTile(
  upstreamUrl: string,
  signal: AbortSignal | undefined
): Promise<Response> {
  try {
    return await runEffectPromise(
      fetchResponseEffect({
        init: {
          method: "GET",
          ...(signal ? { signal } : {}),
        },
        maxAttempts: USGS_TILE_MAX_ATTEMPTS,
        retryDelayMs,
        shouldRetryError: (error) =>
          error._tag === "RequestNetworkError" ||
          (error._tag === "RequestAbortedError" && signal?.aborted !== true),
        shouldRetryResponse: shouldRetryUpstreamResponse,
        timeoutMs: USGS_TILE_TIMEOUT_MS,
        url: upstreamUrl,
      }).pipe(Effect.map(({ response }) => response)),
      signal
    );
  } catch (error: unknown) {
    if (isRequestEffectError(error)) {
      throw routeError(
        error._tag === "RequestAbortedError"
          ? {
              httpStatus: 504,
              code: "USGS_WATER_TILE_TIMEOUT",
              message: "USGS water tile upstream timed out",
            }
          : {
              httpStatus: 502,
              code: "USGS_WATER_TILE_NETWORK_ERROR",
              message: "USGS water tile upstream network error",
              details: toDebugDetails(error.cause),
            }
      );
    }
    throw error;
  }
}

export function registerTilesRoute<E extends Env>(app: Hono<E>): void {
  app.get(`${ApiRoutes.usgsWaterTile}/:z/:x/:y`, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId, signal }) => {
        const request = UsgsWaterTilePathSchema.safeParse({
          z: honoContext.req.param("z"),
          x: honoContext.req.param("x"),
          y: honoContext.req.param("y"),
        });
        if (!request.success) {
          throw validationRouteError({
            code: "INVALID_TILE_COORDINATES",
            message: "invalid usgs water tile path params",
            zodError: request.error,
          });
        }

        const upstreamUrl = `${USGS_WATER_TILE_URL}/${request.data.z}/${request.data.y}/${request.data.x}`;
        const upstreamResponse = await fetchUpstreamTile(upstreamUrl, signal);

        if (!upstreamResponse.ok) {
          throw upstreamStatusError(
            "usgs_water_tile",
            "USGS water tile upstream returned an error",
            upstreamResponse.status
          );
        }

        const bytes = new Uint8Array(await upstreamResponse.arrayBuffer());
        const contentType = imageContentType(bytes);
        const contentTypeResult = UsgsWaterTileContentTypeSchema.safeParse(contentType);
        if (!contentTypeResult.success) {
          throw upstreamError(
            "usgs_water_tile_payload",
            "USGS water tile upstream returned an unsupported image payload",
            {}
          );
        }

        return createTileResponse({
          body: bytes,
          cacheControl:
            "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400, stale-if-error=86400",
          contentType: contentTypeResult.data,
          requestId,
          tileCache: "USGS",
        });
      })
    )
  );
}
