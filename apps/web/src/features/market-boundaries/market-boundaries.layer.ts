import { runEffectPromise } from "@map-migration/core-runtime/effect";
import type { IMap, LngLatBounds, MapClickEvent, MapPointerEvent } from "@map-migration/map-engine";
import { getMarketBoundaryStyleLayerIds } from "@map-migration/map-style";
import { Effect, Either } from "effect";
import { fetchMarketBoundariesEffect } from "@/features/market-boundaries/api";
import {
  buildSubmarketCategoryColorExpression,
  emptyMarketBoundarySourceData,
  marketBoundaryFillColorExpression,
  marketBoundaryFillOpacity,
  marketBoundaryOutlineColorExpression,
} from "@/features/market-boundaries/market-boundaries.service";
import type {
  MarketBoundaryColorMode,
  MarketBoundaryLayerController,
  MarketBoundaryLayerOptions,
} from "@/features/market-boundaries/market-boundaries.types";
import {
  areSameIncludedRegionIds,
  initialMarketBoundaryLayerState,
  isMarketBoundaryFeatureId,
  lineWidthStops,
  normalizeIncludedRegionIds,
  toFacetOptions,
  toFilteredFeatures,
  toHoverState,
} from "@/features/market-boundaries/market-boundaries-layer.service";
import { createFeatureHoverController } from "@/lib/map-feature-hover.service";

function isPointerDragging(event: { readonly buttons?: number }): boolean {
  return typeof event.buttons === "number" && event.buttons > 0;
}

function catalogLayerIdForLevel(
  layerId: "market" | "submarket"
): "markets.market" | "markets.submarket" {
  return layerId === "market" ? "markets.market" : "markets.submarket";
}

