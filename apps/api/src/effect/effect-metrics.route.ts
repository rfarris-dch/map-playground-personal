import type { Env, Hono } from "hono";
import { getEffectIssuesSnapshot } from "@/effect/effect-metrics.service";
import { withRequestId } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";

const EFFECT_ISSUES_ROUTE = "/api/debug/effect/issues";

export function registerEffectMetricsRoute<E extends Env>(app: Hono<E>): void {
  app.get(EFFECT_ISSUES_ROUTE, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(({ honoContext, requestId }) => {
        try {
          return withRequestId(honoContext.json(getEffectIssuesSnapshot()), requestId);
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
