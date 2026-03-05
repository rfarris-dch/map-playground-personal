import type { BoundaryPowerFeature } from "@map-migration/contracts";
import type { IMap } from "@map-migration/map-engine";
import { fetchBoundaryPower } from "./api";
import {
  boundaryFillColorExpression,
  boundaryFillOpacity,
  boundaryOutlineColorExpression,
  emptyBoundarySourceData,
} from "./boundaries.service";
import type {
  BoundaryFacetOption,
  BoundaryHoverState,
  BoundaryLayerController,
  BoundaryLayerId,
  BoundaryLayerOptions,
  BoundaryLayerState,
} from "./boundaries.types";

const BASEMAP_BOUNDARY_LAYER_IDS: readonly string[] = [
  "boundary_2",
  "boundary_3",
  "boundary_disputed",
];

const BASEMAP_COUNTRY_LAYER_IDS: readonly string[] = ["boundary_2", "boundary_disputed"];

function initialState(): BoundaryLayerState {
  return {
    allFeatures: [],
    abortController: null,
    dataLoaded: false,
    hoveredFeatureId: null,
    includedRegionIds: null,
    ready: false,
    requestSequence: 0,
    visible: false,
  };
}

function isBoundaryFeatureId(value: unknown): value is string | number {
  return typeof value === "string" || typeof value === "number";
}

function readProperty(properties: unknown, key: string): unknown {
  if (typeof properties !== "object" || properties === null) {
    return null;
  }

  return Reflect.get(properties, key);
}

