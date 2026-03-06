import { closePostgresPool } from "@/db/postgres";
import { startHyperscaleSyncLoop } from "@/sync/hyperscale-sync.service";
import type { HyperscaleSyncController } from "@/sync/hyperscale-sync.types";
import { startParcelsSyncLoop } from "@/sync/parcels-sync.service";
import type { ParcelsSyncController } from "@/sync/parcels-sync.types";

let hyperscaleSyncController: HyperscaleSyncController | null = null;
let parcelsSyncController: ParcelsSyncController | null = null;
let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`[api-sync-worker] shutting down (${signal})`);
  try {
    await hyperscaleSyncController?.stop();
    hyperscaleSyncController = null;
    await parcelsSyncController?.stop();
    parcelsSyncController = null;
    await closePostgresPool();
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((error) => {
    console.error("[api-sync-worker] shutdown failure", error);
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((error) => {
    console.error("[api-sync-worker] shutdown failure", error);
    process.exit(1);
  });
});

async function startSyncWorker(): Promise<void> {
  const startupResults = await Promise.allSettled([
    startHyperscaleSyncLoop(),
    startParcelsSyncLoop(),
  ]);

  const hyperscaleResult = startupResults[0];
  if (hyperscaleResult?.status === "fulfilled") {
    hyperscaleSyncController = hyperscaleResult.value;
  } else {
    console.error("[api-sync-worker] hyperscale loop failed to start", hyperscaleResult?.reason);
  }

  const parcelsResult = startupResults[1];
  if (parcelsResult?.status === "fulfilled") {
    parcelsSyncController = parcelsResult.value;
  } else {
    console.error("[api-sync-worker] parcels loop failed to start", parcelsResult?.reason);
  }

  if (hyperscaleSyncController === null && parcelsSyncController === null) {
    throw new Error("all sync loops failed to start");
  }

  console.log(
    `[api-sync-worker] loops started (hyperscale=${String(hyperscaleSyncController !== null)}, parcels=${String(
      parcelsSyncController !== null
    )})`
  );
}

startSyncWorker().catch((error) => {
  console.error("[api-sync-worker] startup failure", error);
  process.exit(1);
});
