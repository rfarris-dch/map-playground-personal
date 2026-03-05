import type { Env, Hono } from "hono";
import { registerFacilitiesBboxRoute } from "@/geo/facilities/route/facilities-bbox.route";
import { registerFacilitiesDetailRoute } from "@/geo/facilities/route/facilities-detail.route";
import { registerFacilitiesSelectionRoute } from "@/geo/facilities/route/facilities-selection.route";
import { registerFacilitiesTableRoute } from "@/geo/facilities/route/facilities-table.route";

export function registerFacilitiesRoute<E extends Env>(app: Hono<E>): void {
  registerFacilitiesBboxRoute(app);
  registerFacilitiesSelectionRoute(app);
  registerFacilitiesTableRoute(app);
  registerFacilitiesDetailRoute(app);
}
