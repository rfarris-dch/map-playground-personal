import { getApiErrorReason } from "@map-migration/core-runtime/api";
import { runEffectPromise } from "@map-migration/core-runtime/effect";
import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { BBox } from "@map-migration/geo-kernel/geometry";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type { IMap } from "@map-migration/map-engine";
import { Effect, Either } from "effect";
import {
  createAppPerformanceTimer,
  recordAppPerformanceCounter,
  recordAppPerformanceMeasurement,
} from "@/features/app/diagnostics/app-performance.service";
import type { MapInteractionCoordinator } from "@/features/app/interaction/map-interaction.types";
import { fetchFacilitiesByBboxEffect } from "@/features/facilities/api";
import {
  bboxContains,
  emptyFacilitiesSourceData,
  expandBbox,
  quantizeBbox,
} from "@/features/facilities/facilities.service";
import type {
  FacilitiesLayerController,
  FacilitiesStatus,
} from "@/features/facilities/facilities.types";

interface HyperscaleLeasedLayerOptions {
  readonly interactionCoordinator?: MapInteractionCoordinator | null;
  readonly limit?: number;
  readonly onStatusChange?: (status: FacilitiesStatus) => void;
  readonly onViewportUpdate?: (snapshot: {
    features: FacilitiesFeatureCollection["features"];
  }) => void;
  readonly perspective: FacilityPerspective;
}

const SOURCE_ID = "hyperscale-leased-voronoi";
const FILL_LAYER_ID = "hyperscale-leased-voronoi.fill";
const LINE_LAYER_ID = "hyperscale-leased-voronoi.line";

