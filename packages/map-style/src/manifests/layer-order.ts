import {
  getFacilitiesStyleLayerIds,
  getFloodStyleLayerIds,
  getHydroBasinsStyleLayerIds,
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
    floodStyleLayerIds.outline100LayerId,
    getParcelsStyleLayerIds().outlineLayerId,
  ],
  flood500BelowParcelOutlines: [
    floodStyleLayerIds.outline500LayerId,
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
  modelsBelowFacilityPoints: [
    "models.facilities",
    getFacilitiesStyleLayerIds("facilities.colocation").pointLayerId,
  ],
};
