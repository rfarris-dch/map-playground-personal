import { execFileSync } from "node:child_process";
import { type ServerType, serve } from "@hono/node-server";
import { Effect } from "effect";
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

function forceClearPortBeforeStartEffect(port: number): Effect.Effect<void, Error> {
  if (!isForcePortKillEnabled()) {
    return Effect.void;
  }

  return Effect.gen(function* () {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const otherPids = listListeningPids(port).filter((pid) => pid !== process.pid);
      if (otherPids.length === 0) {
        return;
      }

      console.warn(`[api] force clearing port ${String(port)}: ${otherPids.join(", ")}`);
      killListeningPids(otherPids);
      yield* Effect.sleep("150 millis");
    }

    const remainingPids = listListeningPids(port).filter((pid) => pid !== process.pid);
    if (remainingPids.length > 0) {
      yield* Effect.fail(
        new Error(`Failed to clear port ${String(port)} before start: ${remainingPids.join(", ")}`)
      );
    }
  });
}

function closeServerEffect(): Effect.Effect<void, Error> {
  const activeServer = server;
  if (activeServer === null) {
    return Effect.void;
  }

  return Effect.async<void, Error>((resume) => {
    activeServer.close((error) => {
      server = null;
      resume(error ? Effect.fail(error) : Effect.void);
    });
  });
}

function shutdown(signal: string): Promise<void> {
  if (shutdownPromise !== null) {
    return shutdownPromise;
  }

  console.log(`[api] shutting down (${signal})`);
  shutdownPromise = Effect.runPromise(
    Effect.gen(function* () {
      yield* closeServerEffect();
      yield* Effect.tryPromise(() => closePostgresPool());
    })
  );
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

function startServerEffect(): Effect.Effect<void, Error> {
  return Effect.gen(function* () {
    yield* forceClearPortBeforeStartEffect(port);
    server = serve(
      {
        fetch: app.fetch,
        port,
      },
      (info) => {
        console.log(`[api] listening on http://localhost:${info.port}`);
      }
    );
  });
}

Effect.runPromise(startServerEffect()).catch((error) => {
  console.error("[api] startup failure", error);
  process.exit(1);
});
