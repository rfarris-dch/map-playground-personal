import type {
  BoundaryCatalogLayerId,
  BoundaryStyleLayerIds,
  FacilitiesCatalogLayerId,
  FacilitiesStyleLayerIds,
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

export function getFacilitiesStyleLayerIds(
  layerId: FacilitiesCatalogLayerId
): FacilitiesStyleLayerIds {
  return {
    clusterLayerId: `${layerId}.clusters`,
    clusterCountLayerId: `${layerId}.cluster-count`,
    pointLayerId: `${layerId}.points`,
  };
}

export function getParcelsStyleLayerIds(): ParcelsStyleLayerIds {
  return {
    fillLayerId: "property.parcels.fill",
    outlineLayerId: "property.parcels",
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

  if (layerId === "facilities.colocation" || layerId === "facilities.hyperscale") {
    const facilitiesLayers = getFacilitiesStyleLayerIds(layerId);
    return [
      facilitiesLayers.clusterLayerId,
      facilitiesLayers.clusterCountLayerId,
      facilitiesLayers.pointLayerId,
    ];
  }

  if (
    layerId === "power.transmission" ||
    layerId === "power.substations" ||
    layerId === "power.plants"
  ) {
    return getPowerStyleLayerIds(layerId);
  }

  const parcelsLayers = getParcelsStyleLayerIds();
  return [parcelsLayers.fillLayerId, parcelsLayers.outlineLayerId];
}
