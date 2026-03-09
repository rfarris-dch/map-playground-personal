import {
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
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";

export function registerFiberLocatorRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.fiberLocatorLayers, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId, signal }) => {
        try {
          const config = readFiberLocatorConfig();
          const catalog = await fetchFiberLocatorCatalog(config, signal);
          const payload: FiberLocatorCatalogResponse = {
            layers: [...catalog.layers],
            meta: buildFiberLocatorResponseMeta(requestId, catalog.layers.length),
          };
          return jsonOk(honoContext, FiberLocatorCatalogResponseSchema, payload, requestId);
        } catch (error) {
          throw routeError({
            httpStatus: 503,
            code: "FIBER_LOCATOR_LAYERS_REQUEST_FAILED",
            message: "fiberlocator layers request failed",
            details: toDebugDetails(error),
          });
        }
      })
    )
  );

  app.get(`${ApiRoutes.fiberLocatorLayersInView}/:bbox`, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId, signal }) => {
        const bboxParam = honoContext.req.param("bbox") ?? "";
        const decodedBboxParam = decodeFiberLocatorPathParam(bboxParam);
        const bbox = decodedBboxParam === null ? null : parseBboxParam(decodedBboxParam);
        if (bbox === null) {
          throw routeError({
            httpStatus: 400,
            code: "INVALID_BBOX",
            message: "bbox must be west,south,east,north in WGS84",
          });
        }

        try {
          const config = readFiberLocatorConfig();
          const inView = await fetchFiberLocatorLayersInView(config, bbox, signal);
          const payload: FiberLocatorLayersInViewResponse = {
            layers: [...inView.layerNames],
            meta: buildFiberLocatorResponseMeta(requestId, inView.layerNames.length),
          };
          return jsonOk(honoContext, FiberLocatorLayersInViewResponseSchema, payload, requestId);
        } catch (error) {
          throw routeError({
            httpStatus: 503,
            code: "FIBER_LOCATOR_LAYERS_IN_VIEW_REQUEST_FAILED",
            message: "fiberlocator layers/inview request failed",
            details: toDebugDetails(error),
          });
        }
      })
    )
  );

  app.get(`${ApiRoutes.fiberLocatorTile}/:layerName/:z/:x/:y`, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId, signal }) => {
        const response = await proxyFiberLocatorTileRequest({
          requestId,
          format: "png",
          params: {
            layerNameRaw: honoContext.req.param("layerName") ?? "",
            zRaw: honoContext.req.param("z") ?? "",
            xRaw: honoContext.req.param("x") ?? "",
            yRaw: honoContext.req.param("y") ?? "",
          },
          signal,
        });

        return response;
      })
    )
  );

  app.get(`${ApiRoutes.fiberLocatorVectorTile}/:layerName/:z/:x/:y`, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId, signal }) => {
        const response = await proxyFiberLocatorTileRequest({
          requestId,
          format: "pbf",
          params: {
            layerNameRaw: honoContext.req.param("layerName") ?? "",
            zRaw: honoContext.req.param("z") ?? "",
            xRaw: honoContext.req.param("x") ?? "",
            yRaw: honoContext.req.param("y") ?? "",
          },
          signal,
        });

        return response;
      })
    )
  );
}