function readStringProperty(properties: unknown, key: string): string | null {
  const value = readProperty(properties, key);
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function readNumberProperty(properties: unknown, key: string): number | null {
  const value = readProperty(properties, key);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function toHoverState(
  feature: { properties: unknown },
  layerId: BoundaryLayerId,
  screenPoint: readonly [number, number]
): BoundaryHoverState | null {
  const regionId = readStringProperty(feature.properties, "regionId");
  const regionName = readStringProperty(feature.properties, "regionName");
  const commissionedPowerMw = readNumberProperty(feature.properties, "commissionedPowerMw");
  if (regionId === null || regionName === null || commissionedPowerMw === null) {
    return null;
  }

  return {
    boundaryId: layerId,
    regionId,
    regionName,
    parentRegionName: readStringProperty(feature.properties, "parentRegionName"),
    commissionedPowerMw,
    screenPoint,
  };
}

function toFacetOptions(features: readonly BoundaryPowerFeature[]): BoundaryFacetOption[] {
  const options = features.map((feature) => ({
    regionId: feature.properties.regionId,
    regionName: feature.properties.regionName,
    parentRegionName: feature.properties.parentRegionName,
    commissionedPowerMw: feature.properties.commissionedPowerMw,
  }));

  options.sort((a, b) => {
    if (b.commissionedPowerMw !== a.commissionedPowerMw) {
      return b.commissionedPowerMw - a.commissionedPowerMw;
    }

    return a.regionName.localeCompare(b.regionName);
  });

  return options;
}

function normalizeIncludedRegionIds(regionIds: readonly string[] | null): readonly string[] | null {
  if (regionIds === null) {
    return null;
  }

  const deduped = new Set<string>();
  for (const regionId of regionIds) {
    const trimmed = regionId.trim();
    if (trimmed.length === 0) {
      continue;
    }

    deduped.add(trimmed);
  }

  return [...deduped];
}

function areSameIncludedRegionIds(
  left: readonly string[] | null,
  right: readonly string[] | null
): boolean {
  if (left === right) {
    return true;
  }

  if (left === null || right === null) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  for (const [index, value] of left.entries()) {
    if (value !== right[index]) {
      return false;
    }
  }

  return true;
}

function toFilteredFeatures(
  features: readonly BoundaryPowerFeature[],
  includedRegionIds: readonly string[] | null
): readonly BoundaryPowerFeature[] {
  if (includedRegionIds === null) {
    return features;
  }

  if (includedRegionIds.length === 0) {
    return [];
  }

  const included = new Set(includedRegionIds);
  return features.filter((feature) => included.has(feature.properties.regionId));
}

function lineWidthStops(layerId: BoundaryLayerId): {
  readonly highZoom: number;
  readonly lowZoom: number;
  readonly midZoom: number;
} {
  if (layerId === "country") {
    return {
      lowZoom: 2.2,
      midZoom: 2.8,
      highZoom: 3.4,
    };
  }

  if (layerId === "state") {
    return {
      lowZoom: 1.4,
      midZoom: 1.9,
      highZoom: 2.5,
    };
  }

  return {
    lowZoom: 0.85,
    midZoom: 1.15,
    highZoom: 1.6,
  };
}

export function mountBoundaryLayer(
  map: IMap,
  options: BoundaryLayerOptions
): BoundaryLayerController {
  const layerId = options.layerId;
  const sourceId = `boundaries.${layerId}.source`;
  const fillLayerId = `${layerId}.fill`;
  const outlineLayerId = layerId;
  const state = initialState();

  function readStyleLayerId(layer: unknown): string | null {
    if (typeof layer !== "object" || layer === null) {
      return null;
    }

    const maybeLayerId = Reflect.get(layer, "id");
    if (typeof maybeLayerId !== "string" || maybeLayerId.trim().length === 0) {
      return null;
    }

    return maybeLayerId;
  }

  function findFirstLabelLayerId(): string | undefined {
    const style = map.getStyle();
    const styleLayers = style.layers ?? [];

    for (const styleLayer of styleLayers) {
      const layerType = Reflect.get(styleLayer, "type");
      if (layerType !== "symbol") {
        continue;
      }

      const layerIdFromStyle = readStyleLayerId(styleLayer);
      if (typeof layerIdFromStyle === "string") {
        return layerIdFromStyle;
      }
    }

    return undefined;
  }

  function setLayersVisible(visible: boolean): void {
    map.setLayerVisibility(fillLayerId, visible);
    map.setLayerVisibility(outlineLayerId, visible);
  }

  function clearHover(clearOptions: { emit?: boolean } = {}): void {
    const shouldEmit = clearOptions.emit ?? true;

    if (state.hoveredFeatureId === null) {
      return;
    }

    map.setFeatureState(
      {
        source: sourceId,
        id: state.hoveredFeatureId,
      },
      { hover: false }
    );
    state.hoveredFeatureId = null;

    if (shouldEmit) {
      options.onHoverChange?.(null);
    }
  }

  function setHoveredFeature(nextFeatureId: string | number | null): void {
    if (nextFeatureId === state.hoveredFeatureId) {
      return;
    }

    clearHover({ emit: false });
    if (nextFeatureId === null) {
      return;
    }

    map.setFeatureState(
      {
        source: sourceId,
        id: nextFeatureId,
      },
      { hover: true }
    );
    state.hoveredFeatureId = nextFeatureId;
  }

  function applySourceData(): void {
    const filteredFeatures = toFilteredFeatures(state.allFeatures, state.includedRegionIds);
    map.setGeoJSONSourceData(sourceId, {
      type: "FeatureCollection",
      features: filteredFeatures,
    });
  }

  function applyVisibility(): void {
    if (!state.ready) {
      return;
    }

    if (layerId === "country") {
      for (const basemapLayerId of BASEMAP_COUNTRY_LAYER_IDS) {
        map.setLayerVisibility(basemapLayerId, state.visible);
      }
    }

    setLayersVisible(state.visible);
  }

  function ensureLayer(): void {
    if (!map.hasSource(sourceId)) {
      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });
    }

    const labelLayerId = findFirstLabelLayerId();

    if (!map.hasLayer(fillLayerId)) {
      map.addLayer(
        {
          id: fillLayerId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": boundaryFillColorExpression(),
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              Math.min(0.95, boundaryFillOpacity(layerId) + 0.28),
              boundaryFillOpacity(layerId),
            ],
          },
        },
        labelLayerId
      );
    }

    if (!map.hasLayer(outlineLayerId)) {
      const widthStops = lineWidthStops(layerId);
      map.addLayer(
        {
          id: outlineLayerId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              "#0f172a",
              boundaryOutlineColorExpression(),
            ],
            "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.9],
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3,
              widthStops.lowZoom,
              8,
              widthStops.midZoom,
              14,
              widthStops.highZoom,
            ],
          },
        },
        labelLayerId
      );
    }
  }

  function hideBasemapBoundaryLayers(): void {
    for (const layerId of BASEMAP_BOUNDARY_LAYER_IDS) {
      map.setLayerVisibility(layerId, false);
    }
  }

  async function refreshSourceData(): Promise<void> {
    state.requestSequence += 1;
    const requestSequence = state.requestSequence;

    state.abortController?.abort();
    state.abortController = new AbortController();

    const result = await fetchBoundaryPower(layerId, {
      signal: state.abortController.signal,
    });

    if (requestSequence !== state.requestSequence) {
      return;
    }

    if (!result.ok) {
      if (result.reason === "aborted") {
        return;
      }

      clearHover();
      state.allFeatures = [];
      map.setGeoJSONSourceData(sourceId, emptyBoundarySourceData());
      options.onFacetOptionsChange?.(layerId, []);
      state.dataLoaded = false;
      return;
    }

    clearHover();
    state.allFeatures = result.data.features;
    applySourceData();
    options.onFacetOptionsChange?.(layerId, toFacetOptions(state.allFeatures));
    state.dataLoaded = true;
  }

  function onPointerMove(event: { point: readonly [number, number] }): void {
    if (!(options.isInteractionEnabled?.() ?? true)) {
      clearHover();
      return;
    }

    if (!(state.ready && state.visible)) {
      clearHover();
      return;
    }

    if (!map.hasLayer(fillLayerId)) {
      clearHover();
      return;
    }

    const queryPoint: [number, number] = [event.point[0], event.point[1]];
    const features = map.queryRenderedFeatures(queryPoint, {
      layers: [fillLayerId],
    });
    const screenPoint: readonly [number, number] = [event.point[0], event.point[1]];

    for (const feature of features) {
      if (!isBoundaryFeatureId(feature.id)) {
        continue;
      }

      const nextHover = toHoverState(feature, layerId, screenPoint);
      if (nextHover === null) {
        continue;
      }

      setHoveredFeature(feature.id);
      options.onHoverChange?.(nextHover);
      return;
    }

    clearHover();
  }

  function onPointerLeave(): void {
    clearHover();
  }

  function onLoad(): void {
    state.ready = true;
    hideBasemapBoundaryLayers();
    ensureLayer();
    refreshSourceData().catch(() => {
      clearHover();
      state.allFeatures = [];
      map.setGeoJSONSourceData(sourceId, emptyBoundarySourceData());
      options.onFacetOptionsChange?.(layerId, []);
      state.dataLoaded = false;
    });
    applyVisibility();
  }

  map.on("load", onLoad);
  map.onPointerMove(onPointerMove);
  map.onPointerLeave(onPointerLeave);

  return {
    clearHover,
    setIncludedRegionIds(regionIds: readonly string[] | null): void {
      const normalizedRegionIds = normalizeIncludedRegionIds(regionIds);
      if (areSameIncludedRegionIds(state.includedRegionIds, normalizedRegionIds)) {
        return;
      }

      state.includedRegionIds = normalizedRegionIds;
      if (!state.ready) {
        return;
      }

      clearHover();
      applySourceData();
    },
    setVisible(visible: boolean): void {
      state.visible = visible;
      applyVisibility();
      if (!state.visible) {
        clearHover();
      }

      if (state.visible && state.ready && !state.dataLoaded) {
        refreshSourceData().catch(() => {
          clearHover();
          state.allFeatures = [];
          map.setGeoJSONSourceData(sourceId, emptyBoundarySourceData());
          options.onFacetOptionsChange?.(layerId, []);
          state.dataLoaded = false;
        });
      }
    },
    destroy(): void {
      map.off("load", onLoad);
      map.offPointerMove(onPointerMove);
      map.offPointerLeave(onPointerLeave);
      state.abortController?.abort();
      state.abortController = null;
      clearHover();
      if (map.hasLayer(fillLayerId)) {
        map.removeLayer(fillLayerId);
      }
      if (map.hasLayer(outlineLayerId)) {
        map.removeLayer(outlineLayerId);
      }
      if (map.hasSource(sourceId)) {
        map.removeSource(sourceId);
      }
    },
  };
}
