import type { Hono } from "hono";
import { registerParcelDetailRoute } from "./route/parcel-detail.route";
import { registerParcelsEnrichRoute } from "./route/parcels-enrich.route";
import { registerParcelsLookupRoute } from "./route/parcels-lookup.route";
import { registerParcelsSyncStatusRoute } from "./route/parcels-sync-status.route";

export function registerParcelsRoute(app: Hono): void {
  registerParcelsSyncStatusRoute(app);
  registerParcelsLookupRoute(app);
  registerParcelsEnrichRoute(app);
  registerParcelDetailRoute(app);
}
