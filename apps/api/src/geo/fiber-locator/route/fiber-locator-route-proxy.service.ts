import {
  fetchFiberLocatorTile,
  isAllowedFiberLocatorLayer,
  readFiberLocatorConfig,
} from "@/geo/fiber-locator/fiber-locator.service";
import type { FiberLocatorConfig } from "@/geo/fiber-locator/fiber-locator.types";
import type { ProxyFiberLocatorTileRequestArgs } from "@/geo/fiber-locator/route/fiber-locator-route.types";
import { copyFiberLocatorPassthroughHeaders } from "@/geo/fiber-locator/route/fiber-locator-route-meta.service";
import {
  parseFiberLocatorLayerName,
  parseFiberLocatorTileCoordinates,
} from "@/geo/fiber-locator/route/fiber-locator-route-param.service";
import { responseError, toDebugDetails } from "@/http/api-response";

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

  const layerNameResult = parseFiberLocatorLayerName(args.params.layerNameRaw);
  if (!layerNameResult.ok) {
    return responseError({
      requestId: args.requestId,
      httpStatus: 400,
      code: layerNameResult.error.code,
      message: layerNameResult.error.message,
    });
  }

  const layerName = layerNameResult.value;
  if (!isAllowedFiberLocatorLayer(config, layerName)) {
    return responseError({
      requestId: args.requestId,
      httpStatus: 400,
      code: "INVALID_LAYER_NAME",
      message: `layerName must be one of: ${config.lineIds.join(", ")}`,
    });
  }

  const coordinateResult = parseFiberLocatorTileCoordinates(args.format, args.params);
  if (!coordinateResult.ok) {
    return responseError({
      requestId: args.requestId,
      httpStatus: 400,
      code: coordinateResult.error.code,
      message: coordinateResult.error.message,
    });
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetchFiberLocatorTile(
      config,
      {
        format: args.format,
        layerName,
        z: coordinateResult.value.z,
        x: coordinateResult.value.x,
        y: coordinateResult.value.y,
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
    let details: unknown;
    try {
      details = await upstreamResponse.text();
    } catch {
      details = undefined;
    }

    return responseError({
      requestId: args.requestId,
      httpStatus: 502,
      code: "FIBER_LOCATOR_UPSTREAM_ERROR",
      message: "fiberlocator upstream returned an error",
      details: {
        upstreamStatus: upstreamResponse.status,
        upstreamBody: details,
      },
    });
  }

  const responseHeaders = copyFiberLocatorPassthroughHeaders(upstreamResponse, args.requestId);
  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}
