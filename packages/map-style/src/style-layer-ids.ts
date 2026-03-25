import type {
  BoundaryCatalogLayerId,
  BoundaryStyleLayerIds,
  CountyPowerStoryCatalogLayerId,
  CountyPowerStoryStyleLayerIds,
  FacilitiesCatalogLayerId,
  FacilitiesStyleLayerIds,
  FloodCatalogLayerId,
  FloodStyleLayerIds,
  HyperscaleLeasedStyleLayerIds,
  HydroBasinsStyleLayerIds,
  MarketBoundaryCatalogLayerId,
  MarketBoundaryStyleLayerIds,
  ParcelsStyleLayerIds,
  PowerCatalogLayerId,
  StaticCatalogLayerId,
} from "./index.types";

export function getBoundaryStyleLayerIds(layerId: BoundaryCatalogLayerId): BoundaryStyleLayerIds {
  return {
    fillLayerId: `${layerId}.fill`,
    outlineLayerId: layerId,
  };
}

export function getCountyPowerStoryStyleLayerIds(
  layerId: CountyPowerStoryCatalogLayerId
): CountyPowerStoryStyleLayerIds {
  return {
    fillLayerId: `${layerId}.fill`,
    outlineLayerId: `${layerId}.outline`,
  };
}

export function getCountyPowerStoryExtrusionLayerId(): string {
  return "models.county-power-3d.fill-extrusion";
}

export function getFloodStyleLayerIds(_: FloodCatalogLayerId): FloodStyleLayerIds {
  return {
    fill100LayerId: "environmental-flood-100-fill",
    fill500LayerId: "environmental-flood-500-fill",
  };
}

export function getFacilitiesStyleLayerIds(
  layerId: FacilitiesCatalogLayerId
): FacilitiesStyleLayerIds {
  return {
    clusterLayerId: `${layerId}.clusters`,
    clusterCountLayerId: `${layerId}.cluster-count`,
    pointLayerId: `${layerId}.points`,
  };
}

export function getHyperscaleLeasedStyleLayerIds(): HyperscaleLeasedStyleLayerIds {
  return {
    fillLayerId: "hyperscale-leased-voronoi.fill",
    lineLayerId: "hyperscale-leased-voronoi.line",
  };
}

export function getParcelsStyleLayerIds(): ParcelsStyleLayerIds {
  return {
    fillLayerId: "property.parcels.fill",
    outlineLayerId: "property.parcels",
  };
}

export function getHydroBasinsStyleLayerIds(): HydroBasinsStyleLayerIds {
  return {
    lineLayerIds: [
      "environmental-hydro-basins-huc4-line",
      "environmental-hydro-basins-huc6-line",
      "environmental-hydro-basins-huc8-line",
      "environmental-hydro-basins-huc10-line",
      "environmental-hydro-basins-huc12-line",
    ],
    labelLayerIds: [
      "environmental-hydro-basins-huc4-label",
      "environmental-hydro-basins-huc6-label",
      "environmental-hydro-basins-huc8-label",
      "environmental-hydro-basins-huc10-label",
    ],
  };
}

export function getMarketBoundaryStyleLayerIds(
  layerId: MarketBoundaryCatalogLayerId
): MarketBoundaryStyleLayerIds {
  return {
    fillLayerId: `${layerId}.fill`,
    outlineLayerId: layerId,
  };
}

export function getPowerStyleLayerIds(layerId: PowerCatalogLayerId): readonly string[] {
  if (layerId === "power.transmission") {
    return ["power.transmission"];
  }

  if (layerId === "power.substations") {
    return ["power.substations-area", "power.substations"];
  }

  return ["power.plants-area", "power.plants"];
}

export function getCatalogStyleLayerIds(layerId: StaticCatalogLayerId): readonly string[] {
  if (layerId === "county" || layerId === "state" || layerId === "country") {
    const boundaryLayers = getBoundaryStyleLayerIds(layerId);
    return [boundaryLayers.fillLayerId, boundaryLayers.outlineLayerId];
  }

  if (layerId === "environmental.flood-100" || layerId === "environmental.flood-500") {
    const floodLayers = getFloodStyleLayerIds(layerId);
    if (layerId === "environmental.flood-100") {
      return [floodLayers.fill100LayerId];
    }

    return [floodLayers.fill500LayerId];
  }

  if (layerId === "environmental.hydro-basins") {
    const hydroLayerIds = getHydroBasinsStyleLayerIds();
    return [...hydroLayerIds.lineLayerIds, ...hydroLayerIds.labelLayerIds];
  }

  if (
    layerId === "facilities.colocation" ||
    layerId === "facilities.hyperscale" ||
    layerId === "facilities.enterprise"
  ) {
    const facilitiesLayers = getFacilitiesStyleLayerIds(layerId);
    return [
      facilitiesLayers.clusterLayerId,
      facilitiesLayers.clusterCountLayerId,
      facilitiesLayers.pointLayerId,
    ];
  }

  if (layerId === "facilities.hyperscale-leased") {
    const leasedLayers = getHyperscaleLeasedStyleLayerIds();
    return [leasedLayers.fillLayerId, leasedLayers.lineLayerId];
  }

  if (
    layerId === "power.transmission" ||
    layerId === "power.substations" ||
    layerId === "power.plants"
  ) {
    return getPowerStyleLayerIds(layerId);
  }

  if (layerId === "markets.market" || layerId === "markets.submarket") {
    const marketLayers = getMarketBoundaryStyleLayerIds(layerId);
    return [marketLayers.fillLayerId, marketLayers.outlineLayerId];
  }

  if (layerId === "environmental.water-features") {
    return ["environmental.water-features"];
  }

  if (layerId === "property.parcels") {
    const parcelsLayers = getParcelsStyleLayerIds();
    return [parcelsLayers.fillLayerId, parcelsLayers.outlineLayerId];
  }

  const _exhaustive: never = layerId;
  throw new Error(`Unsupported catalog layer ID: ${_exhaustive}`);
}
