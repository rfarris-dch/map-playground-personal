import { serve } from "@hono/node-server";
import { createApiApp } from "@/app";
import { closePostgresPool } from "@/db/postgres";

const app = createApiApp();

const port = Number(process.env.PORT ?? 3001);

async function shutdown(signal: string): Promise<void> {
  console.log(`[api] shutting down (${signal})`);
  try {
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

function startServer(): void {
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

try {
  startServer();
} catch (error) {
  console.error("[api] startup failure", error);
  process.exit(1);
}
