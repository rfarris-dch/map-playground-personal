import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  AppPerformanceExportRequestSchema,
  AppPerformanceIngestStateSchema,
} from "@map-migration/http-contracts/app-performance-http";
import type { Env, Hono } from "hono";
import {
  getAppPerformanceIngestState,
  recordAppPerformanceExport,
} from "@/debug/app-performance.service";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { readJsonBody } from "@/http/json-request.service";

export function registerAppPerformanceRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.appPerformanceDebug, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(({ honoContext, requestId }) =>
        jsonOk(
          honoContext,
          AppPerformanceIngestStateSchema,
          getAppPerformanceIngestState(),
          requestId
        )
      )
    )
  );

  app.post(ApiRoutes.appPerformanceDebug, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const requestBodyResult = await readJsonBody(honoContext, {
          invalidJsonMessage: "invalid app performance payload",
          requestId,
        });
        if (!requestBodyResult.ok) {
          return requestBodyResult.response;
        }

        const parsedPayload = AppPerformanceExportRequestSchema.safeParse(requestBodyResult.value);
        if (!parsedPayload.success) {
          throw routeError({
            httpStatus: 400,
            code: "INVALID_APP_PERFORMANCE_PAYLOAD",
            message: "invalid app performance payload",
            details: toDebugDetails(parsedPayload.error),
          });
        }

        recordAppPerformanceExport(parsedPayload.data);

        return jsonOk(
          honoContext,
          AppPerformanceIngestStateSchema,
          getAppPerformanceIngestState(),
          requestId
        );
      })
    )
  );
}
