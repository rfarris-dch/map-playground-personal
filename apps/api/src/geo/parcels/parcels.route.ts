import type { Env, Hono } from "hono";
import { registerParcelDetailRoute } from "@/geo/parcels/route/parcel-detail.route";
import { registerParcelsEnrichRoute } from "@/geo/parcels/route/parcels-enrich.route";
import { registerParcelsLookupRoute } from "@/geo/parcels/route/parcels-lookup.route";

export function registerParcelsRoute<E extends Env>(app: Hono<E>): void {
  registerParcelsLookupRoute(app);
  registerParcelsEnrichRoute(app);
  registerParcelDetailRoute(app);
}
