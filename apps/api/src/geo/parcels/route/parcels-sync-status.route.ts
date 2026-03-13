import { ApiRoutes, ParcelsSyncStatusResponseSchema } from "@map-migration/contracts";
import type { Env, Hono } from "hono";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { getPipelineStatusPayload } from "@/pipeline/pipeline-status.service";

export function registerParcelsSyncStatusRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.parcelsSyncStatus, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        try {
          const syncStatus = await getPipelineStatusPayload("parcels");
          return jsonOk(honoContext, ParcelsSyncStatusResponseSchema, syncStatus, requestId);
        } catch (error) {
          throw routeError({
            httpStatus: 503,
            code: "PARCELS_SYNC_STATUS_REFRESH_FAILED",
            message: "parcels sync status refresh failed",
            details: toDebugDetails(error),
          });
        }
      })
    )
  );
}
