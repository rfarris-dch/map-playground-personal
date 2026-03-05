import type { IMap, MapClickEvent, MapPointerEvent } from "@map-migration/map-engine";
import { validateLayerOrder } from "@map-migration/map-style";
import {
  createPmtilesSourceUrl,
  createStressGovernor,
  evaluateParcelsGuardrails,
  loadParcelsManifest,
} from "@/features/parcels/parcels.service";
import type {
  ParcelsLayerController,
  ParcelsLayerOptions,
  ParcelsLayerState,
  ParcelsStatus,
} from "@/features/parcels/parcels.types";
import type { ParcelFeatureTarget } from "./parcels.layer.types";

function initialState(): ParcelsLayerState {
  return {
    ready: false,
    sourceInitialized: false,
    sourceInitializationPromise: null,
    visible: false,
    stressBlocked: false,
    manifest: null,
    guardrail: null,
    hoverFeatureId: null,
    selectedFeatureId: null,
    selectedParcelId: null,
  };
}

function isFeatureId(value: unknown): value is number | string {
  return typeof value === "number" || typeof value === "string";
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

function toParcelFeatureTarget(feature: {
  id: unknown;
  properties?: unknown;
}): ParcelFeatureTarget | null {
  if (!isFeatureId(feature.id)) {
    return null;
  }

  const parcelId = readStringProperty(feature.properties, "pid") ?? String(feature.id);
  return {
    featureId: feature.id,
    parcelId,
  };
}

const FACILITIES_LAYER_IDS: readonly string[] = [
  "facilities.colocation.clusters",
  "facilities.colocation.cluster-count",
  "facilities.colocation.points",
  "facilities.hyperscale.clusters",
  "facilities.hyperscale.cluster-count",
  "facilities.hyperscale.points",
];

function resolveBeforeLayerId(map: IMap): string | undefined {
  for (const layerId of FACILITIES_LAYER_IDS) {
    if (map.hasLayer(layerId)) {
      return layerId;
    }
  }

  return undefined;
}

export function mountParcelsLayer(
  map: IMap,
  options: ParcelsLayerOptions = {}
): ParcelsLayerController {
  const sourceId = "parcels";
  const sourceLayer = options.sourceLayer ?? "parcels";
  const fillLayerId = "property.parcels.fill";
  const outlineLayerId = "property.parcels";
  const manifestPath = options.manifestPath ?? "/tiles/parcels-draw-v1/latest.json";
  const disableGuardrails = options.disableGuardrails ?? false;
  const maxViewportWidthKm = options.maxViewportWidthKm ?? 40;
  const maxPredictedTiles = options.maxPredictedTiles ?? 120;
  const maxTilePredictionZoom = options.maxTilePredictionZoom ?? 16;
  const state = initialState();

  const stressGovernor = createStressGovernor({
    onChange: (blocked) => {
      if (disableGuardrails) {
        return;
      }
      state.stressBlocked = blocked;
      options.onStressBlockedChange?.(blocked);
      applyVisibility();
    },
  });

  const isInteractionEnabled = (): boolean => {
    return options.isInteractionEnabled?.() ?? true;
  };

  const setStatus = (status: ParcelsStatus): void => {
    options.onStatus?.(status);
  };

  const emitSelectedParcel = (parcelId: string | null): void => {
    if (parcelId === null) {
      options.onSelectParcel?.(null);
      return;
    }

    const nextSelection: {
      parcelId: string;
      expectedIngestionRunId?: string;
    } = {
      parcelId,
    };
    const ingestionRunId = state.manifest?.current.ingestionRunId;
    if (typeof ingestionRunId === "string") {
      nextSelection.expectedIngestionRunId = ingestionRunId;
    }

    options.onSelectParcel?.(nextSelection);
  };

  const setFeatureHoverState = (featureId: number | string, hover: boolean): void => {
    map.setFeatureState(
      {
        source: sourceId,
        sourceLayer,
        id: featureId,
      },
      { hover }
    );
  };

  const setFeatureSelectedState = (featureId: number | string, selected: boolean): void => {
    map.setFeatureState(
      {
        source: sourceId,
        sourceLayer,
        id: featureId,
      },
      { selected }
    );
  };

  const clearHover = (): void => {
    if (state.hoverFeatureId === null) {
      return;
    }

    setFeatureHoverState(state.hoverFeatureId, false);
    state.hoverFeatureId = null;
  };

  const setHover = (featureId: number | string): void => {
    if (state.hoverFeatureId === featureId) {
      return;
    }

    clearHover();
    setFeatureHoverState(featureId, true);
    state.hoverFeatureId = featureId;
  };

  const clearSelection = (): void => {
    if (state.selectedFeatureId !== null) {
      setFeatureSelectedState(state.selectedFeatureId, false);
    }

    state.selectedFeatureId = null;
    state.selectedParcelId = null;
    emitSelectedParcel(null);
  };

  const setSelection = (target: ParcelFeatureTarget | null): void => {
    if (target === null) {
      clearSelection();
      return;
    }

    if (
      state.selectedFeatureId === target.featureId &&
      state.selectedParcelId === target.parcelId
    ) {
      return;
    }

    if (state.selectedFeatureId !== null) {
      setFeatureSelectedState(state.selectedFeatureId, false);
    }

    state.selectedFeatureId = target.featureId;
    state.selectedParcelId = target.parcelId;
    setFeatureSelectedState(target.featureId, true);
    emitSelectedParcel(target.parcelId);
  };

  const setLayersVisible = (visible: boolean): void => {
    if (map.hasLayer(fillLayerId)) {
      map.setLayerVisibility(fillLayerId, visible);
    }
    if (map.hasLayer(outlineLayerId)) {
      map.setLayerVisibility(outlineLayerId, visible);
    }
  };

  const applyVisibility = (): void => {
    if (!(state.ready && state.sourceInitialized)) {
      return;
    }

    if (!state.visible) {
      setLayersVisible(false);
      clearHover();
      return;
    }

    const guardrailResult = evaluateParcelsGuardrails({
      bounds: map.getBounds(),
      zoom: map.getZoom(),
      maxViewportWidthKm: disableGuardrails ? Number.POSITIVE_INFINITY : maxViewportWidthKm,
      maxPredictedTiles: disableGuardrails ? Number.POSITIVE_INFINITY : maxPredictedTiles,
      maxTilePredictionZoom,
      isStressBlocked: disableGuardrails ? false : state.stressBlocked,
    });
    state.guardrail = guardrailResult;

    if (guardrailResult.blocked && guardrailResult.reason !== null) {
      clearHover();
      setLayersVisible(false);
      setStatus({
        state: "hidden",
        reason: guardrailResult.reason,
        viewportWidthKm: guardrailResult.viewportWidthKm,
        predictedTileCount: guardrailResult.predictedTileCount,
      });
      return;
    }

    setLayersVisible(true);

    const manifest = state.manifest;
    if (manifest === null) {
      setStatus({
        state: "error",
        reason: "missing parcels manifest",
      });
      return;
    }

    const nextStatus: {
      state: "ready";
      dataset: typeof manifest.dataset;
      ingestionRunId?: string;
      predictedTileCount: number;
      version: string;
      viewportWidthKm: number;
    } = {
      state: "ready",
      dataset: manifest.dataset,
      version: manifest.current.version,
      viewportWidthKm: guardrailResult.viewportWidthKm,
      predictedTileCount: guardrailResult.predictedTileCount,
    };
    const ingestionRunId = manifest.current.ingestionRunId;
    if (typeof ingestionRunId === "string") {
      nextStatus.ingestionRunId = ingestionRunId;
    }

    setStatus(nextStatus);
  };

  const initializeSource = (): Promise<void> => {
    if (state.sourceInitialized) {
      return Promise.resolve();
    }

    if (state.sourceInitializationPromise !== null) {
      return state.sourceInitializationPromise;
    }

    const sourceInitializationPromise = (async (): Promise<void> => {
      setStatus({ state: "loading-manifest" });
      const manifest = await loadParcelsManifest({
        manifestPath,
      });
      state.manifest = manifest;

      const pmtilesSourceUrl = createPmtilesSourceUrl(manifest);
      if (!map.hasSource(sourceId)) {
        map.addSource(sourceId, {
          type: "vector",
          url: pmtilesSourceUrl,
          promoteId: "pid",
        });
      }

      if (!map.hasLayer(fillLayerId)) {
        const beforeLayerId = resolveBeforeLayerId(map);
        map.addLayer(
          {
            id: fillLayerId,
            type: "fill",
            source: sourceId,
            "source-layer": sourceLayer,
            paint: {
              "fill-color": [
                "case",
                ["boolean", ["feature-state", "selected"], false],
                "#f59e0b",
                ["boolean", ["feature-state", "hover"], false],
                "#fbbf24",
                "#fcd34d",
              ],
              "fill-opacity": [
                "case",
                ["boolean", ["feature-state", "selected"], false],
                0.24,
                ["boolean", ["feature-state", "hover"], false],
                0.16,
                0.1,
              ],
            },
          },
          beforeLayerId
        );
      }

      if (!map.hasLayer(outlineLayerId)) {
        const beforeLayerId = resolveBeforeLayerId(map);
        map.addLayer(
          {
            id: outlineLayerId,
            type: "line",
            source: sourceId,
            "source-layer": sourceLayer,
            paint: {
              "line-width": [
                "case",
                ["boolean", ["feature-state", "selected"], false],
                1.9,
                ["boolean", ["feature-state", "hover"], false],
                1.4,
                0.8,
              ],
              "line-color": [
                "case",
                ["boolean", ["feature-state", "selected"], false],
                "#b45309",
                ["boolean", ["feature-state", "hover"], false],
                "#92400e",
                "#854d0e",
              ],
              "line-opacity": 0.95,
            },
          },
          beforeLayerId
        );
      }

      const layerOrderFailures = validateLayerOrder(
        (map.getStyle().layers ?? []).map((layer) => layer.id)
      );
      if (layerOrderFailures.length > 0) {
        console.error(
          `[parcels] layer order invariant failures: ${layerOrderFailures.join(" | ")}`
        );
      }

      state.sourceInitialized = true;
      applyVisibility();
    })()
      .catch((error: unknown) => {
        setStatus({
          state: "error",
          reason: error instanceof Error ? error.message : String(error),
        });
        throw error;
      })
      .finally(() => {
        state.sourceInitializationPromise = null;
      });

    state.sourceInitializationPromise = sourceInitializationPromise;
    return sourceInitializationPromise;
  };

  const onLoad = (): void => {
    state.ready = true;
    if (!state.visible) {
      return;
    }

    initializeSource().catch(() => {
      return;
    });
  };

  const onMoveEnd = (): void => {
    applyVisibility();
  };

  const onPointerLeave = (): void => {
    clearHover();
  };

  const onPointerMove = (event: MapPointerEvent): void => {
    if (!(state.visible && state.sourceInitialized && isInteractionEnabled())) {
      clearHover();
      return;
    }

    const features = map.queryRenderedFeatures(event.point, {
      layers: [outlineLayerId, fillLayerId],
    });

    for (const feature of features) {
      const target = toParcelFeatureTarget(feature);
      if (target === null) {
        continue;
      }

      setHover(target.featureId);
      return;
    }

    clearHover();
  };

  const onClick = (event: MapClickEvent): void => {
    if (!(state.visible && state.sourceInitialized && isInteractionEnabled())) {
      return;
    }

    const features = map.queryRenderedFeatures(event.point, {
      layers: [outlineLayerId, fillLayerId],
    });

    for (const feature of features) {
      const target = toParcelFeatureTarget(feature);
      if (target === null) {
        continue;
      }

      setSelection(target);
      return;
    }

    clearSelection();
  };

  map.on("load", onLoad);
  map.on("moveend", onMoveEnd);
  map.onPointerMove(onPointerMove);
  map.onPointerLeave(onPointerLeave);
  map.onClick(onClick);

  return {
    clearSelection,
    setVisible(visible: boolean): void {
      if (state.visible === visible) {
        return;
      }

      state.visible = visible;
      if (!visible) {
        clearHover();
        clearSelection();
        setLayersVisible(false);
        const guardrail = state.guardrail;
        if (guardrail?.blocked && guardrail.reason !== null) {
          setStatus({
            state: "hidden",
            reason: guardrail.reason,
            viewportWidthKm: guardrail.viewportWidthKm,
            predictedTileCount: guardrail.predictedTileCount,
          });
          return;
        }
        setStatus({ state: "idle" });
        return;
      }

      if (!state.ready) {
        return;
      }

      initializeSource()
        .then(() => {
          applyVisibility();
        })
        .catch(() => {
          return;
        });
    },
    destroy(): void {
      clearHover();
      clearSelection();

      stressGovernor.destroy();

      map.off("load", onLoad);
      map.off("moveend", onMoveEnd);
      map.offPointerMove(onPointerMove);
      map.offPointerLeave(onPointerLeave);
      map.offClick(onClick);

      if (map.hasLayer(outlineLayerId)) {
        map.removeLayer(outlineLayerId);
      }
      if (map.hasLayer(fillLayerId)) {
        map.removeLayer(fillLayerId);
      }
      if (map.hasSource(sourceId)) {
        map.removeSource(sourceId);
      }
    },
  };
}
