import {
  getCountyPowerStoryExtrusionLayerId,
  getCountyPowerStoryStyleLayerIds,
  getFacilitiesStyleLayerIds,
  getFloodStyleLayerIds,
  getHyperscaleLeasedStyleLayerIds,
  getHydroBasinsStyleLayerIds,
  getMarketBoundaryStyleLayerIds,
  getParcelsStyleLayerIds,
} from "../style-layer-ids";
import type { LayerOrderInvariants } from "./layer-order.types";

const countyPowerGridStressStyleLayerIds = getCountyPowerStoryStyleLayerIds(
  "models.county-power-grid-stress"
);
const countyPowerQueuePressureStyleLayerIds = getCountyPowerStoryStyleLayerIds(
  "models.county-power-queue-pressure"
);
const countyPowerMarketStructureStyleLayerIds = getCountyPowerStoryStyleLayerIds(
  "models.county-power-market-structure"
);
const countyPowerPolicyWatchStyleLayerIds = getCountyPowerStoryStyleLayerIds(
  "models.county-power-policy-watch"
);
const countyPowerExtrusionLayerId = getCountyPowerStoryExtrusionLayerId();
const floodStyleLayerIds = getFloodStyleLayerIds("environmental.flood-100");
const hydroBasinsStyleLayerIds = getHydroBasinsStyleLayerIds();
const parcelsOutlineLayerId = getParcelsStyleLayerIds().outlineLayerId;
const colocationPointLayerId = getFacilitiesStyleLayerIds("facilities.colocation").pointLayerId;
const hyperscalePointLayerId = getFacilitiesStyleLayerIds("facilities.hyperscale").pointLayerId;
const enterprisePointLayerId = getFacilitiesStyleLayerIds("facilities.enterprise").pointLayerId;
const hyperscaleLeasedFillLayerId = getHyperscaleLeasedStyleLayerIds().fillLayerId;

export const LAYER_ORDER_INVARIANTS: LayerOrderInvariants = {
  countyPower3dBelowColocation: [countyPowerExtrusionLayerId, colocationPointLayerId],
  countyPower3dBelowHyperscale: [countyPowerExtrusionLayerId, hyperscalePointLayerId],
  countyPowerGridStressBelowColocation: [
    countyPowerGridStressStyleLayerIds.fillLayerId,
    colocationPointLayerId,
  ],
  countyPowerGridStressBelowHyperscale: [
    countyPowerGridStressStyleLayerIds.fillLayerId,
    hyperscalePointLayerId,
  ],
  countyPowerMarketStructureBelowColocation: [
    countyPowerMarketStructureStyleLayerIds.fillLayerId,
    colocationPointLayerId,
  ],
  countyPowerMarketStructureBelowHyperscale: [
    countyPowerMarketStructureStyleLayerIds.fillLayerId,
    hyperscalePointLayerId,
  ],
  countyPowerPolicyWatchBelowColocation: [
    countyPowerPolicyWatchStyleLayerIds.fillLayerId,
    colocationPointLayerId,
  ],
  countyPowerPolicyWatchBelowHyperscale: [
    countyPowerPolicyWatchStyleLayerIds.fillLayerId,
    hyperscalePointLayerId,
  ],
  countyPowerQueuePressureBelowColocation: [
    countyPowerQueuePressureStyleLayerIds.fillLayerId,
    colocationPointLayerId,
  ],
  countyPowerQueuePressureBelowHyperscale: [
    countyPowerQueuePressureStyleLayerIds.fillLayerId,
    hyperscalePointLayerId,
  ],
  flood100BelowParcelOutlines: [floodStyleLayerIds.fill100LayerId, parcelsOutlineLayerId],
  flood500BelowParcelOutlines: [floodStyleLayerIds.fill500LayerId, parcelsOutlineLayerId],
  hydroLabelsBelowFacilityPoints: [
    hydroBasinsStyleLayerIds.labelLayerIds.at(-1) ?? "environmental-hydro-basins-huc10-label",
    colocationPointLayerId,
  ],
  hydroLinesBelowParcelOutlines: [
    hydroBasinsStyleLayerIds.lineLayerIds.at(-1) ?? "environmental-hydro-basins-huc12-line",
    parcelsOutlineLayerId,
  ],
  parcelOutlinesAboveCountyPower3d: [countyPowerExtrusionLayerId, parcelsOutlineLayerId],
  parcelOutlinesAboveCountyPowerGridStress: [
    countyPowerGridStressStyleLayerIds.fillLayerId,
    parcelsOutlineLayerId,
  ],
  parcelOutlinesAboveCountyPowerMarketStructure: [
    countyPowerMarketStructureStyleLayerIds.fillLayerId,
    parcelsOutlineLayerId,
  ],
  parcelOutlinesAboveCountyPowerPolicyWatch: [
    countyPowerPolicyWatchStyleLayerIds.fillLayerId,
    parcelsOutlineLayerId,
  ],
  parcelOutlinesAboveCountyPowerQueuePressure: [
    countyPowerQueuePressureStyleLayerIds.fillLayerId,
    parcelsOutlineLayerId,
  ],
  marketBoundaryBelowColocation: [
    getMarketBoundaryStyleLayerIds("markets.market").fillLayerId,
    colocationPointLayerId,
  ],
  countyPowerGridStressBelowEnterprise: [
    countyPowerGridStressStyleLayerIds.fillLayerId,
    enterprisePointLayerId,
  ],
  countyPowerQueuePressureBelowEnterprise: [
    countyPowerQueuePressureStyleLayerIds.fillLayerId,
    enterprisePointLayerId,
  ],
  countyPowerMarketStructureBelowEnterprise: [
    countyPowerMarketStructureStyleLayerIds.fillLayerId,
    enterprisePointLayerId,
  ],
  countyPowerPolicyWatchBelowEnterprise: [
    countyPowerPolicyWatchStyleLayerIds.fillLayerId,
    enterprisePointLayerId,
  ],
  countyPower3dBelowEnterprise: [countyPowerExtrusionLayerId, enterprisePointLayerId],
  hyperscaleLeasedFillBelowParcelOutlines: [hyperscaleLeasedFillLayerId, parcelsOutlineLayerId],
  submarketBoundaryBelowColocation: [
    getMarketBoundaryStyleLayerIds("markets.submarket").fillLayerId,
    colocationPointLayerId,
  ],
};
