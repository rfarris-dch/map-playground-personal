import { runEffectPromise } from "@map-migration/core-runtime/effect";
import type { IMap, MapPointerEvent } from "@map-migration/map-engine";
import { getBoundaryStyleLayerIds } from "@map-migration/map-style";
import { Effect, Either } from "effect";
import { fetchBoundaryPowerEffect } from "@/features/boundaries/api";
import {
  boundaryFillColorExpression,
  boundaryFillOpacity,
  boundaryOutlineColorExpression,
  emptyBoundarySourceData,
} from "@/features/boundaries/boundaries.service";
import type {
  BoundaryLayerController,
  BoundaryLayerOptions,
} from "@/features/boundaries/boundaries.types";
import {
  areSameIncludedRegionIds,
  BASEMAP_BOUNDARY_LAYER_IDS,
  BASEMAP_COUNTRY_LAYER_IDS,
  initialBoundaryLayerState,
  isBoundaryFeatureId,
  lineWidthStops,
  normalizeIncludedRegionIds,
  toFacetOptions,
  toFilteredFeatures,
  toHoverState,
} from "@/features/boundaries/boundaries-layer.service";
import { createFeatureHoverController } from "@/lib/map-feature-hover.service";

const basemapBoundaryHideCountByMap = new WeakMap<IMap, number>();

function isPointerDragging(event: { readonly buttons?: number }): boolean {
  return typeof event.buttons === "number" && event.buttons > 0;
}

export function mountBoundaryLayer(
  map: IMap,
  options: BoundaryLayerOptions
): BoundaryLayerController {
  const layerId = options.layerId;
  const sourceId = `boundaries.${layerId}.source`;
  const styleLayerIds = getBoundaryStyleLayerIds(layerId);
  const fillLayerId = styleLayerIds.fillLayerId;
  const outlineLayerId = styleLayerIds.outlineLayerId;
  const inactiveOutlineColor = layerId === "state" ? "#94a3b8" : "#0f172a";
  const state = initialBoundaryLayerState();

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
            "fill-opacity": state.heatEnabled
              ? [
                  "case",
                  ["boolean", ["feature-state", "hover"], false],
                  Math.min(0.95, boundaryFillOpacity(layerId) + 0.28),
                  boundaryFillOpacity(layerId),
                ]
              : 0,
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
            "line-color": state.heatEnabled
              ? [
                  "case",
                  ["boolean", ["feature-state", "hover"], false],
                  "#0f172a",
                  boundaryOutlineColorExpression(),
                ]
              : inactiveOutlineColor,
            "line-opacity": 0.9,
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
    const currentHideCount = basemapBoundaryHideCountByMap.get(map) ?? 0;
    basemapBoundaryHideCountByMap.set(map, currentHideCount + 1);
    state.basemapLayersSuppressed = true;
    if (currentHideCount > 0) {
      return;
    }

    for (const layerId of BASEMAP_BOUNDARY_LAYER_IDS) {
      map.setLayerVisibility(layerId, false);
    }
  }

  function restoreBasemapBoundaryLayers(): void {
    if (!state.basemapLayersSuppressed) {
      return;
    }

    state.basemapLayersSuppressed = false;
    const currentHideCount = basemapBoundaryHideCountByMap.get(map) ?? 0;
    if (currentHideCount <= 1) {
      basemapBoundaryHideCountByMap.delete(map);
      for (const basemapLayerId of BASEMAP_BOUNDARY_LAYER_IDS) {
        map.setLayerVisibility(basemapLayerId, true);
      }
      return;
    }

    basemapBoundaryHideCountByMap.set(map, currentHideCount - 1);
  }

  async function refreshSourceData(): Promise<void> {
    state.requestSequence += 1;
    const requestSequence = state.requestSequence;
    const result = await runEffectPromise(Effect.either(fetchBoundaryPowerEffect(layerId)));

    if (requestSequence !== state.requestSequence) {
      return;
    }

    if (Either.isLeft(result)) {
      if (result.left._tag === "ApiAbortedError") {
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
    state.allFeatures = result.right.data.features;
    applySourceData();
    options.onFacetOptionsChange?.(layerId, toFacetOptions(state.allFeatures));
    state.dataLoaded = true;
  }

  const hoverController = createFeatureHoverController(map, {
    isInteractionEnabled: options.isInteractionEnabled,
    onHoverChange: options.onHoverChange,
    resolveHoverCandidate(event: MapPointerEvent) {
      if (isPointerDragging(event)) {
        return null;
      }

      if (!(state.ready && state.visible && map.hasLayer(fillLayerId))) {
        return null;
      }

      const features = map.queryRenderedFeatures(event.point, {
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

        return {
          nextHover,
          nextTarget: {
            source: sourceId,
            id: feature.id,
          },
        };
      }

      return null;
    },
  });

  function clearHover(): void {
    hoverController.clear();
  }

  function onLoad(): void {
    state.ready = true;
    hideBasemapBoundaryLayers();
    ensureLayer();
    applyVisibility();

    if (!state.visible) {
      return;
    }

    refreshSourceData().catch(() => {
      clearHover();
      state.allFeatures = [];
      map.setGeoJSONSourceData(sourceId, emptyBoundarySourceData());
      options.onFacetOptionsChange?.(layerId, []);
      state.dataLoaded = false;
    });
  }

  map.on("load", onLoad);

  return {
    clearHover,
    setHeatEnabled(enabled: boolean): void {
      state.heatEnabled = enabled;
      if (map.hasLayer(fillLayerId)) {
        map.setPaintProperty(
          fillLayerId,
          "fill-opacity",
          enabled
            ? [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                Math.min(0.95, boundaryFillOpacity(layerId) + 0.28),
                boundaryFillOpacity(layerId),
              ]
            : 0
        );
      }
      if (map.hasLayer(outlineLayerId)) {
        map.setPaintProperty(
          outlineLayerId,
          "line-color",
          enabled
            ? [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                "#0f172a",
                boundaryOutlineColorExpression(),
              ]
            : inactiveOutlineColor
        );
      }
      if (!enabled) {
        clearHover();
      }
    },
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
      state.requestSequence += 1;
      map.off("load", onLoad);
      clearHover();
      hoverController.destroy();
      restoreBasemapBoundaryLayers();
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
