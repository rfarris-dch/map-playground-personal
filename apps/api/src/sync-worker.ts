import { Effect } from "effect";
import { closePostgresPool } from "@/db/postgres";
import { describeEffectDevToolsConnection, runApiEffect } from "@/effect/api-effect-runtime";
import { recordRuntimeEffectFailure } from "@/effect/effect-failure-trail.service";
import { startHyperscaleSyncLoop } from "@/sync/hyperscale-sync.service";
import type { HyperscaleSyncController } from "@/sync/hyperscale-sync.types";
import { startParcelsSyncLoop } from "@/sync/parcels-sync.service";
import type { ParcelsSyncController } from "@/sync/parcels-sync.types";

let hyperscaleSyncController: HyperscaleSyncController | null = null;
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
      if (hyperscaleSyncController !== null) {
        const controller = hyperscaleSyncController;
        yield* Effect.tryPromise(() => controller.stop());
        hyperscaleSyncController = null;
      }

      if (parcelsSyncController !== null) {
        const controller = parcelsSyncController;
        yield* Effect.tryPromise(() => controller.stop());
        parcelsSyncController = null;
      }

      yield* Effect.tryPromise(() => closePostgresPool());
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          process.exit(0);
        })
      )
    )
  );
}

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((error) => {
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
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((error) => {
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
    const [hyperscaleController, parcelsController] = yield* Effect.all(
      [
        startLoopEffect<HyperscaleSyncController>("hyperscale", startHyperscaleSyncLoop),
        startLoopEffect<ParcelsSyncController>("parcels", startParcelsSyncLoop),
      ],
      {
        concurrency: "unbounded",
      }
    );

    hyperscaleSyncController = hyperscaleController;
    parcelsSyncController = parcelsController;

    if (hyperscaleSyncController === null && parcelsSyncController === null) {
      yield* Effect.fail(new Error("all sync loops failed to start"));
    }

    console.log(
      `[api-sync-worker] loops started (hyperscale=${String(hyperscaleSyncController !== null)}, parcels=${String(
        parcelsSyncController !== null
      )})`
    );
  });
}

runApiEffect(startSyncWorkerEffect()).catch((error) => {
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
