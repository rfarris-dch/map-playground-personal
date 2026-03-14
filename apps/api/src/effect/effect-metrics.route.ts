import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import { EffectIssuesSnapshotSchema } from "@map-migration/http-contracts/effect-http";
import type { Env, Hono } from "hono";
import { getEffectIssuesSnapshot } from "@/effect/effect-metrics.service";
import { jsonOk } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";

export function registerEffectMetricsRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.effectMetrics, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(({ honoContext, requestId }) => {
        try {
          return jsonOk(
            honoContext,
            EffectIssuesSnapshotSchema,
            getEffectIssuesSnapshot(),
            requestId
          );
        } catch (error) {
          throw routeError({
            code: "EFFECT_ISSUES_SNAPSHOT_FAILED",
            details: error,
            httpStatus: 500,
            message: "effect issues snapshot failed",
          });
        }
      })
    )
  );
}
