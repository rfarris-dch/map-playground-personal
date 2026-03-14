import {
  FiberLocatorTileContentTypeSchema,
  FiberLocatorTileRequestSchema,
  FiberLocatorVectorTileContentTypeSchema,
} from "@map-migration/http-contracts/fiber-locator-http";
import {
  fetchFiberLocatorTile,
  isAllowedFiberLocatorLayer,
  readFiberLocatorConfig,
} from "@/geo/fiber-locator/fiber-locator.service";
import type { FiberLocatorConfig } from "@/geo/fiber-locator/fiber-locator.types";
import type { ProxyFiberLocatorTileRequestArgs } from "@/geo/fiber-locator/route/fiber-locator-route.types";
import { copyFiberLocatorPassthroughHeaders } from "@/geo/fiber-locator/route/fiber-locator-route-meta.service";
import { responseError, toDebugDetails } from "@/http/api-response";

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

function normalizeContentType(value: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.split(";")[0]?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export async function proxyFiberLocatorTileRequest(
  args: ProxyFiberLocatorTileRequestArgs
): Promise<Response> {
  let config: FiberLocatorConfig;
  try {
    config = readFiberLocatorConfig();
  } catch (error) {
    return responseError({
      requestId: args.requestId,
      httpStatus: 503,
      code: "FIBER_LOCATOR_CONFIG_INVALID",
      message: "fiber locator service is not configured",
      details: toDebugDetails(error),
    });
  }

  const request = FiberLocatorTileRequestSchema.safeParse({
    format: args.format,
    layerName: args.params.layerNameRaw,
    x: args.params.xRaw,
    y: args.params.yRaw,
    z: args.params.zRaw,
  });
  if (!request.success) {
    return responseError({
      requestId: args.requestId,
      httpStatus: 400,
      code: "INVALID_TILE_PATH",
      message: "invalid fiber locator tile request path",
      details: toDebugDetails(request.error),
    });
  }

  if (!isAllowedFiberLocatorLayer(config, request.data.layerName)) {
    return responseError({
      requestId: args.requestId,
      httpStatus: 400,
      code: "INVALID_LAYER_NAME",
      message: `layerName must be one of: ${config.lineIds.join(", ")}`,
    });
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetchFiberLocatorTile(
      config,
      {
        format: args.format,
        layerName: request.data.layerName,
        z: request.data.z,
        x: request.data.x,
        y: request.data.y,
      },
      args.signal
    );
  } catch (error) {
    return responseError({
      requestId: args.requestId,
      httpStatus: 503,
      code: "FIBER_LOCATOR_TILE_UPSTREAM_FAILED",
      message: "fiberlocator tile request failed",
      details: toDebugDetails(error),
    });
  }

  if (!upstreamResponse.ok) {
    return responseError({
      requestId: args.requestId,
      httpStatus: 502,
      code: "FIBER_LOCATOR_UPSTREAM_ERROR",
      message: "fiberlocator upstream returned an error",
      details: {
        upstreamStatus: upstreamResponse.status,
      },
    });
  }

  const bytes = new Uint8Array(await upstreamResponse.arrayBuffer());
  const contentType = normalizeContentType(upstreamResponse.headers.get("content-type"));
  if (args.format === "png") {
    const contentTypeResult = FiberLocatorTileContentTypeSchema.safeParse(contentType);
    if (!(contentTypeResult.success && looksLikePng(bytes))) {
      return responseError({
        requestId: args.requestId,
        httpStatus: 502,
        code: "FIBER_LOCATOR_INVALID_TILE_PAYLOAD",
        message: "fiber locator upstream returned an invalid png tile payload",
      });
    }
  } else {
    const contentTypeResult = FiberLocatorVectorTileContentTypeSchema.safeParse(contentType);
    if (!contentTypeResult.success || bytes.length === 0) {
      return responseError({
        requestId: args.requestId,
        httpStatus: 502,
        code: "FIBER_LOCATOR_INVALID_TILE_PAYLOAD",
        message: "fiber locator upstream returned an invalid vector tile payload",
      });
    }
  }

  const responseHeaders = copyFiberLocatorPassthroughHeaders(upstreamResponse, args.requestId);
  return new Response(new Blob([bytes]), {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}
