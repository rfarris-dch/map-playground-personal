import {
  buildFloodSyncStatusRoute,
  ParcelsSyncStatusResponseSchema,
} from "@map-migration/contracts";
import type { Env, Hono } from "hono";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { getFloodSyncStatusSnapshot } from "./flood-sync-status.service";

export function registerFloodSyncStatusRoute<E extends Env>(app: Hono<E>): void {
  app.get(buildFloodSyncStatusRoute(), (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        try {
          const statusSnapshot = await getFloodSyncStatusSnapshot();
          return jsonOk(honoContext, ParcelsSyncStatusResponseSchema, statusSnapshot, requestId);
        } catch (error) {
          throw routeError({
            httpStatus: 503,
            code: "FLOOD_SYNC_STATUS_REFRESH_FAILED",
            message: "flood sync status refresh failed",
            details: toDebugDetails(error),
          });
        }
      })
    )
  );
}
