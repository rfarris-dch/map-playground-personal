import type {
  BoundaryCatalogLayerId,
  BoundaryStyleLayerIds,
  FacilitiesCatalogLayerId,
  FacilitiesStyleLayerIds,
  FloodCatalogLayerId,
  FloodStyleLayerIds,
  HydroBasinsStyleLayerIds,
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
  getFacilitiesStyleLayerIds as readFacilitiesStyleLayerIds,
  getFloodStyleLayerIds as readFloodStyleLayerIds,
  getHydroBasinsStyleLayerIds as readHydroBasinsStyleLayerIds,
  getMarketBoundaryStyleLayerIds as readMarketBoundaryStyleLayerIds,
  getParcelsStyleLayerIds as readParcelsStyleLayerIds,
  getPowerStyleLayerIds as readPowerStyleLayerIds,
} from "./style-layer-ids";

export type {
  BoundaryCatalogLayerId,
  BoundaryStyleLayerIds,
  FacilitiesCatalogLayerId,
  FacilitiesStyleLayerIds,
  FloodCatalogLayerId,
  FloodStyleLayerIds,
  HydroBasinsStyleLayerIds,
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

export function getParcelsStyleLayerIds(): ParcelsStyleLayerIds {
  return readParcelsStyleLayerIds();
}

export function getPowerStyleLayerIds(layerId: PowerCatalogLayerId): readonly string[] {
  return readPowerStyleLayerIds(layerId);
}

export function getCatalogStyleLayerIds(layerId: StaticCatalogLayerId): readonly string[] {
  return readCatalogStyleLayerIds(layerId);
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
