import type { BBox } from "@map-migration/geo-kernel/geometry";
import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import { getApiErrorMessage, getApiErrorReason } from "@map-migration/core-runtime/api";
import { runEffectPromise } from "@map-migration/core-runtime/effect";
import type {
  IMap,
  IMapMarker,
  MapClickEvent,
  MapRenderedFeature,
} from "@map-migration/map-engine";
import { getFacilitiesStyleLayerIds } from "@map-migration/map-style";
import { Effect, Either } from "effect";
import { fetchFacilitiesByBboxEffect } from "@/features/facilities/api";
import {
  applyFacilitiesFilter,
  bboxContains,
  emptyFacilitiesSourceData,
  expandBbox,
  filterFacilitiesFeaturesToBbox,
  hasFeatureId,
  isFeatureId,
  quantizeBbox,
  toFacilityId,
} from "@/features/facilities/facilities.service";
import type {
  FacilitiesLayerController,
  FacilitiesLayerOptions,
  FacilitiesLayerState,
  FacilitiesStatus,
  FacilitiesViewMode,
  SelectedFacilityRef,
} from "@/features/facilities/facilities.types";
import {
  buildFacilitiesClusterProperties,
  buildFacilityClusterMarkerModel,
  createFacilityClusterMarkerElement,
  createFacilityClusterMarkerSignature,
  reconcileFacilityClusterMarkers,
} from "@/features/facilities/facilities-cluster.service";
import type { FacilityClusterMarkerModel } from "@/features/facilities/facilities-cluster.types";
import providerLogoMap from "@/features/facilities/provider-logo-map.json";

function defaultPerspective(): FacilityPerspective {
  return "colocation";
}

function toFacilitiesCatalogLayerId(
  perspective: FacilityPerspective
): "facilities.colocation" | "facilities.hyperscale" {
  if (perspective === "hyperscale") {
    return "facilities.hyperscale";
  }

  return "facilities.colocation";
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("[facilities.layer] Failed to create 2d canvas context.");
  }

  return context;
}

interface ClusterMarkerEntry {
  readonly marker: IMapMarker;
  readonly signature: string;
}

