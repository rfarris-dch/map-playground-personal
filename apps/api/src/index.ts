import { execFileSync } from "node:child_process";
import { type ServerType, serve } from "@hono/node-server";
import { createApiApp } from "@/app";
import { closePostgresPool } from "@/db/postgres";

const app = createApiApp();
let server: ServerType | null = null;
let shutdownPromise: Promise<void> | null = null;
const whitespacePattern = /\s+/;

function resolvePort(): number {
  const rawPort = process.env.PORT ?? "3001";
  const parsedPort = Number(rawPort);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error(`PORT must be a positive integer (received "${rawPort}")`);
  }

  return parsedPort;
}

const port = resolvePort();

function isForcePortKillEnabled(): boolean {
  return process.env.MAP_FORCE_KILL_PORT_BEFORE_START === "1";
}

function listListeningPids(port: number): number[] {
  try {
    const rawPids = execFileSync("lsof", [`-tiTCP:${String(port)}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (rawPids.length === 0) {
      return [];
    }

    return rawPids
      .split(whitespacePattern)
      .map((rawPid) => Number(rawPid))
      .filter((candidate) => Number.isInteger(candidate) && candidate > 0);
  } catch {
    return [];
  }
}

function killListeningPids(pids: readonly number[]): void {
  for (const pid of pids) {
    if (pid === process.pid) {
      continue;
    }

    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Ignore pids that have already exited between discovery and kill.
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function forceClearPortBeforeStart(port: number): Promise<void> {
  if (!isForcePortKillEnabled()) {
    return;
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const otherPids = listListeningPids(port).filter((pid) => pid !== process.pid);
    if (otherPids.length === 0) {
      return;
    }

    console.warn(`[api] force clearing port ${String(port)}: ${otherPids.join(", ")}`);
    killListeningPids(otherPids);
    await wait(150);
  }

  const remainingPids = listListeningPids(port).filter((pid) => pid !== process.pid);
  if (remainingPids.length > 0) {
    throw new Error(
      `Failed to clear port ${String(port)} before start: ${remainingPids.join(", ")}`
    );
  }
}

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

async function startServer(): Promise<void> {
  await forceClearPortBeforeStart(port);
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
  startServer().catch((error) => {
    console.error("[api] startup failure", error);
    process.exit(1);
  });
} catch (error) {
  console.error("[api] startup failure", error);
  process.exit(1);
}
