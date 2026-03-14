import { buildFiberLocatorVectorTileRoute } from "@map-migration/http-contracts";
import { getFacilitiesStyleLayerIds } from "@map-migration/map-style";
import { fiberLocatorLineColor } from "@/features/fiber-locator/fiber-locator.service";
import type {
  FiberLocatorLayerController,
  FiberLocatorLayerOptions,
  FiberLocatorLayerState,
  FiberLocatorSourceLayerOption,
} from "@/features/fiber-locator/fiber-locator.types";

const FIBER_SOURCE_LAYER_ID_RE = /[^a-z0-9._-]+/gi;
const FIBER_MIN_ZOOM = 4;
const FACILITIES_LAYER_ANCHORS: readonly string[] = [
  ...Object.values(getFacilitiesStyleLayerIds("facilities.colocation")),
  ...Object.values(getFacilitiesStyleLayerIds("facilities.hyperscale")),
];

function createSourceId(lineId: FiberLocatorLayerOptions["lineId"]): string {
  return `fiber-locator.${lineId}`;
}

function createVectorTileUrl(lineId: FiberLocatorLayerOptions["lineId"]): string {
  const path = buildFiberLocatorVectorTileRoute(lineId, "{z}", "{x}", "{y}");
  return `${window.location.origin}${path}`;
}

function normalizeSourceLayers(
  sourceLayers: readonly FiberLocatorSourceLayerOption[]
): readonly FiberLocatorSourceLayerOption[] {
  const output: FiberLocatorSourceLayerOption[] = [];
  const seen = new Set<string>();
  for (const sourceLayer of sourceLayers) {
    const trimmedSourceLayerName = sourceLayer.layerName.trim().toLowerCase();
    if (trimmedSourceLayerName.length === 0) {
      continue;
    }

    if (seen.has(trimmedSourceLayerName)) {
      continue;
    }

    seen.add(trimmedSourceLayerName);
    output.push({
      color: sourceLayer.color,
      label:
        sourceLayer.label.trim().length > 0 ? sourceLayer.label.trim() : trimmedSourceLayerName,
      layerName: trimmedSourceLayerName,
    });
  }

  output.sort((left, right) => left.layerName.localeCompare(right.layerName));
  return output;
}

function createRenderLayerId(
  lineId: FiberLocatorLayerOptions["lineId"],
  sourceLayerName: string,
  index: number
): string {
  const sourceId = createSourceId(lineId);
  const normalizedSourceLayerId = sourceLayerName
    .trim()
    .toLowerCase()
    .replace(FIBER_SOURCE_LAYER_ID_RE, "-");
  if (normalizedSourceLayerId.length === 0) {
    return `${sourceId}.layer.${String(index)}`;
  }

  return `${sourceId}.${normalizedSourceLayerId}.${String(index)}`;
}

function applyVisibility(options: FiberLocatorLayerOptions, state: FiberLocatorLayerState): void {
  for (const layerId of state.layerIds) {
    options.map.setLayerVisibility(layerId, state.visible);
  }
}

function resolveBeforeLayerId(options: FiberLocatorLayerOptions): string | undefined {
  for (const anchorLayerId of FACILITIES_LAYER_ANCHORS) {
    if (options.map.hasLayer(anchorLayerId)) {
      return anchorLayerId;
    }
  }

  return undefined;
}

function reconcileRenderLayers(
  options: FiberLocatorLayerOptions,
  state: FiberLocatorLayerState
): void {
  const desiredLayerIds = new Set<string>();
  const lineOpacity = options.opacity ?? 0.85;
  const lineHoverOpacity = Math.min(lineOpacity + 0.15, 1);
  const beforeLayerId = resolveBeforeLayerId(options);

  for (const [index, sourceLayer] of state.sourceLayers.entries()) {
    const sourceLayerName = sourceLayer.layerName;
    const renderLayerId = createRenderLayerId(options.lineId, sourceLayerName, index);
    const lineColor =
      sourceLayer.color !== null && sourceLayer.color.trim().length > 0
        ? sourceLayer.color
        : fiberLocatorLineColor(options.lineId);

    desiredLayerIds.add(renderLayerId);
    if (options.map.hasLayer(renderLayerId)) {
      continue;
    }

    options.map.addLayer(
      {
        id: renderLayerId,
        type: "line",
        source: createSourceId(options.lineId),
        "source-layer": sourceLayerName,
        minzoom: FIBER_MIN_ZOOM,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": lineColor,
          "line-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            lineHoverOpacity,
            lineOpacity,
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.6],
            7,
            ["case", ["boolean", ["feature-state", "hover"], false], 1.8, 1.1],
            10,
            ["case", ["boolean", ["feature-state", "hover"], false], 2.6, 1.8],
            13,
            ["case", ["boolean", ["feature-state", "hover"], false], 3.4, 2.4],
          ],
        },
      },
      beforeLayerId
    );
  }

  for (const existingLayerId of state.layerIds) {
    if (desiredLayerIds.has(existingLayerId)) {
      continue;
    }

    if (options.map.hasLayer(existingLayerId)) {
      options.map.removeLayer(existingLayerId);
    }
  }

  state.layerIds.clear();
  for (const desiredLayerId of desiredLayerIds) {
    state.layerIds.add(desiredLayerId);
  }
}

export function mountFiberLocatorLayer(
  options: FiberLocatorLayerOptions
): FiberLocatorLayerController {
  const sourceId = createSourceId(options.lineId);
  const state: FiberLocatorLayerState = {
    layerIds: new Set<string>(),
    ready: false,
    sourceLayers: normalizeSourceLayers(options.sourceLayers ?? []),
    visible: true,
  };

  const onLoad = (): void => {
    state.ready = true;

    if (!options.map.hasSource(sourceId)) {
      options.map.addSource(sourceId, {
        type: "vector",
        tiles: [createVectorTileUrl(options.lineId)],
        minzoom: FIBER_MIN_ZOOM,
        maxzoom: 22,
      });
    }

    reconcileRenderLayers(options, state);
    applyVisibility(options, state);
  };

  options.map.on("load", onLoad);

  return {
    lineId: options.lineId,
    getLayerIds(): readonly string[] {
      return [...state.layerIds];
    },
    getSourceId(): string {
      return sourceId;
    },

    setSourceLayers(sourceLayers: readonly FiberLocatorSourceLayerOption[]): void {
      state.sourceLayers = normalizeSourceLayers(sourceLayers);
      if (!state.ready) {
        return;
      }

      reconcileRenderLayers(options, state);
      applyVisibility(options, state);
    },

    setVisible(visible: boolean): void {
      state.visible = visible;
      if (!state.ready) {
        return;
      }

      applyVisibility(options, state);
    },

    destroy(): void {
      options.map.off("load", onLoad);
      for (const layerId of state.layerIds) {
        if (options.map.hasLayer(layerId)) {
          options.map.removeLayer(layerId);
        }
      }
      state.layerIds.clear();
      if (options.map.hasSource(sourceId)) {
        options.map.removeSource(sourceId);
      }
    },
  };
}
