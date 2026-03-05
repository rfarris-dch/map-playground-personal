import { serve } from "@hono/node-server";
import { ApiRoutes, type HealthResponse, HealthSchema } from "@map-migration/contracts";
import { Hono } from "hono";
import { closePostgresPool } from "./db/postgres";
import { registerBoundariesRoute } from "./geo/boundaries/boundaries.route";
import { registerFacilitiesRoute } from "./geo/facilities/facilities.route";
import { registerFiberLocatorRoute } from "./geo/fiber-locator/fiber-locator.route";
import { registerMarketsRoute } from "./geo/markets/markets.route";
import { registerParcelsRoute } from "./geo/parcels/parcels.route";
import { registerProvidersRoute } from "./geo/providers/providers.route";
import { getOrCreateRequestId, jsonError, jsonOk, toDebugDetails } from "./http/api-response";
import { startHyperscaleSyncLoop } from "./sync/hyperscale-sync.service";
import type { HyperscaleSyncController } from "./sync/hyperscale-sync.types";
import { startParcelsSyncLoop } from "./sync/parcels-sync.service";
import type { ParcelsSyncController } from "./sync/parcels-sync.types";

const app = new Hono();
let hyperscaleSyncController: HyperscaleSyncController | null = null;
let parcelsSyncController: ParcelsSyncController | null = null;

function healthPayload(): HealthResponse {
  return {
    status: "ok",
    service: "@map-migration/api",
    now: new Date().toISOString(),
  };
}

app.onError((error, c) => {
  const requestId = getOrCreateRequestId(c, "api");
  return jsonError(c, {
    requestId,
    httpStatus: 500,
    code: "UNHANDLED_EXCEPTION",
    message: "internal server error",
    details: toDebugDetails(error),
  });
});

app.notFound((c) => {
  const requestId = getOrCreateRequestId(c, "api");
  return jsonError(c, {
    requestId,
    httpStatus: 404,
    code: "NOT_FOUND",
    message: "route not found",
  });
});

app.get("/health", (c) => {
  const requestId = getOrCreateRequestId(c, "api");
  const payload = healthPayload();
  return jsonOk(c, HealthSchema, payload, requestId);
});

app.get(ApiRoutes.health, (c) => {
  const requestId = getOrCreateRequestId(c, "api");
  const payload = healthPayload();
  return jsonOk(c, HealthSchema, payload, requestId);
});

registerFacilitiesRoute(app);
registerFiberLocatorRoute(app);
registerParcelsRoute(app);
registerBoundariesRoute(app);
registerMarketsRoute(app);
registerProvidersRoute(app);

const port = Number(process.env.PORT ?? 3001);

async function shutdown(signal: string): Promise<void> {
  console.log(`[api] shutting down (${signal})`);
  try {
    hyperscaleSyncController?.stop();
    hyperscaleSyncController = null;
    parcelsSyncController?.stop();
    parcelsSyncController = null;
    await closePostgresPool();
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((error) => {
    console.error("[api] shutdown failure", error);
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((error) => {
    console.error("[api] shutdown failure", error);
    process.exit(1);
  });
});

async function startServer(): Promise<void> {
  hyperscaleSyncController = await startHyperscaleSyncLoop();
  parcelsSyncController = await startParcelsSyncLoop();
  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`[api] listening on http://localhost:${info.port}`);
    }
  );
}

startServer().catch((error) => {
  console.error("[api] startup failure", error);
  process.exit(1);
});
