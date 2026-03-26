import type {
  BoundaryCatalogLayerId,
  BoundaryStyleLayerIds,
  CountyPowerStoryCatalogLayerId,
  CountyPowerStoryStyleLayerIds,
  FacilitiesCatalogLayerId,
  FacilitiesStyleLayerIds,
  FloodCatalogLayerId,
  FloodStyleLayerIds,
  HydroBasinsStyleLayerIds,
  HyperscaleLeasedStyleLayerIds,
  MarketBoundaryCatalogLayerId,
  MarketBoundaryStyleLayerIds,
  ParcelsStyleLayerIds,
  PowerCatalogLayerId,
  StaticCatalogLayerId,
  StyleDocument,
} from "./index.types";
import { LAYER_ORDER_INVARIANTS } from "./manifests/layer-order";
import {
  getBoundaryStyleLayerIds as readBoundaryStyleLayerIds,
  getCatalogStyleLayerIds as readCatalogStyleLayerIds,
  getCountyPowerStoryExtrusionLayerId as readCountyPowerStoryExtrusionLayerId,
  getCountyPowerStoryStyleLayerIds as readCountyPowerStoryStyleLayerIds,
  getFacilitiesStyleLayerIds as readFacilitiesStyleLayerIds,
  getFloodStyleLayerIds as readFloodStyleLayerIds,
  getHydroBasinsStyleLayerIds as readHydroBasinsStyleLayerIds,
  getHyperscaleLeasedStyleLayerIds as readHyperscaleLeasedStyleLayerIds,
  getMarketBoundaryStyleLayerIds as readMarketBoundaryStyleLayerIds,
  getParcelsStyleLayerIds as readParcelsStyleLayerIds,
  getPowerStyleLayerIds as readPowerStyleLayerIds,
} from "./style-layer-ids";
import {
  getFacilityPlacementAnchorLayerIds as readFacilityPlacementAnchorLayerIds,
  findFirstLabelStyleLayerId as readFirstLabelStyleLayerId,
  findFirstPresentStyleLayerId as readFirstPresentStyleLayerId,
  getOverlayPlacementAnchorLayerIds as readOverlayPlacementAnchorLayerIds,
} from "./style-layer-placement";

export type {
  BoundaryCatalogLayerId,
  BoundaryStyleLayerIds,
  CountyPowerStoryCatalogLayerId,
  CountyPowerStoryStyleLayerIds,
  FacilitiesCatalogLayerId,
  FacilitiesStyleLayerIds,
  FloodCatalogLayerId,
  FloodStyleLayerIds,
  HydroBasinsStyleLayerIds,
  HyperscaleLeasedCatalogLayerId,
  HyperscaleLeasedStyleLayerIds,
  MarketBoundaryCatalogLayerId,
  MarketBoundaryStyleLayerIds,
  ParcelsStyleLayerIds,
  PowerCatalogLayerId,
  StaticCatalogLayerId,
  StyleDocument,
  StyleLayer,
} from "./index.types";

export function getBoundaryStyleLayerIds(layerId: BoundaryCatalogLayerId): BoundaryStyleLayerIds {
  return readBoundaryStyleLayerIds(layerId);
}

export function getCountyPowerStoryStyleLayerIds(
  layerId: CountyPowerStoryCatalogLayerId
): CountyPowerStoryStyleLayerIds {
  return readCountyPowerStoryStyleLayerIds(layerId);
}

export function getCountyPowerStoryExtrusionLayerId(): string {
  return readCountyPowerStoryExtrusionLayerId();
}

export function getFloodStyleLayerIds(layerId: FloodCatalogLayerId): FloodStyleLayerIds {
  return readFloodStyleLayerIds(layerId);
}

export function getFacilitiesStyleLayerIds(
  layerId: FacilitiesCatalogLayerId
): FacilitiesStyleLayerIds {
  return readFacilitiesStyleLayerIds(layerId);
}

export function getHydroBasinsStyleLayerIds(): HydroBasinsStyleLayerIds {
  return readHydroBasinsStyleLayerIds();
}

export function getMarketBoundaryStyleLayerIds(
  layerId: MarketBoundaryCatalogLayerId
): MarketBoundaryStyleLayerIds {
  return readMarketBoundaryStyleLayerIds(layerId);
}

export function getHyperscaleLeasedStyleLayerIds(): HyperscaleLeasedStyleLayerIds {
  return readHyperscaleLeasedStyleLayerIds();
}

export function getParcelsStyleLayerIds(): ParcelsStyleLayerIds {
  return readParcelsStyleLayerIds();
}

export function getPowerStyleLayerIds(layerId: PowerCatalogLayerId): readonly string[] {
  return readPowerStyleLayerIds(layerId);
}

export function getCatalogStyleLayerIds(layerId: StaticCatalogLayerId): readonly string[] {
  return readCatalogStyleLayerIds(layerId);
}

export function getFacilityPlacementAnchorLayerIds(): readonly string[] {
  return readFacilityPlacementAnchorLayerIds();
}

export function getOverlayPlacementAnchorLayerIds(): readonly string[] {
  return readOverlayPlacementAnchorLayerIds();
}

export function findFirstPresentStyleLayerId(
  map: Parameters<typeof readFirstPresentStyleLayerId>[0],
  layerIds: Parameters<typeof readFirstPresentStyleLayerId>[1]
): string | undefined {
  return readFirstPresentStyleLayerId(map, layerIds);
}

export function findFirstLabelStyleLayerId(
  map: Parameters<typeof readFirstLabelStyleLayerId>[0]
): string | undefined {
  return readFirstLabelStyleLayerId(map);
}

export function createBaseStyle(name = "Map Platform Core"): StyleDocument {
  return {
    version: 8,
    name,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": "#f8f7f3",
        },
      },
    ],
  };
}

export function validateLayerOrder(layerIds: string[]): string[] {
  const failures: string[] = [];

  for (const [key, [mustComeFirst, mustComeSecond]] of Object.entries(LAYER_ORDER_INVARIANTS)) {
    const first = layerIds.indexOf(mustComeFirst);
    const second = layerIds.indexOf(mustComeSecond);

    if (first >= 0 && second >= 0 && first >= second) {
      failures.push(`${key} failed: ${mustComeFirst} must be before ${mustComeSecond}`);
    }
  }

  return failures;
}
