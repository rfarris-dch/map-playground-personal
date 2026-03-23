import type { Env, Hono } from "hono";
import { registerFacilitiesBboxRoute } from "@/geo/facilities/route/facilities-bbox.route";
import { registerFacilitiesDetailRoute } from "@/geo/facilities/route/facilities-detail.route";
import { registerFacilitiesManifestRoute } from "@/geo/facilities/route/facilities-manifest.route";
import { registerFacilitiesPerformanceRoute } from "@/geo/facilities/route/facilities-performance.route";
import { registerFacilitiesProviderLogoRoute } from "@/geo/facilities/route/facilities-provider-logo.route";
import { registerFacilitiesSelectionRoute } from "@/geo/facilities/route/facilities-selection.route";
import { registerFacilitiesTableRoute } from "@/geo/facilities/route/facilities-table.route";

export function registerFacilitiesRoute<E extends Env>(app: Hono<E>): void {
  registerFacilitiesPerformanceRoute(app);
  registerFacilitiesProviderLogoRoute(app);
  registerFacilitiesManifestRoute(app);
  registerFacilitiesBboxRoute(app);
  registerFacilitiesSelectionRoute(app);
  registerFacilitiesTableRoute(app);
  registerFacilitiesDetailRoute(app);
}
