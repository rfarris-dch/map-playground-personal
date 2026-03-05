import type { LayerOrderInvariants } from "./layer-order.types";

export const LAYER_ORDER_INVARIANTS: LayerOrderInvariants = {
  choroplethBelowColocation: ["analytics.friction", "facilities.colocation.points"],
  choroplethBelowHyperscale: ["analytics.friction", "facilities.hyperscale.points"],
  parcelOutlinesAboveChoropleth: ["analytics.friction", "property.parcels"],
  modelsBelowFacilityPoints: ["models.facilities", "facilities.colocation.points"],
};