export function mountHyperscaleLeasedLayer(
  map: IMap,
  options: HyperscaleLeasedLayerOptions
): FacilitiesLayerController {
  let cachedBbox: BBox | null = null;
  let cachedFeatures: FacilitiesFeatureCollection["features"] = [];
  let visible = false;
  let fetchSequence = 0;
  let unsubscribeInteractionCoordinator: (() => void) | null = null;
  let activeRefreshAbortController: AbortController | null = null;

  function abortActiveRefresh(): void {
    activeRefreshAbortController?.abort();
    activeRefreshAbortController = null;
  }
  function ensureSource(): void {
    if (!map.hasSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: emptyFacilitiesSourceData(),
      });
    }
  }

  function ensureLayers(): void {
    if (!map.hasLayer(FILL_LAYER_ID)) {
      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "commissionedPowerMw"], 0],
            0,
            "#fde68a",
            10,
            "#fbbf24",
            30,
            "#f59e0b",
            60,
            "#d97706",
            100,
            "#b45309",
            200,
            "#92400e",
          ],
          "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.7, 0.45],
        },
      });
    }

    if (!map.hasLayer(LINE_LAYER_ID)) {
      map.addLayer({
        id: LINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            "#78350f",
            "#92400e",
          ],
          "line-opacity": 0.7,
          "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.5, 1],
        },
      });
    }
  }

  let sourceReady = false;

  function applyVisibility(): void {
    if (!sourceReady) {
      return;
    }
    if (map.hasLayer(FILL_LAYER_ID)) {
      map.setLayerVisibility(FILL_LAYER_ID, visible);
    }
    if (map.hasLayer(LINE_LAYER_ID)) {
      map.setLayerVisibility(LINE_LAYER_ID, visible);
    }
  }

  function updateSource(features: FacilitiesFeatureCollection["features"]): void {
    if (!map.hasSource(SOURCE_ID)) {
      return;
    }
    map.setGeoJSONSourceData(SOURCE_ID, {
      type: "FeatureCollection",
      features,
    });
  }

  interface Bbox {
    readonly east: number;
    readonly north: number;
    readonly south: number;
    readonly west: number;
  }

  async function fetchData(bounds: Bbox): Promise<void> {
    recordAppPerformanceCounter("map.moveend", {
      feature: "facilities-leased",
      perspective: options.perspective,
    });
    const bbox = quantizeBbox({
      west: bounds.west,
      south: bounds.south,
      east: bounds.east,
      north: bounds.north,
    });

    const expanded = expandBbox(bbox);

    if (cachedBbox !== null && bboxContains(cachedBbox, bbox)) {
      recordAppPerformanceCounter("facilities.covered-viewport", {
        perspective: options.perspective,
      });
      return;
    }

    const seq = ++fetchSequence;
    abortActiveRefresh();
    const abortController = new AbortController();
    activeRefreshAbortController = abortController;
    options.onStatusChange?.({ state: "loading", perspective: options.perspective });
    recordAppPerformanceCounter("facilities.request.started", {
      perspective: options.perspective,
    });
    const stopRequestTimer = createAppPerformanceTimer("facilities.request.time", {
      perspective: options.perspective,
    });

    const result = await runEffectPromise(
      Effect.either(
        fetchFacilitiesByBboxEffect(
          {
            bbox: expanded,
            perspective: "hyperscale-leased",
            limit: options.limit ?? 5000,
          },
          abortController.signal
        )
      )
    );
    if (activeRefreshAbortController === abortController) {
      activeRefreshAbortController = null;
    }
    stopRequestTimer();

    if (seq !== fetchSequence) {
      return;
    }

    if (Either.isLeft(result)) {
      if (getApiErrorReason(result.left) === "aborted") {
        recordAppPerformanceCounter("facilities.request.aborted", {
          perspective: options.perspective,
        });
        return;
      }
      recordAppPerformanceCounter("facilities.request.failed", {
        perspective: options.perspective,
      });
      options.onStatusChange?.({
        state: "error",
        perspective: options.perspective,
        requestId: String(seq),
        reason: "fetch failed",
      });
      return;
    }

    recordAppPerformanceCounter("facilities.request.succeeded", {
      perspective: options.perspective,
    });
    recordAppPerformanceMeasurement(
      "facilities.response.feature-count",
      result.right.data.features.length,
      { perspective: options.perspective }
    );
    const stopSourceUpdateTimer = createAppPerformanceTimer("facilities.source-update.time", {
      perspective: options.perspective,
    });
    cachedBbox = {
      west: expanded.west,
      south: expanded.south,
      east: expanded.east,
      north: expanded.north,
    };
    cachedFeatures = result.right.data.features;
    updateSource(cachedFeatures);
    stopSourceUpdateTimer();
    options.onStatusChange?.({
      state: "ok",
      perspective: options.perspective,
      requestId: String(seq),
      count: cachedFeatures.length,
      truncated: false,
    });
    options.onViewportUpdate?.({ features: cachedFeatures });
  }

  function onMoveEnd(): void {
    if (!visible) {
      return;
    }
    const bounds = map.getBounds();
    fetchData(bounds).catch(() => {
      options.onStatusChange?.({
        state: "error",
        perspective: options.perspective,
        requestId: String(fetchSequence),
        reason: "fetch failed",
      });
    });
  }

  function onLoad(): void {
    ensureSource();
    ensureLayers();
    sourceReady = true;
    applyVisibility();
    if (visible) {
      onMoveEnd();
    }
  }

  map.on("load", onLoad);
  if (
    options.interactionCoordinator === null ||
    typeof options.interactionCoordinator === "undefined"
  ) {
    map.on("moveend", onMoveEnd);
  } else {
    unsubscribeInteractionCoordinator = options.interactionCoordinator.subscribe((snapshot) => {
      if (snapshot.eventType !== "moveend") {
        return;
      }

      onMoveEnd();
    });
  }

  return {
    perspective: "hyperscale-leased",
    applyFilter() {
      // No-op for the leased overlay layer.
    },
    clearSelection() {
      // No-op for the leased overlay layer.
    },
    resolveFeatureProperties(): unknown | null {
      return null;
    },
    setViewMode() {
      // No-op for the leased overlay layer.
    },
    setVisible(nextVisible: boolean): void {
      visible = nextVisible;
      applyVisibility();
      if (visible) {
        onMoveEnd();
      } else {
        abortActiveRefresh();
        fetchSequence += 1;
        cachedBbox = null;
        cachedFeatures = [];
        updateSource([]);
      }
    },
    zoomToCluster() {
      // No-op for the leased overlay layer.
    },
    destroy(): void {
      fetchSequence += 1;
      abortActiveRefresh();
      unsubscribeInteractionCoordinator?.();
      unsubscribeInteractionCoordinator = null;
      if (
        options.interactionCoordinator === null ||
        typeof options.interactionCoordinator === "undefined"
      ) {
        map.off("moveend", onMoveEnd);
      }
      map.off("load", onLoad);
      if (map.hasLayer(FILL_LAYER_ID)) {
        map.removeLayer(FILL_LAYER_ID);
      }
      if (map.hasLayer(LINE_LAYER_ID)) {
        map.removeLayer(LINE_LAYER_ID);
      }
      if (map.hasSource(SOURCE_ID)) {
        map.removeSource(SOURCE_ID);
      }
    },
  };
}
