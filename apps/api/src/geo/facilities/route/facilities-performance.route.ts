import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import { FacilitiesPerformanceSnapshotSchema } from "@map-migration/http-contracts/facilities-performance-http";
import type { Env, Hono } from "hono";
import { getFacilitiesPerformanceSnapshot } from "@/geo/facilities/route/facilities-performance.service";
import { jsonOk } from "@/http/api-response";
import { fromApiRequest, runEffectRoute } from "@/http/effect-route";

export function registerFacilitiesPerformanceRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.facilitiesPerformanceDebug, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(({ honoContext, requestId }) =>
        jsonOk(
          honoContext,
          FacilitiesPerformanceSnapshotSchema,
          getFacilitiesPerformanceSnapshot(),
          requestId
        )
      )
    )
  );
}
