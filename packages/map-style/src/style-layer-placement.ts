import type { IMap } from "@map-migration/map-engine";
import {
  getFacilitiesStyleLayerIds,
  getHyperscaleLeasedStyleLayerIds,
  getParcelsStyleLayerIds,
} from "./style-layer-ids";

function dedupeLayerIds(layerIds: readonly string[]): readonly string[] {
  return [...new Set(layerIds)];
}

function createFacilityPlacementAnchorLayerIds(): readonly string[] {
  const leasedLayers = getHyperscaleLeasedStyleLayerIds();
  const colocationLayers = getFacilitiesStyleLayerIds("facilities.colocation");
  const hyperscaleLayers = getFacilitiesStyleLayerIds("facilities.hyperscale");
  const enterpriseLayers = getFacilitiesStyleLayerIds("facilities.enterprise");

  return dedupeLayerIds([
    leasedLayers.fillLayerId,
    leasedLayers.lineLayerId,
    colocationLayers.heatmapLayerId,
    colocationLayers.clusterLayerId,
    colocationLayers.iconFallbackLayerId,
    colocationLayers.pointLayerId,
    hyperscaleLayers.heatmapLayerId,
    hyperscaleLayers.clusterLayerId,
    hyperscaleLayers.iconFallbackLayerId,
    hyperscaleLayers.pointLayerId,
    enterpriseLayers.heatmapLayerId,
    enterpriseLayers.clusterLayerId,
    enterpriseLayers.iconFallbackLayerId,
    enterpriseLayers.pointLayerId,
  ]);
}

const FACILITY_PLACEMENT_ANCHOR_LAYER_IDS = createFacilityPlacementAnchorLayerIds();

const OVERLAY_PLACEMENT_ANCHOR_LAYER_IDS = dedupeLayerIds([
  ...Object.values(getParcelsStyleLayerIds()),
  ...FACILITY_PLACEMENT_ANCHOR_LAYER_IDS,
]);

export function getFacilityPlacementAnchorLayerIds(): readonly string[] {
  return FACILITY_PLACEMENT_ANCHOR_LAYER_IDS;
}

export function getOverlayPlacementAnchorLayerIds(): readonly string[] {
  return OVERLAY_PLACEMENT_ANCHOR_LAYER_IDS;
}

export function findFirstPresentStyleLayerId(
  map: Pick<IMap, "hasLayer">,
  layerIds: readonly string[]
): string | undefined {
  for (const layerId of layerIds) {
    if (map.hasLayer(layerId)) {
      return layerId;
    }
  }

  return undefined;
}

export function findFirstLabelStyleLayerId(map: Pick<IMap, "getStyle">): string | undefined {
  const styleLayers = map.getStyle().layers ?? [];

  for (const styleLayer of styleLayers) {
    if (styleLayer.type !== "symbol") {
      continue;
    }

    if (styleLayer.id.trim().length > 0) {
      return styleLayer.id;
    }
  }

  return undefined;
}
