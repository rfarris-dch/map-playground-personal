import { getFacilitiesStyleLayerIds, getParcelsStyleLayerIds } from "@/style-layer-ids";
import type { LayerOrderInvariants } from "./layer-order.types";

export const LAYER_ORDER_INVARIANTS: LayerOrderInvariants = {
  choroplethBelowColocation: [
    "analytics.friction",
    getFacilitiesStyleLayerIds("facilities.colocation").pointLayerId,
  ],
  choroplethBelowHyperscale: [
    "analytics.friction",
    getFacilitiesStyleLayerIds("facilities.hyperscale").pointLayerId,
  ],
  parcelOutlinesAboveChoropleth: ["analytics.friction", getParcelsStyleLayerIds().outlineLayerId],
  modelsBelowFacilityPoints: [
    "models.facilities",
    getFacilitiesStyleLayerIds("facilities.colocation").pointLayerId,
  ],
};