export function mountMarketBoundaryLayer(
  map: IMap,
  options: MarketBoundaryLayerOptions
): MarketBoundaryLayerController {
  const layerId = options.layerId;
  const catalogId = catalogLayerIdForLevel(layerId);
  const sourceId = `${catalogId}.source`;
  const styleLayerIds = getMarketBoundaryStyleLayerIds(catalogId);
  const fillLayerId = styleLayerIds.fillLayerId;
  const outlineLayerId = styleLayerIds.outlineLayerId;
  const state = initialMarketBoundaryLayerState(options.colorMode);

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

    setLayersVisible(state.visible);
  }

  function resolveFillColor(): MapExpression {
    if (layerId === "submarket" && state.allFeatures.length > 0) {
      return buildSubmarketCategoryColorExpression(state.allFeatures);
    }

    return marketBoundaryFillColorExpression(state.colorMode);
  }

  function resolveOutlineColor(): MapExpression {
    if (layerId === "submarket" && state.allFeatures.length > 0) {
      return buildSubmarketCategoryColorExpression(state.allFeatures);
    }

    return marketBoundaryOutlineColorExpression(state.colorMode);
  }

  function applyColorMode(): void {
    if (!(state.ready && map.hasLayer(fillLayerId))) {
      return;
    }

    map.setPaintProperty(fillLayerId, "fill-color", resolveFillColor());
    map.setPaintProperty(outlineLayerId, "line-color", [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      "#0f172a",
      resolveOutlineColor(),
    ]);
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
            "fill-color": resolveFillColor(),
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              Math.min(0.95, marketBoundaryFillOpacity(layerId) + 0.28),
              marketBoundaryFillOpacity(layerId),
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
              resolveOutlineColor(),
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

  async function refreshSourceData(): Promise<void> {
    state.requestSequence += 1;
    const requestSequence = state.requestSequence;
    const result = await runEffectPromise(Effect.either(fetchMarketBoundariesEffect(layerId)));

    if (requestSequence !== state.requestSequence) {
      return;
    }

    if (Either.isLeft(result)) {
      if (result.left._tag === "ApiAbortedError") {
        return;
      }

      clearHover();
      state.allFeatures = [];
      map.setGeoJSONSourceData(sourceId, emptyMarketBoundarySourceData());
      options.onFacetOptionsChange?.(layerId, []);
      state.dataLoaded = false;
      return;
    }

    clearHover();
    state.allFeatures = result.right.data.features;
    applySourceData();
    applyColorMode();
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
        if (!isMarketBoundaryFeatureId(feature.id)) {
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

  function accumulateCoordBounds(coords: [number, number][]): LngLatBounds | null {
    let west = Number.POSITIVE_INFINITY;
    let south = Number.POSITIVE_INFINITY;
    let east = Number.NEGATIVE_INFINITY;
    let north = Number.NEGATIVE_INFINITY;

    for (const [lng, lat] of coords) {
      if (lng < west) {
        west = lng;
      }
      if (lng > east) {
        east = lng;
      }
      if (lat < south) {
        south = lat;
      }
      if (lat > north) {
        north = lat;
      }
    }

    if (!(Number.isFinite(west) && Number.isFinite(south))) {
      return null;
    }

    return { west, south, east, north };
  }

  function computeFeatureBounds(feature: { geometry: unknown }): LngLatBounds | null {
    const geom = feature.geometry;
    if (typeof geom !== "object" || geom === null) {
      return null;
    }

    const coords = flattenCoordinates(geom);
    if (coords.length === 0) {
      return null;
    }

    return accumulateCoordBounds(coords);
  }

  function flattenCoordinates(geom: unknown): [number, number][] {
    if (typeof geom !== "object" || geom === null) {
      return [];
    }

    const coordinates = Reflect.get(geom, "coordinates");
    if (!Array.isArray(coordinates)) {
      // Handle GeometryCollection or Multi types
      const geometries = Reflect.get(geom, "geometries");
      if (Array.isArray(geometries)) {
        return geometries.flatMap((g: unknown) => flattenCoordinates(g));
      }

      return [];
    }

    const result: [number, number][] = [];
    collectCoords(coordinates, result);
    return result;
  }

  function collectCoords(arr: unknown[], result: [number, number][]): void {
    if (arr.length >= 2 && typeof arr[0] === "number" && typeof arr[1] === "number") {
      result.push([arr[0], arr[1]]);
      return;
    }

    for (const item of arr) {
      if (Array.isArray(item)) {
        collectCoords(item, result);
      }
    }
  }

  function onClickFill(event: MapClickEvent): void {
    if (!(state.ready && state.visible && map.hasLayer(fillLayerId))) {
      return;
    }

    const features = map.queryRenderedFeatures(event.point, {
      layers: [fillLayerId],
    });

    if (features.length === 0) {
      return;
    }

    const clickedFeature = features[0] as (typeof features)[number] | undefined;
    if (clickedFeature === undefined) {
      return;
    }
    const regionId = clickedFeature.id;
    if (typeof regionId !== "string" && typeof regionId !== "number") {
      return;
    }

    // Find the full feature from allFeatures to get the complete geometry
    const fullFeature = state.allFeatures.find((f) => f.id === String(regionId));
    if (fullFeature === undefined) {
      return;
    }

    const bounds = computeFeatureBounds(fullFeature);
    if (bounds === null) {
      return;
    }

    map.setViewport({
      type: "bounds",
      bounds,
      padding: 80,
      animate: true,
    });
  }

  function onLoad(): void {
    state.ready = true;
    ensureLayer();
    refreshSourceData().catch(() => {
      clearHover();
      state.allFeatures = [];
      map.setGeoJSONSourceData(sourceId, emptyMarketBoundarySourceData());
      options.onFacetOptionsChange?.(layerId, []);
      state.dataLoaded = false;
    });
    applyVisibility();
  }

  map.on("load", onLoad);
  map.onClick(onClickFill);

  return {
    clearHover,
    setColorMode(colorMode: MarketBoundaryColorMode): void {
      if (state.colorMode === colorMode) {
        return;
      }

      state.colorMode = colorMode;
      applyColorMode();
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
          map.setGeoJSONSourceData(sourceId, emptyMarketBoundarySourceData());
          options.onFacetOptionsChange?.(layerId, []);
          state.dataLoaded = false;
        });
      }
    },
    destroy(): void {
      state.requestSequence += 1;
      map.off("load", onLoad);
      map.offClick(onClickFill);
      clearHover();
      hoverController.destroy();
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
