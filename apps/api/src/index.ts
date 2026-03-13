import { execFileSync } from "node:child_process";
import { type ServerType, serve } from "@hono/node-server";
import { Effect } from "effect";
import { createApiApp } from "@/app";
import { assertPostgresReady, closePostgresPool, isConnectionClosedError } from "@/db/postgres";
import { describeEffectDevToolsConnection, runApiEffect } from "@/effect/api-effect-runtime";
import { recordRuntimeEffectFailure } from "@/effect/effect-failure-trail.service";
import { readFiberLocatorConfig } from "@/geo/fiber-locator/fiber-locator.service";

interface ApiImportMetaHotData {
  previousShutdownPromise?: Promise<void> | undefined;
}

interface ApiImportMetaHot {
  accept(): void;
  readonly data: ApiImportMetaHotData;
  dispose(callback: (data: ApiImportMetaHotData) => void): void;
}

declare global {
  interface ImportMeta {
    hot?: ApiImportMetaHot;
  }
}

const app = createApiApp();
let server: ServerType | null = null;
let shutdownPromise: Promise<void> | null = null;
const whitespacePattern = /\s+/;
const effectDevToolsConnection = describeEffectDevToolsConnection();
const importMetaHot = import.meta.hot;

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
    // Phase 1: Send SIGTERM to give the old process a chance to clean up gracefully.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const otherPids = listListeningPids(port).filter((pid) => pid !== process.pid);
      if (otherPids.length === 0) {
        return;
      }

      console.warn(`[api] force clearing port ${String(port)} (SIGTERM): ${otherPids.join(", ")}`);
      for (const pid of otherPids) {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          // already exited
        }
      }
      yield* Effect.sleep("500 millis");
    }

    // Phase 2: SIGKILL anything still lingering.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const otherPids = listListeningPids(port).filter((pid) => pid !== process.pid);
      if (otherPids.length === 0) {
        return;
      }

      console.warn(`[api] force clearing port ${String(port)} (SIGKILL): ${otherPids.join(", ")}`);
      killListeningPids(otherPids);
      yield* Effect.sleep("500 millis");
    }

    // Phase 3: Wait for the OS to release the port even after processes are gone.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const otherPids = listListeningPids(port).filter((pid) => pid !== process.pid);
      if (otherPids.length === 0) {
        return;
      }
      yield* Effect.sleep("300 millis");
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

function assertStartupPostgresReadyEffect(): Effect.Effect<void, Error> {
  return Effect.gen(function* () {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        yield* Effect.tryPromise({
          try: assertPostgresReady,
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        });
        return;
      } catch (error) {
        if (!(error instanceof Error && isConnectionClosedError(error)) || attempt === 4) {
          yield* Effect.fail(error instanceof Error ? error : new Error(String(error)));
        }

        console.warn(
          `[api] startup Postgres probe hit a closed connection; retrying (${String(attempt + 1)}/5)`
        );
        yield* Effect.sleep("150 millis");
      }
    }
  });
}

function shutdown(signal: string): Promise<void> {
  if (shutdownPromise !== null) {
    return shutdownPromise;
  }

  console.log(`[api] shutting down (${signal})`);
  shutdownPromise = runApiEffect(
    Effect.gen(function* () {
      yield* closeServerEffect();
      yield* Effect.tryPromise(() => closePostgresPool());
    }),
    {
      failureMetadata: {
        source: "api-server-shutdown",
      },
    }
  );
  return shutdownPromise;
}

function handleSignalShutdown(signal: string): void {
  shutdown(signal)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      recordRuntimeEffectFailure({
        cause:
          error instanceof Error && typeof error.stack === "string" ? error.stack : String(error),
        code: "API_SHUTDOWN_FAILURE",
        details: error,
        message: "api shutdown failure",
        source: "api-server",
      });
      console.error("[api] shutdown failure", error);
      process.exit(1);
    });
}

function handleSigint(): void {
  handleSignalShutdown("SIGINT");
}

function handleSigterm(): void {
  handleSignalShutdown("SIGTERM");
}

function registerProcessSignalHandlers(): void {
  process.on("SIGINT", handleSigint);
  process.on("SIGTERM", handleSigterm);
}

function unregisterProcessSignalHandlers(): void {
  process.off("SIGINT", handleSigint);
  process.off("SIGTERM", handleSigterm);
}

function startServerWithRetry(
  appFetch: typeof app.fetch,
  targetPort: number,
  maxAttempts: number
): Effect.Effect<void, Error> {
  return Effect.gen(function* () {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        server = serve(
          {
            fetch: appFetch,
            hostname: "0.0.0.0",
            port: targetPort,
          },
          (info) => {
            console.log(`[api] listening on http://localhost:${info.port}`);
            console.log(
              `[api] Effect issues: http://localhost:${info.port}/api/debug/effect/issues`
            );
          }
        );
        return;
      } catch (error) {
        const isPortInUse =
          error instanceof Error && /port.*in use|EADDRINUSE/i.test(error.message);
        if (!isPortInUse || attempt === maxAttempts - 1) {
          yield* Effect.fail(error instanceof Error ? error : new Error(String(error)));
        }
        console.warn(
          `[api] port ${String(targetPort)} still busy, retrying (${String(attempt + 1)}/${String(maxAttempts)})`
        );
        yield* Effect.sleep("500 millis");
      }
    }
  });
}

function startServerEffect(): Effect.Effect<void, Error> {
  return Effect.gen(function* () {
    const previousShutdownPromise = importMetaHot?.data.previousShutdownPromise;
    if (previousShutdownPromise) {
      yield* Effect.tryPromise(() => previousShutdownPromise);
      importMetaHot.data.previousShutdownPromise = undefined;
    }
    yield* assertStartupPostgresReadyEffect();
    yield* Effect.try({
      try: () => readFiberLocatorConfig(),
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    });
    yield* forceClearPortBeforeStartEffect(port);
    yield* Effect.sync(() => {
      if (effectDevToolsConnection !== null) {
        console.log(`[api] Effect DevTools enabled (${effectDevToolsConnection})`);
      }
    });
    yield* startServerWithRetry(app.fetch, port, 8);
  });
}

registerProcessSignalHandlers();

if (importMetaHot) {
  importMetaHot.accept();
  importMetaHot.dispose((data) => {
    unregisterProcessSignalHandlers();
    data.previousShutdownPromise = shutdown("HOT_RELOAD");
  });
}

runApiEffect(startServerEffect(), {
  failureMetadata: {
    source: "api-server-startup",
  },
}).catch((error) => {
  recordRuntimeEffectFailure({
    cause: error instanceof Error && typeof error.stack === "string" ? error.stack : String(error),
    code: "API_STARTUP_FAILURE",
    details: error,
    message: "api startup failure",
    source: "api-server",
  });
  console.error("[api] startup failure", error);
  process.exit(1);
});
