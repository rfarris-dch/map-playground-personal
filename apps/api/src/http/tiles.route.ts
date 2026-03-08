import { ApiHeaders } from "@map-migration/contracts";
import type { Env, Hono } from "hono";
import { responseError, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, runEffectRoute } from "@/http/effect-route";

const USGS_WATER_TILE_URL =
  "https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/tile";

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

function parseTileCoordinate(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export function registerTilesRoute<E extends Env>(app: Hono<E>): void {
  app.get("/api/tiles/usgs-water/:z/:x/:y", (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId, signal }) => {
        const z = parseTileCoordinate(honoContext.req.param("z"));
        const x = parseTileCoordinate(honoContext.req.param("x"));
        const y = parseTileCoordinate(honoContext.req.param("y"));

        if (z === null || x === null || y === null) {
          return responseError({
            requestId,
            httpStatus: 400,
            code: "INVALID_TILE_COORDINATES",
            message: "tile coordinates must be nonnegative integers",
          });
        }

        try {
          const upstreamUrl = `${USGS_WATER_TILE_URL}/${z}/${y}/${x}`;
          const upstreamResponse = await fetch(upstreamUrl, { signal });

          if (!upstreamResponse.ok) {
            return responseError({
              requestId,
              httpStatus: 502,
              code: "USGS_WATER_TILE_UPSTREAM_ERROR",
              message: "USGS water tile upstream returned an error",
              details: {
                upstreamStatus: upstreamResponse.status,
              },
            });
          }

          const bytes = new Uint8Array(await upstreamResponse.arrayBuffer());
          const contentType = imageContentType(bytes);
          if (contentType === null) {
            return responseError({
              requestId,
              httpStatus: 502,
              code: "USGS_WATER_TILE_INVALID_IMAGE",
              message: "USGS water tile upstream returned an unsupported image payload",
            });
          }

          return createTileResponse({
            body: bytes,
            cacheControl:
              "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400, stale-if-error=86400",
            contentType,
            requestId,
            tileCache: "USGS",
          });
        } catch (error) {
          return responseError({
            requestId,
            httpStatus: 503,
            code: "USGS_WATER_TILE_UPSTREAM_FAILED",
            message: "USGS water tile request failed",
            details: toDebugDetails(error),
          });
        }
      })
    )
  );
}
