import {
  ApiHeaders,
  ApiRoutes,
  type FiberLocatorCatalogResponse,
  FiberLocatorCatalogResponseSchema,
  type FiberLocatorLayersInViewResponse,
  FiberLocatorLayersInViewResponseSchema,
  parseBboxParam,
} from "@map-migration/contracts";
import type { Env, Hono } from "hono";
import {
  fetchFiberLocatorCatalog,
  fetchFiberLocatorLayersInView,
  readFiberLocatorConfig,
} from "@/geo/fiber-locator/fiber-locator.service";
import { buildFiberLocatorResponseMeta } from "@/geo/fiber-locator/route/fiber-locator-route-meta.service";
import { decodeFiberLocatorPathParam } from "@/geo/fiber-locator/route/fiber-locator-route-param.service";
import { proxyFiberLocatorTileRequest } from "@/geo/fiber-locator/route/fiber-locator-route-proxy.service";
import { getOrCreateRequestId, jsonError, jsonOk, toDebugDetails } from "@/http/api-response";

export function registerFiberLocatorRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.fiberLocatorLayers, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");

    try {
      const config = readFiberLocatorConfig();
      const catalog = await fetchFiberLocatorCatalog(config, c.req.raw.signal);
      const payload: FiberLocatorCatalogResponse = {
        layers: [...catalog.layers],
        meta: buildFiberLocatorResponseMeta(requestId, catalog.layers.length),
      };
      return jsonOk(c, FiberLocatorCatalogResponseSchema, payload, requestId);
    } catch (error) {
      return jsonError(c, {
        requestId,
        httpStatus: 503,
        code: "FIBER_LOCATOR_LAYERS_REQUEST_FAILED",
        message: "fiberlocator layers request failed",
        details: toDebugDetails(error),
      });
    }
  });

  app.get(`${ApiRoutes.fiberLocatorLayersInView}/:bbox`, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");

    const bboxParam = c.req.param("bbox") ?? "";
    const decodedBboxParam = decodeFiberLocatorPathParam(bboxParam);
    const bbox = decodedBboxParam === null ? null : parseBboxParam(decodedBboxParam);
    if (bbox === null) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_BBOX",
        message: "bbox must be west,south,east,north in WGS84",
      });
    }

    try {
      const config = readFiberLocatorConfig();
      const inView = await fetchFiberLocatorLayersInView(config, bbox, c.req.raw.signal);
      const payload: FiberLocatorLayersInViewResponse = {
        layers: [...inView.layerNames],
        meta: buildFiberLocatorResponseMeta(requestId, inView.layerNames.length),
      };
      return jsonOk(c, FiberLocatorLayersInViewResponseSchema, payload, requestId);
    } catch (error) {
      return jsonError(c, {
        requestId,
        httpStatus: 503,
        code: "FIBER_LOCATOR_LAYERS_IN_VIEW_REQUEST_FAILED",
        message: "fiberlocator layers/inview request failed",
        details: toDebugDetails(error),
      });
    }
  });

  app.get(`${ApiRoutes.fiberLocatorTile}/:layerName/:z/:x/:y`, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");

    const response = await proxyFiberLocatorTileRequest({
      requestId,
      format: "png",
      params: {
        layerNameRaw: c.req.param("layerName") ?? "",
        zRaw: c.req.param("z") ?? "",
        xRaw: c.req.param("x") ?? "",
        yRaw: c.req.param("y") ?? "",
      },
      signal: c.req.raw.signal,
    });

    response.headers.set(ApiHeaders.requestId, requestId);
    return response;
  });

  app.get(`${ApiRoutes.fiberLocatorVectorTile}/:layerName/:z/:x/:y`, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");

    const response = await proxyFiberLocatorTileRequest({
      requestId,
      format: "pbf",
      params: {
        layerNameRaw: c.req.param("layerName") ?? "",
        zRaw: c.req.param("z") ?? "",
        xRaw: c.req.param("x") ?? "",
        yRaw: c.req.param("y") ?? "",
      },
      signal: c.req.raw.signal,
    });

    response.headers.set(ApiHeaders.requestId, requestId);
    return response;
  });
}
