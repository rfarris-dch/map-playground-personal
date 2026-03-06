import { type ServerType, serve } from "@hono/node-server";
import { createApiApp } from "@/app";
import { closePostgresPool } from "@/db/postgres";

const app = createApiApp();
let server: ServerType | null = null;
let shutdownPromise: Promise<void> | null = null;

function resolvePort(): number {
  const rawPort = process.env.PORT ?? "3001";
  const parsedPort = Number(rawPort);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error(`PORT must be a positive integer (received "${rawPort}")`);
  }

  return parsedPort;
}

const port = resolvePort();

function closeServer(): Promise<void> {
  const activeServer = server;
  if (activeServer === null) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    activeServer.close((error) => {
      server = null;
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function shutdown(signal: string): Promise<void> {
  if (shutdownPromise !== null) {
    return shutdownPromise;
  }

  console.log(`[api] shutting down (${signal})`);
  shutdownPromise = (async () => {
    await closeServer();
    await closePostgresPool();
  })();
  return shutdownPromise;
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
  server = serve(
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
