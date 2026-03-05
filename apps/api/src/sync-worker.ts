import { closePostgresPool } from "@/db/postgres";
import { startHyperscaleSyncLoop } from "@/sync/hyperscale-sync.service";
import type { HyperscaleSyncController } from "@/sync/hyperscale-sync.types";
import { startParcelsSyncLoop } from "@/sync/parcels-sync.service";
import type { ParcelsSyncController } from "@/sync/parcels-sync.types";

let hyperscaleSyncController: HyperscaleSyncController | null = null;
let parcelsSyncController: ParcelsSyncController | null = null;

async function shutdown(signal: string): Promise<void> {
  console.log(`[api-sync-worker] shutting down (${signal})`);
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
  hyperscaleSyncController = await startHyperscaleSyncLoop();
  parcelsSyncController = await startParcelsSyncLoop();
  console.log("[api-sync-worker] loops started");
}

startSyncWorker().catch((error) => {
  console.error("[api-sync-worker] startup failure", error);
  process.exit(1);
});
