import {
  getFacilitiesStyleLayerIds,
  getFloodStyleLayerIds,
  getHydroBasinsStyleLayerIds,
  getMarketBoundaryStyleLayerIds,
  getParcelsStyleLayerIds,
} from "../style-layer-ids";
import type { LayerOrderInvariants } from "./layer-order.types";

const floodStyleLayerIds = getFloodStyleLayerIds("environmental.flood-100");
const hydroBasinsStyleLayerIds = getHydroBasinsStyleLayerIds();

export const LAYER_ORDER_INVARIANTS: LayerOrderInvariants = {
  choroplethBelowColocation: [
    "analytics.friction",
    getFacilitiesStyleLayerIds("facilities.colocation").pointLayerId,
  ],
  choroplethBelowHyperscale: [
    "analytics.friction",
    getFacilitiesStyleLayerIds("facilities.hyperscale").pointLayerId,
  ],
  flood100BelowParcelOutlines: [
    floodStyleLayerIds.fill100LayerId,
    getParcelsStyleLayerIds().outlineLayerId,
  ],
  flood500BelowParcelOutlines: [
    floodStyleLayerIds.fill500LayerId,
    getParcelsStyleLayerIds().outlineLayerId,
  ],
  hydroLabelsBelowFacilityPoints: [
    hydroBasinsStyleLayerIds.labelLayerIds.at(-1) ?? "environmental-hydro-basins-huc10-label",
    getFacilitiesStyleLayerIds("facilities.colocation").pointLayerId,
  ],
  hydroLinesBelowParcelOutlines: [
    hydroBasinsStyleLayerIds.lineLayerIds.at(-1) ?? "environmental-hydro-basins-huc12-line",
    getParcelsStyleLayerIds().outlineLayerId,
  ],
  parcelOutlinesAboveChoropleth: ["analytics.friction", getParcelsStyleLayerIds().outlineLayerId],
  marketBoundaryBelowColocation: [
    getMarketBoundaryStyleLayerIds("markets.market").fillLayerId,
    getFacilitiesStyleLayerIds("facilities.colocation").pointLayerId,
  ],
  submarketBoundaryBelowColocation: [
    getMarketBoundaryStyleLayerIds("markets.submarket").fillLayerId,
    getFacilitiesStyleLayerIds("facilities.colocation").pointLayerId,
  ],
  modelsBelowFacilityPoints: [
    "models.facilities",
    getFacilitiesStyleLayerIds("facilities.colocation").pointLayerId,
  ],
};
