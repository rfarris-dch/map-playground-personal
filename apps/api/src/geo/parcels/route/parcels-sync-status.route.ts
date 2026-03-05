import { ApiRoutes, ParcelsSyncStatusResponseSchema } from "@map-migration/contracts";
import type { Env, Hono } from "hono";
import { EXPOSE_SYNC_INTERNALS } from "@/geo/parcels/route/parcels-route-meta.service";
import { getOrCreateRequestId, jsonOk } from "@/http/api-response";
import { getParcelsSyncStatusSnapshot } from "@/sync/parcels-sync.service";

export function registerParcelsSyncStatusRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.parcelsSyncStatus, (c) => {
    const requestId = getOrCreateRequestId(c, "api");

    const syncStatus = getParcelsSyncStatusSnapshot();
    const run = syncStatus.run;
    const payload = {
      status: "ok",
      generatedAt: new Date().toISOString(),
      enabled: syncStatus.enabled,
      mode: syncStatus.mode,
      intervalMs: syncStatus.intervalMs,
      requireStartupSuccess: syncStatus.requireStartupSuccess,
      snapshotRoot: EXPOSE_SYNC_INTERNALS ? syncStatus.snapshotRoot : "redacted",
      latestRunId: syncStatus.latestRunId,
      latestRunCompletedAt: syncStatus.latestRunCompletedAt,
      run: {
        ...run,
        states: run.states.map((state) => ({
          ...state,
        })),
        logTail: EXPOSE_SYNC_INTERNALS ? [...run.logTail] : [],
      },
    };

    return jsonOk(c, ParcelsSyncStatusResponseSchema, payload, requestId);
  });
}