export function mountFacilitiesLayer(
  map: IMap,
  options: FacilitiesLayerOptions = {}
): FacilitiesLayerController {
  const perspective = options.perspective ?? defaultPerspective();
  const sourceId = toFacilitiesCatalogLayerId(perspective);
  const styleLayerIds = getFacilitiesStyleLayerIds(sourceId);
  const clusterLayerId = styleLayerIds.clusterLayerId;
  const clusterCountLayerId = styleLayerIds.clusterCountLayerId;
  const pointLayerId = styleLayerIds.pointLayerId;
  const minZoom = options.minZoom ?? 4;
  const limit = options.limit ?? 2000;
  const debounceMs = options.debounceMs ?? 250;
  const fetchPaddingFactor = 0.5;
  const defaultCircleColor = perspective === "hyperscale" ? "#10b981" : "#3b82f6";
  const hoverCircleColor = perspective === "hyperscale" ? "#059669" : "#2563eb";
  const selectedCircleColor = perspective === "hyperscale" ? "#047857" : "#1d4ed8";

  const heatmapLayerId = `${sourceId}.heatmap`;
  const iconFallbackLayerId = `${sourceId}.icon-fallback`;
  const logoBaseUrl = "https://d1cf1x3z5qnthi.cloudfront.net/provider-logos";
  const loadedLogos = new Set<string>();
  const failedLogos = new Set<string>();
  const clusterMarkers = new Map<number, ClusterMarkerEntry>();

  const LOGO_SIZE = 128;

  const normalizeLogoImage = (source: ImageBitmap | HTMLImageElement | ImageData): ImageData => {
    const canvas = document.createElement("canvas");
    canvas.width = LOGO_SIZE;
    canvas.height = LOGO_SIZE;
    const ctx = getCanvasContext(canvas);
    const sw = source.width;
    const sh = source.height;

    // Fit within square, preserving aspect ratio, centered
    const scale = Math.min(LOGO_SIZE / sw, LOGO_SIZE / sh);
    const dw = Math.round(sw * scale);
    const dh = Math.round(sh * scale);
    const dx = Math.round((LOGO_SIZE - dw) / 2);
    const dy = Math.round((LOGO_SIZE - dh) / 2);

    if (source instanceof ImageData) {
      const tmp = document.createElement("canvas");
      tmp.width = sw;
      tmp.height = sh;
      getCanvasContext(tmp).putImageData(source, 0, 0);
      ctx.drawImage(tmp, dx, dy, dw, dh);
    } else {
      ctx.drawImage(source, dx, dy, dw, dh);
    }

    return ctx.getImageData(0, 0, LOGO_SIZE, LOGO_SIZE);
  };

  const loadProviderLogos = async (
    features: FacilitiesFeatureCollection["features"]
  ): Promise<void> => {
    const logoMap = providerLogoMap as Record<string, string>;
    const toLoad: { providerId: string; url: string }[] = [];

    for (const f of features) {
      const pid = String(f.properties?.providerId ?? "");
      if (!pid || loadedLogos.has(pid) || failedLogos.has(pid)) {
        continue;
      }
      const filename = logoMap[pid];
      if (!filename) {
        failedLogos.add(pid);
        continue;
      }
      toLoad.push({
        providerId: pid,
        url: `${logoBaseUrl}/${pid}/${encodeURIComponent(filename)}`,
      });
    }

    if (toLoad.length === 0) {
      return;
    }

    const batch = toLoad.slice(0, 50);
    await Promise.allSettled(
      batch.map(async ({ providerId, url }) => {
        try {
          if (map.hasImage(`logo-${providerId}`)) {
            loadedLogos.add(providerId);
            return;
          }
          const raw = await map.loadImage(url);
          const normalized = normalizeLogoImage(raw);
          if (!map.hasImage(`logo-${providerId}`)) {
            map.addImage(`logo-${providerId}`, normalized);
          }
          loadedLogos.add(providerId);
        } catch {
          failedLogos.add(providerId);
        }
      })
    );
  };

  const state: FacilitiesLayerState = {
    cachedFeatures: [],
    ready: false,
    debounceTimer: null,
    fetchedBbox: null,
    lastRequestId: null,
    lastTruncated: false,
    lastFetchKey: null,
    requestSequence: 0,
    selectedFeatureId: null,
    viewMode: "clusters" as FacilitiesViewMode,
    visible: true,
  };

  const isInteractionEnabled = (): boolean => {
    return options.isInteractionEnabled?.() ?? true;
  };

  const setStatus = (status: FacilitiesStatus): void => {
    options.onStatus?.(status);
  };

  const emitViewportUpdate = (
    features: FacilitiesFeatureCollection["features"],
    requestId: string,
    truncated: boolean
  ): void => {
    options.onViewportUpdate?.({
      perspective,
      features,
      requestId,
      truncated,
    });
  };

  const clearCachedViewport = (): void => {
    state.cachedFeatures = [];
    state.fetchedBbox = null;
    state.lastRequestId = null;
    state.lastTruncated = false;
  };

  const getFilterPredicate = (): ReturnType<
    NonNullable<FacilitiesLayerOptions["filterPredicate"]>
  > => {
    return options.filterPredicate?.() ?? null;
  };

  const getFilteredCachedFeatures = (): FacilitiesFeatureCollection["features"] => {
    return applyFacilitiesFilter(state.cachedFeatures, getFilterPredicate());
  };

  const emitCurrentViewportUpdate = (bbox: BBox): void => {
    const filtered = getFilteredCachedFeatures();
    const viewportFeatures = filterFacilitiesFeaturesToBbox(filtered, bbox);
    const requestId = state.lastRequestId ?? "n/a";
    emitViewportUpdate(viewportFeatures, requestId, state.lastTruncated);
  };

  const readFacilityIdFromProperties = (properties: unknown): string | null => {
    if (typeof properties !== "object" || properties === null) {
      return null;
    }

    const facilityId = Reflect.get(properties, "facilityId");
    return typeof facilityId === "string" && facilityId.length > 0 ? facilityId : null;
  };

  const resolveSelectedFacilityId = (featureId: number | string): string => {
    const cachedFeature = state.cachedFeatures.find((feature) => feature.id === featureId);
    return readFacilityIdFromProperties(cachedFeature?.properties) ?? toFacilityId(featureId);
  };

  const toSelectedFacilityRef = (
    featureId: number | string,
    properties: unknown
  ): SelectedFacilityRef => {
    return {
      facilityId: readFacilityIdFromProperties(properties) ?? resolveSelectedFacilityId(featureId),
      perspective,
    };
  };

  const emitSelectedFacility = (
    featureId: number | string | null,
    selectedFacilityOverride?: SelectedFacilityRef
  ): void => {
    if (featureId === null && typeof selectedFacilityOverride === "undefined") {
      options.onSelectFacility?.(null);
      return;
    }

    options.onSelectFacility?.(
      selectedFacilityOverride ??
        (featureId === null
          ? null
          : {
              facilityId: resolveSelectedFacilityId(featureId),
              perspective,
            })
    );
  };

  const removeFacilitiesLayers = (): void => {
    clearClusterMarkers();

    for (const layerId of [
      heatmapLayerId,
      clusterCountLayerId,
      clusterLayerId,
      pointLayerId,
      iconFallbackLayerId,
    ]) {
      if (map.hasLayer(layerId)) {
        map.removeLayer(layerId);
      }
    }

    if (map.hasSource(sourceId)) {
      map.removeSource(sourceId);
    }
  };

  const clearClusterMarkers = (): void => {
    for (const entry of clusterMarkers.values()) {
      entry.marker.remove();
    }

    clusterMarkers.clear();
  };

  const createClusterMarkerEntry = (
    markerModel: FacilityClusterMarkerModel
  ): ClusterMarkerEntry => {
    return {
      marker: map.createHtmlMarker(createFacilityClusterMarkerElement(markerModel), [
        markerModel.center[0],
        markerModel.center[1],
      ]),
      signature: createFacilityClusterMarkerSignature(markerModel),
    };
  };

  const canRenderClusterMarkers = (): boolean => {
    return (
      state.ready && state.visible && state.viewMode === "clusters" && map.hasLayer(clusterLayerId)
    );
  };

  const getVisibleClusterMarkerModels = (): FacilityClusterMarkerModel[] => {
    const canvasSize = map.getCanvasSize();
    const clusterFeatures = map.queryRenderedFeatures(
      [
        [0, 0],
        [canvasSize.width, canvasSize.height],
      ],
      {
        layers: [clusterLayerId],
      }
    );
    const markerModels: FacilityClusterMarkerModel[] = [];

    for (const feature of clusterFeatures) {
      const markerModel = buildFacilityClusterMarkerModel(feature, perspective);
      if (markerModel === null) {
        continue;
      }

      markerModels.push(markerModel);
    }

    return markerModels;
  };

  const getCurrentClusterMarkerSignatures = (): ReadonlyMap<number, string> => {
    const currentSignatures = new Map<number, string>();
    for (const [clusterId, entry] of clusterMarkers) {
      currentSignatures.set(clusterId, entry.signature);
    }

    return currentSignatures;
  };

  const removeClusterMarker = (clusterId: number): void => {
    const currentMarker = clusterMarkers.get(clusterId);
    if (typeof currentMarker === "undefined") {
      return;
    }

    currentMarker.marker.remove();
    clusterMarkers.delete(clusterId);
  };

  const moveClusterMarkers = (
    markerModels: ReturnType<typeof reconcileFacilityClusterMarkers>["moves"]
  ): void => {
    for (const markerModel of markerModels) {
      const currentMarker = clusterMarkers.get(markerModel.clusterId);
      if (typeof currentMarker === "undefined") {
        continue;
      }

      currentMarker.marker.setLngLat([markerModel.center[0], markerModel.center[1]]);
    }
  };

  const replaceClusterMarkers = (
    markerModels: ReturnType<typeof reconcileFacilityClusterMarkers>["replacements"]
  ): void => {
    for (const markerModel of markerModels) {
      removeClusterMarker(markerModel.clusterId);
      clusterMarkers.set(markerModel.clusterId, createClusterMarkerEntry(markerModel));
    }
  };

  const addClusterMarkers = (
    markerModels: ReturnType<typeof reconcileFacilityClusterMarkers>["additions"]
  ): void => {
    for (const markerModel of markerModels) {
      clusterMarkers.set(markerModel.clusterId, createClusterMarkerEntry(markerModel));
    }
  };

  const syncClusterMarkers = (): void => {
    if (!canRenderClusterMarkers()) {
      clearClusterMarkers();
      return;
    }

    const reconciliation = reconcileFacilityClusterMarkers({
      current: getCurrentClusterMarkerSignatures(),
      nextModels: getVisibleClusterMarkerModels(),
    });

    for (const clusterId of reconciliation.removals) {
      removeClusterMarker(clusterId);
    }

    moveClusterMarkers(reconciliation.moves);
    replaceClusterMarkers(reconciliation.replacements);
    addClusterMarkers(reconciliation.additions);
  };

  const addSourceForMode = (mode: FacilitiesViewMode): void => {
    const useClustering = mode === "clusters";
    map.addSource(sourceId, {
      type: "geojson",
      data: emptyFacilitiesSourceData(),
      ...(useClustering
        ? {
            cluster: true,
            clusterMaxZoom: 12,
            clusterProperties: buildFacilitiesClusterProperties(),
            clusterRadius: 55,
          }
        : {}),
    });
  };

  const addClusterLayers = (): void => {
    map.addLayer({
      id: clusterLayerId,
      type: "circle",
      source: sourceId,
      minzoom: minZoom,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": defaultCircleColor,
        "circle-opacity": 0.001,
        "circle-stroke-opacity": 0.001,
        "circle-stroke-color": "#111827",
        "circle-stroke-width": 1,
        "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 25, 28, 50, 36, 100, 44],
      },
    });
    map.addLayer({
      id: clusterCountLayerId,
      type: "symbol",
      source: sourceId,
      minzoom: minZoom,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["Noto Sans Bold"],
        "text-size": 12,
      },
      paint: {
        "text-color": "#ffffff",
        "text-opacity": 0.001,
      },
    });
    map.addLayer({
      id: pointLayerId,
      type: "circle",
      source: sourceId,
      minzoom: minZoom,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          7,
          ["boolean", ["feature-state", "hover"], false],
          6,
          4,
        ],
        "circle-stroke-width": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          2,
          ["boolean", ["feature-state", "hover"], false],
          2,
          1,
        ],
        "circle-stroke-color": "#111827",
        "circle-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          selectedCircleColor,
          ["boolean", ["feature-state", "hover"], false],
          hoverCircleColor,
          defaultCircleColor,
        ],
      },
    });
  };

  const addHeatmapLayer = (): void => {
    map.addLayer({
      id: heatmapLayerId,
      type: "heatmap",
      source: sourceId,
      minzoom: minZoom,
      paint: {
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 12, 3],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 6, 12, 20],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 1, 14, 0.6],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(0,0,0,0)",
          0.2,
          perspective === "hyperscale" ? "#d1fae5" : "#bfdbfe",
          0.4,
          perspective === "hyperscale" ? "#6ee7b7" : "#93c5fd",
          0.6,
          perspective === "hyperscale" ? "#34d399" : "#60a5fa",
          0.8,
          perspective === "hyperscale" ? "#10b981" : "#3b82f6",
          1,
          perspective === "hyperscale" ? "#047857" : "#1d4ed8",
        ],
      },
    } as unknown as Parameters<typeof map.addLayer>[0]);
  };

  const addDotLayer = (): void => {
    map.addLayer({
      id: pointLayerId,
      type: "circle",
      source: sourceId,
      minzoom: minZoom,
      paint: {
        "circle-radius": 3,
        "circle-stroke-width": 0.5,
        "circle-stroke-color": "#111827",
        "circle-color": defaultCircleColor,
      },
    });
  };

  const addBubbleLayer = (): void => {
    map.addLayer({
      id: pointLayerId,
      type: "circle",
      source: sourceId,
      minzoom: minZoom,
      paint: {
        "circle-radius": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          14,
          ["boolean", ["feature-state", "hover"], false],
          12,
          [
            "interpolate",
            ["linear"],
            ["to-number", ["coalesce", ["get", "powerMW"], 0]],
            0,
            4,
            50,
            10,
            200,
            18,
            500,
            26,
          ],
        ],
        "circle-stroke-width": 1,
        "circle-stroke-color": "#111827",
        "circle-opacity": 0.7,
        "circle-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          selectedCircleColor,
          ["boolean", ["feature-state", "hover"], false],
          hoverCircleColor,
          defaultCircleColor,
        ],
      },
    });
  };

  const addIconLayers = (): void => {
    map.addLayer({
      id: iconFallbackLayerId,
      type: "circle",
      source: sourceId,
      minzoom: minZoom,
      paint: {
        "circle-radius": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          8,
          ["boolean", ["feature-state", "hover"], false],
          7,
          5,
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": defaultCircleColor,
        "circle-color": "#ffffff",
      },
    });
    map.addLayer({
      id: pointLayerId,
      type: "symbol",
      source: sourceId,
      minzoom: minZoom,
      layout: {
        "icon-image": ["concat", "logo-", ["to-string", ["get", "providerId"]]],
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          0.08,
          7,
          0.14,
          10,
          0.22,
          13,
          0.32,
          16,
          0.45,
        ],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-padding": 2,
      },
    } as unknown as Parameters<typeof map.addLayer>[0]);
  };

  const addLayersForMode = (mode: FacilitiesViewMode): void => {
    switch (mode) {
      case "clusters":
        addClusterLayers();
        return;
      case "heatmap":
        addHeatmapLayer();
        return;
      case "dots":
        addDotLayer();
        return;
      case "bubbles":
        addBubbleLayer();
        return;
      case "icons":
        addIconLayers();
        return;
      default:
        return;
    }
  };

  const ensureFacilitiesLayers = (): boolean => {
    try {
      if (!map.hasSource(sourceId)) {
        addSourceForMode(state.viewMode);
      }

      const needsClusterLayers = state.viewMode === "clusters";
      const needsPointLayer = state.viewMode !== "heatmap";
      const needsHeatmapLayer = state.viewMode === "heatmap";

      if (needsClusterLayers && !map.hasLayer(clusterLayerId)) {
        addLayersForMode(state.viewMode);
      } else if (needsHeatmapLayer && !map.hasLayer(heatmapLayerId)) {
        addLayersForMode(state.viewMode);
      } else if (needsPointLayer && !map.hasLayer(pointLayerId)) {
        addLayersForMode(state.viewMode);
      }

      return true;
    } catch {
      return false;
    }
  };

  const setSelectedFeatureId = (
    nextFeatureId: number | string | null,
    selectedFacilityOverride?: SelectedFacilityRef
  ): void => {
    const previousFeatureId = state.selectedFeatureId;
    if (previousFeatureId === nextFeatureId) {
      return;
    }

    if (previousFeatureId !== null) {
      map.setFeatureState(
        {
          source: sourceId,
          id: previousFeatureId,
        },
        { selected: false }
      );
    }

    state.selectedFeatureId = nextFeatureId;

    if (nextFeatureId !== null) {
      map.setFeatureState(
        {
          source: sourceId,
          id: nextFeatureId,
        },
        { selected: true }
      );
    }

    emitSelectedFacility(nextFeatureId, selectedFacilityOverride);
  };

  const clearSelection = (): void => {
    if (!state.ready) {
      state.selectedFeatureId = null;
      emitSelectedFacility(null);
      return;
    }

    setSelectedFeatureId(null);
  };

  const syncSelectionForFeatures = (features: FacilitiesFeatureCollection["features"]): void => {
    const selectedFeatureId = state.selectedFeatureId;
    if (selectedFeatureId === null) {
      return;
    }

    if (!hasFeatureId(features, selectedFeatureId)) {
      setSelectedFeatureId(null);
      return;
    }

    map.setFeatureState(
      {
        source: sourceId,
        id: selectedFeatureId,
      },
      { selected: true }
    );
  };

  const onLoad = (): void => {
    state.ready = true;
    if (!ensureFacilitiesLayers()) {
      clearClusterMarkers();
      return;
    }

    if (!state.visible) {
      map.setGeoJSONSourceData(sourceId, emptyFacilitiesSourceData());
      clearClusterMarkers();
      emitViewportUpdate([], "n/a", false);
      setStatus({ state: "idle" });
      return;
    }

    scheduleRefresh();
  };

  const onMoveEnd = (): void => {
    if (!(state.ready && state.visible)) {
      clearClusterMarkers();
      return;
    }

    syncClusterMarkers();
    scheduleRefresh();
  };

  const ignoreBestEffortAsyncError = (): void => {
    // Best-effort async map work should not interrupt interaction flows.
  };

  const zoomToCluster = (clusterId: number, center: [number, number]): void => {
    map
      .getClusterExpansionZoom(sourceId, clusterId)
      .then((zoom) => {
        map.setViewport({
          type: "center",
          center,
          zoom: Math.min(zoom, 18),
          animate: true,
        });
      })
      .catch(ignoreBestEffortAsyncError);
  };

  const tryHandleClusterClick = (event: MapClickEvent): boolean => {
    if (!(state.viewMode === "clusters" && map.hasLayer(clusterLayerId))) {
      return false;
    }

    const cluster = map.queryRenderedFeatures(event.point, {
      layers: [clusterLayerId],
    })[0];
    const clusterId = cluster?.properties?.cluster_id;
    if (typeof clusterId !== "number") {
      return false;
    }

    zoomToCluster(clusterId, [event.lngLat.lng, event.lngLat.lat]);
    return true;
  };

  const querySelectableLayerIds = (): string[] => {
    const queryLayers = [pointLayerId];
    if (state.viewMode === "icons" && map.hasLayer(iconFallbackLayerId)) {
      queryLayers.push(iconFallbackLayerId);
    }

    return queryLayers;
  };

  const readPointCenter = (coordinates: unknown): readonly [number, number] | null => {
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return null;
    }

    const longitude = coordinates[0];
    const latitude = coordinates[1];
    if (
      typeof longitude !== "number" ||
      !Number.isFinite(longitude) ||
      typeof latitude !== "number" ||
      !Number.isFinite(latitude)
    ) {
      return null;
    }

    return [longitude, latitude];
  };

  const focusSelectedFeature = (feature: MapRenderedFeature): void => {
    const geom = feature.geometry;
    if (geom.type !== "Point") {
      return;
    }

    const center = readPointCenter(geom.coordinates);
    if (center === null) {
      return;
    }

    const currentZoom = map.getZoom();
    const targetZoom = Math.max(currentZoom, 17);
    if (targetZoom <= currentZoom + 0.5) {
      return;
    }

    map.setViewport({
      type: "center",
      center: [center[0], center[1]],
      zoom: targetZoom,
      animate: true,
    });
  };

  const onClick = (event: MapClickEvent): void => {
    if (!(state.ready && state.visible && isInteractionEnabled())) {
      return;
    }

    if (tryHandleClusterClick(event)) {
      return;
    }

    if (!map.hasLayer(pointLayerId)) {
      return;
    }

    const features = map.queryRenderedFeatures(event.point, {
      layers: querySelectableLayerIds(),
    });

    const selectedFeature = features[0];
    if (!(selectedFeature && isFeatureId(selectedFeature.id))) {
      setSelectedFeatureId(null);
      return;
    }

    const selectedFacility = toSelectedFacilityRef(selectedFeature.id, selectedFeature.properties);

    if (selectedFeature.id === state.selectedFeatureId) {
      emitSelectedFacility(selectedFeature.id, selectedFacility);
      focusSelectedFeature(selectedFeature);
      return;
    }

    setSelectedFeatureId(selectedFeature.id, selectedFacility);
    focusSelectedFeature(selectedFeature);
  };

  const resetVisibleFacilitiesData = (): void => {
    map.setGeoJSONSourceData(sourceId, emptyFacilitiesSourceData());
    clearClusterMarkers();
  };

  const clearRefreshState = (): void => {
    clearCachedViewport();
    clearSelection();
    state.lastFetchKey = null;
  };

  const handleRefreshFailure = (args: {
    readonly requestId: string;
    readonly reason: string;
  }): void => {
    resetVisibleFacilitiesData();
    clearRefreshState();
    emitViewportUpdate([], args.requestId, false);
    setStatus({
      state: "error",
      perspective,
      requestId: args.requestId,
      reason: args.reason,
    });
  };

  const hideFacilitiesForZoom = (zoom: number): void => {
    state.requestSequence += 1;
    clearCachedViewport();
    resetVisibleFacilitiesData();
    clearSelection();
    state.lastFetchKey = null;
    emitViewportUpdate([], "n/a", false);
    setStatus({
      state: "hidden",
      zoom,
      minZoom,
    });
  };

  const getFetchKey = (bbox: BBox): string => {
    return `${perspective}:${bbox.west},${bbox.south},${bbox.east},${bbox.north}:${limit}`;
  };

  const emitCoveredViewportStatus = (bbox: BBox): void => {
    emitCurrentViewportUpdate(bbox);
    setStatus({
      state: "ok",
      perspective,
      requestId: state.lastRequestId ?? "n/a",
      count: filterFacilitiesFeaturesToBbox(state.cachedFeatures, bbox).length,
      truncated: state.lastTruncated,
    });
  };

  const applyRefreshResult = (args: {
    readonly bbox: BBox;
    readonly fetchBbox: BBox;
    readonly features: FacilitiesFeatureCollection["features"];
    readonly requestId: string;
    readonly truncated: boolean;
  }): void => {
    state.cachedFeatures = args.features;
    state.fetchedBbox = args.fetchBbox;
    state.lastRequestId = args.requestId;
    state.lastTruncated = args.truncated;
    options.onCachedFeaturesUpdate?.(state.cachedFeatures);

    const filtered = getFilteredCachedFeatures();
    map.setGeoJSONSourceData(sourceId, { type: "FeatureCollection", features: filtered });
    syncClusterMarkers();
    syncSelectionForFeatures(filtered);
    const viewportFeatures = filterFacilitiesFeaturesToBbox(filtered, args.bbox);
    emitViewportUpdate(viewportFeatures, args.requestId, args.truncated);

    setStatus({
      state: "ok",
      perspective,
      requestId: args.requestId,
      count: viewportFeatures.length,
      truncated: args.truncated,
    });

    if (state.viewMode === "icons") {
      loadProviderLogos(filtered).catch(ignoreBestEffortAsyncError);
    }
  };

  const scheduleRefresh = (): void => {
    if (!state.visible) {
      return;
    }

    if (state.debounceTimer) {
      window.clearTimeout(state.debounceTimer);
    }

    state.debounceTimer = window.setTimeout(() => {
      refresh().catch(() => {
        handleRefreshFailure({
          requestId: "n/a",
          reason: "refresh failed",
        });
      });
    }, debounceMs);
  };

  const refresh = async (): Promise<void> => {
    if (!state.visible) {
      return;
    }

    if (!ensureFacilitiesLayers()) {
      state.lastFetchKey = null;
      return;
    }

    const zoom = map.getZoom();
    if (zoom < minZoom) {
      hideFacilitiesForZoom(zoom);
      return;
    }

    const bbox = quantizeBbox(map.getBounds(), 3);
    if (state.fetchedBbox !== null && bboxContains(state.fetchedBbox, bbox)) {
      emitCoveredViewportStatus(bbox);
      return;
    }

    const fetchBbox = quantizeBbox(expandBbox(bbox, fetchPaddingFactor), 3);
    const fetchKey = getFetchKey(fetchBbox);
    if (state.lastFetchKey === fetchKey) {
      return;
    }
    state.lastFetchKey = fetchKey;

    state.requestSequence += 1;
    const sequence = state.requestSequence;

    setStatus({
      state: "loading",
      perspective,
    });

    const result = await runEffectPromise(
      Effect.either(
        fetchFacilitiesByBboxEffect({
          bbox: fetchBbox,
          perspective,
          limit,
        })
      )
    );

    if (sequence !== state.requestSequence) {
      return;
    }

    if (Either.isLeft(result)) {
      if (getApiErrorReason(result.left) === "aborted") {
        return;
      }

      handleRefreshFailure({
        requestId: result.left.requestId,
        reason: getApiErrorMessage(result.left, "refresh failed"),
      });
      return;
    }

    applyRefreshResult({
      bbox,
      fetchBbox,
      features: result.right.data.features,
      requestId: result.right.requestId,
      truncated: result.right.data.meta.truncated,
    });
  };

  const setVisible = (visible: boolean): void => {
    if (state.visible === visible) {
      return;
    }

    state.visible = visible;
    state.requestSequence += 1;
    clearCachedViewport();
    state.lastFetchKey = null;

    if (state.debounceTimer) {
      window.clearTimeout(state.debounceTimer);
    }
    state.debounceTimer = null;

    if (!state.ready) {
      if (!visible) {
        state.selectedFeatureId = null;
        clearCachedViewport();
        emitSelectedFacility(null);
      }
      return;
    }

    if (!ensureFacilitiesLayers()) {
      return;
    }

    if (!visible) {
      map.setGeoJSONSourceData(sourceId, emptyFacilitiesSourceData());
      clearClusterMarkers();
      clearCachedViewport();
      clearSelection();
      emitViewportUpdate([], "n/a", false);
      setStatus({ state: "idle" });
      return;
    }

    scheduleRefresh();
  };

  map.on("load", onLoad);
  map.on("moveend", onMoveEnd);
  map.onClick(onClick);

  const setViewMode = (mode: FacilitiesViewMode): void => {
    if (state.viewMode === mode) {
      return;
    }

    state.viewMode = mode;

    if (!state.ready) {
      return;
    }

    try {
      removeFacilitiesLayers();
      addSourceForMode(mode);
      addLayersForMode(mode);

      if (state.visible && state.cachedFeatures.length > 0) {
        const filtered = getFilteredCachedFeatures();
        map.setGeoJSONSourceData(sourceId, { type: "FeatureCollection", features: filtered });
        syncClusterMarkers();
        syncSelectionForFeatures(filtered);

        if (mode === "icons") {
          loadProviderLogos(filtered).catch(ignoreBestEffortAsyncError);
        }
      } else {
        clearClusterMarkers();
      }
    } catch {
      // If rebuild fails, try to recover
      clearClusterMarkers();
      ensureFacilitiesLayers();
    }
  };

  const applyFilter = (): void => {
    if (!(state.ready && state.visible)) {
      return;
    }

    if (!ensureFacilitiesLayers()) {
      return;
    }

    const filtered = getFilteredCachedFeatures();
    map.setGeoJSONSourceData(sourceId, { type: "FeatureCollection", features: filtered });
    syncClusterMarkers();
    syncSelectionForFeatures(filtered);

    const bbox = quantizeBbox(map.getBounds(), 3);
    emitCurrentViewportUpdate(bbox);

    setStatus({
      state: "ok",
      perspective,
      requestId: state.lastRequestId ?? "n/a",
      count: filterFacilitiesFeaturesToBbox(filtered, bbox).length,
      truncated: state.lastTruncated,
    });
  };

  return {
    applyFilter,
    clearSelection,
    perspective,
    setViewMode,
    setVisible,
    zoomToCluster,
    destroy(): void {
      state.requestSequence += 1;
      clearClusterMarkers();
      clearSelection();

      if (state.debounceTimer) {
        window.clearTimeout(state.debounceTimer);
      }
      state.debounceTimer = null;

      map.off("load", onLoad);
      map.off("moveend", onMoveEnd);
      map.offClick(onClick);
    },
  };
}
