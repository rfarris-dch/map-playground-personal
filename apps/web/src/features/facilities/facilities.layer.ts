import type { FacilitiesFeatureCollection, FacilityPerspective } from "@map-migration/contracts";
import type { IMap, MapClickEvent } from "@map-migration/map-engine";
import { getFacilitiesStyleLayerIds } from "@map-migration/map-style";
import { fetchFacilitiesByBbox } from "@/features/facilities/api";
import {
  emptyFacilitiesSourceData,
  facilitiesCollectionToSourceData,
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
} from "@/features/facilities/facilities.types";

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
  const defaultCircleColor = perspective === "hyperscale" ? "#f97316" : "#3b82f6";
  const hoverCircleColor = perspective === "hyperscale" ? "#ea580c" : "#2563eb";
  const selectedCircleColor = perspective === "hyperscale" ? "#c2410c" : "#1d4ed8";

  const state: FacilitiesLayerState = {
    ready: false,
    debounceTimer: null,
    abortController: null,
    lastFetchKey: null,
    requestSequence: 0,
    selectedFeatureId: null,
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

  const emitSelectedFacility = (featureId: number | string | null): void => {
    if (featureId === null) {
      options.onSelectFacility?.(null);
      return;
    }

    options.onSelectFacility?.({
      facilityId: toFacilityId(featureId),
      perspective,
    });
  };

  const setSelectedFeatureId = (nextFeatureId: number | string | null): void => {
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

    emitSelectedFacility(nextFeatureId);
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

    map.addSource(sourceId, {
      type: "geojson",
      data: emptyFacilitiesSourceData(),
      cluster: true,
      clusterRadius: 55,
      clusterMaxZoom: 12,
    });

    map.addLayer({
      id: clusterLayerId,
      type: "circle",
      source: sourceId,
      minzoom: minZoom,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": defaultCircleColor,
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

    if (!state.visible) {
      map.setGeoJSONSourceData(sourceId, emptyFacilitiesSourceData());
      emitViewportUpdate([], "n/a", false);
      setStatus({ state: "idle" });
      return;
    }

    scheduleRefresh();
  };

  const onMoveEnd = (): void => {
    if (!(state.ready && state.visible)) {
      return;
    }

    scheduleRefresh();
  };

  const onClick = (event: MapClickEvent): void => {
    if (!(state.ready && state.visible && isInteractionEnabled())) {
      return;
    }

    const features = map.queryRenderedFeatures(event.point, {
      layers: [pointLayerId],
    });

    const selectedFeature = features[0];
    if (!(selectedFeature && isFeatureId(selectedFeature.id))) {
      setSelectedFeatureId(null);
      return;
    }

    setSelectedFeatureId(selectedFeature.id);
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
        map.setGeoJSONSourceData(sourceId, emptyFacilitiesSourceData());
        emitViewportUpdate([], "n/a", false);
        setStatus({
          state: "error",
          perspective,
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

    const zoom = map.getZoom();
    if (zoom < minZoom) {
      state.requestSequence += 1;
      state.abortController?.abort();
      state.abortController = null;
      map.setGeoJSONSourceData(sourceId, emptyFacilitiesSourceData());
      clearSelection();
      state.lastFetchKey = null;
      emitViewportUpdate([], "n/a", false);
      setStatus({
        state: "hidden",
        zoom,
        minZoom,
      });
      return;
    }

    const bbox = quantizeBbox(map.getBounds(), 3);
    const fetchKey = `${perspective}:${bbox.west},${bbox.south},${bbox.east},${bbox.north}:${limit}`;
    if (state.lastFetchKey === fetchKey) {
      return;
    }
    state.lastFetchKey = fetchKey;

    state.requestSequence += 1;
    const sequence = state.requestSequence;

    state.abortController?.abort();
    state.abortController = new AbortController();

    setStatus({
      state: "loading",
      perspective,
    });

    const result = await fetchFacilitiesByBbox({
      bbox,
      perspective,
      limit,
      signal: state.abortController.signal,
    });

    if (sequence !== state.requestSequence) {
      return;
    }

    if (!result.ok) {
      if (result.reason === "aborted") {
        return;
      }

      map.setGeoJSONSourceData(sourceId, emptyFacilitiesSourceData());
      clearSelection();
      state.lastFetchKey = null;
      emitViewportUpdate([], result.requestId, false);
      setStatus({
        state: "error",
        perspective,
        requestId: result.requestId,
        reason: result.reason,
      });
      return;
    }

    map.setGeoJSONSourceData(sourceId, facilitiesCollectionToSourceData(result.data));
    syncSelectionForFeatures(result.data.features);
    emitViewportUpdate(result.data.features, result.requestId, result.data.meta.truncated);

    setStatus({
      state: "ok",
      perspective,
      requestId: result.requestId,
      count: result.data.meta.recordCount,
      truncated: result.data.meta.truncated,
    });
  };

  const setVisible = (visible: boolean): void => {
    if (state.visible === visible) {
      return;
    }

    state.visible = visible;
    state.requestSequence += 1;
    state.abortController?.abort();
    state.abortController = null;
    state.lastFetchKey = null;

    if (state.debounceTimer) {
      window.clearTimeout(state.debounceTimer);
    }
    state.debounceTimer = null;

    if (!state.ready) {
      if (!visible) {
        state.selectedFeatureId = null;
        emitSelectedFacility(null);
      }
      return;
    }

    if (!visible) {
      map.setGeoJSONSourceData(sourceId, emptyFacilitiesSourceData());
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

  return {
    clearSelection,
    perspective,
    setVisible,
    destroy(): void {
      state.requestSequence += 1;
      state.abortController?.abort();
      state.abortController = null;
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
