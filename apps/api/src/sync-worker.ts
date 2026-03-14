import { Effect } from "effect";
import { closePostgresPool } from "@/db/postgres";
import { describeEffectDevToolsConnection, runApiEffect } from "@/effect/api-effect-runtime";
import { recordRuntimeEffectFailure } from "@/effect/effect-failure-trail.service";
import { startParcelsSyncLoop } from "@/sync/parcels-sync.service";
import type { ParcelsSyncController } from "@/sync/parcels-sync.types";

let parcelsSyncController: ParcelsSyncController | null = null;
let isShuttingDown = false;
const effectDevToolsConnection = describeEffectDevToolsConnection();

function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return Promise.resolve();
  }

  isShuttingDown = true;
  console.log(`[api-sync-worker] shutting down (${signal})`);
  return runApiEffect(
    Effect.gen(function* () {
      if (parcelsSyncController !== null) {
        const controller = parcelsSyncController;
        yield* Effect.tryPromise(() => controller.stop());
        parcelsSyncController = null;
      }

      yield* Effect.tryPromise(() => closePostgresPool());
    }),
    {
      failureMetadata: {
        source: "api-sync-worker-shutdown",
      },
    }
  );
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
        code: "SYNC_WORKER_SHUTDOWN_FAILURE",
        details: error,
        message: "sync worker shutdown failure",
        source: "api-sync-worker",
      });
      console.error("[api-sync-worker] shutdown failure", error);
      process.exit(1);
    });
}

process.on("SIGINT", () => {
  handleSignalShutdown("SIGINT");
});

process.on("SIGTERM", () => {
  handleSignalShutdown("SIGTERM");
});

function startLoopEffect<TController>(
  label: string,
  start: () => Promise<TController>
): Effect.Effect<TController | null> {
  return Effect.tryPromise(() => start()).pipe(
    Effect.catchAll((error) =>
      Effect.sync(() => {
        recordRuntimeEffectFailure({
          cause:
            error instanceof Error && typeof error.stack === "string" ? error.stack : String(error),
          code: "SYNC_LOOP_START_FAILURE",
          details: error,
          message: `${label} loop failed to start`,
          source: "api-sync-worker",
        });
        console.error(`[api-sync-worker] ${label} loop failed to start`, error);
        return null;
      })
    )
  );
}

function startSyncWorkerEffect(): Effect.Effect<void, Error> {
  return Effect.gen(function* () {
    yield* Effect.sync(() => {
      if (effectDevToolsConnection !== null) {
        console.log(`[api-sync-worker] Effect DevTools enabled (${effectDevToolsConnection})`);
      }
    });
    const parcelsController = yield* startLoopEffect<ParcelsSyncController>(
      "parcels",
      startParcelsSyncLoop
    );

    parcelsSyncController = parcelsController;

    if (parcelsSyncController === null) {
      yield* Effect.fail(new Error("all sync loops failed to start"));
    }

    console.log(
      `[api-sync-worker] loops started (parcels=${String(parcelsSyncController !== null)})`
    );
  });
}

runApiEffect(startSyncWorkerEffect(), {
  failureMetadata: {
    source: "api-sync-worker-startup",
  },
}).catch((error) => {
  recordRuntimeEffectFailure({
    cause: error instanceof Error && typeof error.stack === "string" ? error.stack : String(error),
    code: "SYNC_WORKER_STARTUP_FAILURE",
    details: error,
    message: "sync worker startup failure",
    source: "api-sync-worker",
  });
  console.error("[api-sync-worker] startup failure", error);
  process.exit(1);
});
