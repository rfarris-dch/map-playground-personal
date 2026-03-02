import { serve } from "@hono/node-server";
import { ApiHeaders, ApiRoutes, type HealthResponse, HealthSchema } from "@map-migration/contracts";
import { createRequestId } from "@map-migration/ops";
import { Hono } from "hono";
import { closePostgresPool } from "./db/postgres";
import { registerFacilitiesRoute } from "./geo/facilities/facilities.route";
import { startHyperscaleSyncLoop } from "./sync/hyperscale-sync.service";
import type { HyperscaleSyncController } from "./sync/hyperscale-sync.types";

const app = new Hono();
let hyperscaleSyncController: HyperscaleSyncController | null = null;

function healthPayload(): HealthResponse {
  return {
    status: "ok",
    service: "@map-migration/api",
    now: new Date().toISOString(),
  };
}

app.get("/health", (c) => {
  const requestId = c.req.header(ApiHeaders.requestId) ?? createRequestId("api");
  c.header(ApiHeaders.requestId, requestId);

  const payload = healthPayload();
  if (process.env.NODE_ENV !== "production") {
    HealthSchema.parse(payload);
  }

  return c.json(payload);
});

app.get(ApiRoutes.health, (c) => {
  const requestId = c.req.header(ApiHeaders.requestId) ?? createRequestId("api");
  c.header(ApiHeaders.requestId, requestId);

  const payload = healthPayload();
  if (process.env.NODE_ENV !== "production") {
    HealthSchema.parse(payload);
  }

  return c.json(payload);
});

registerFacilitiesRoute(app);

const port = Number(process.env.PORT ?? 3001);

async function shutdown(signal: string): Promise<void> {
  console.log(`[api] shutting down (${signal})`);
  try {
    hyperscaleSyncController?.stop();
    hyperscaleSyncController = null;
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
