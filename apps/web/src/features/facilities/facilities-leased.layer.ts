import { runEffectPromise } from "@map-migration/core-runtime/effect";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type { IMap } from "@map-migration/map-engine";
import { Effect, Either } from "effect";
import { fetchFacilitiesByBboxEffect } from "@/features/facilities/api";
import {
  expandBbox,
  quantizeBbox,
  bboxContains,
  emptyFacilitiesSourceData,
} from "@/features/facilities/facilities.service";
import type { FacilitiesLayerController } from "@/features/facilities/facilities.types";
import type { FacilitiesStatus } from "@/features/facilities/facilities.types";
import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";

interface HyperscaleLeasedLayerOptions {
  readonly perspective: FacilityPerspective;
  readonly limit?: number;
  readonly onStatusChange?: (status: FacilitiesStatus) => void;
  readonly onViewportUpdate?: (snapshot: { features: FacilitiesFeatureCollection["features"] }) => void;
}

const SOURCE_ID = "hyperscale-leased-voronoi";
const FILL_LAYER_ID = "hyperscale-leased-voronoi.fill";
const LINE_LAYER_ID = "hyperscale-leased-voronoi.line";

export function mountHyperscaleLeasedLayer(
  map: IMap,
  options: HyperscaleLeasedLayerOptions
): FacilitiesLayerController {
  let cachedBbox: readonly [number, number, number, number] | null = null;
  let cachedFeatures: FacilitiesFeatureCollection["features"] = [];
  let visible = false;
  let fetchSequence = 0;
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
            0, "#fde68a",
            10, "#fbbf24",
            30, "#f59e0b",
            60, "#d97706",
            100, "#b45309",
            200, "#92400e",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.7,
            0.45,
          ],
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
          "line-width": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            2.5,
            1,
          ],
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
    readonly west: number;
    readonly south: number;
    readonly east: number;
    readonly north: number;
  }

  async function fetchData(bounds: Bbox): Promise<void> {
    const bbox = quantizeBbox({
      west: bounds.west,
      south: bounds.south,
      east: bounds.east,
      north: bounds.north,
    });

    const expanded = expandBbox(bbox);

    if (cachedBbox !== null && bboxContains(cachedBbox, [bbox.west, bbox.south, bbox.east, bbox.north])) {
      return;
    }

    const seq = ++fetchSequence;
    options.onStatusChange?.({ state: "loading" });

    const result = await runEffectPromise(
      Effect.either(
        fetchFacilitiesByBboxEffect({
          bbox: expanded,
          perspective: "hyperscale-leased",
          limit: options.limit ?? 5000,
        })
      )
    );

    if (seq !== fetchSequence) {
      return;
    }

    if (Either.isLeft(result)) {
      options.onStatusChange?.({ state: "error", reason: "fetch failed" });
      return;
    }

    cachedBbox = [expanded.west, expanded.south, expanded.east, expanded.north];
    cachedFeatures = result.right.data.features;
    updateSource(cachedFeatures);
    options.onStatusChange?.({ state: "ready" });
    options.onViewportUpdate?.({ features: cachedFeatures });
  }

  function onMoveEnd(): void {
    if (!visible) {
      return;
    }
    const bounds = map.getBounds();
    fetchData(bounds).catch(() => {
      options.onStatusChange?.({ state: "error", reason: "fetch failed" });
    });
  }

  function onLoad(): void {
    ensureSource();
    ensureLayers();
    sourceReady = true;
    applyVisibility();
    map.on("moveend", onMoveEnd);
    if (visible) {
      onMoveEnd();
    }
  }

  map.on("load", onLoad);
  if ((map.getStyle()?.layers?.length ?? 0) > 0) {
    onLoad();
  }

  return {
    perspective: "hyperscale-leased",
    applyFilter() {},
    clearSelection() {},
    resolveFeatureProperties(): unknown | null {
      return null;
    },
    setViewMode() {},
    setVisible(nextVisible: boolean): void {
      visible = nextVisible;
      applyVisibility();
      if (visible) {
        onMoveEnd();
      } else {
        cachedBbox = null;
        cachedFeatures = [];
        updateSource([]);
      }
    },
    zoomToCluster() {},
    destroy(): void {
      map.off("moveend", onMoveEnd);
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
