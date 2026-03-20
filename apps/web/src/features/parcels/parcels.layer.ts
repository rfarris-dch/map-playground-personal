import { makeParcelSnapshotId } from "@map-migration/geo-kernel/parcel-snapshot-id";
import { createPmtilesSourceUrl, type VectorTilesetSchemaContract } from "@map-migration/geo-tiles";
import type { IMap, MapClickEvent } from "@map-migration/map-engine";
import {
  getFacilitiesStyleLayerIds,
  getParcelsStyleLayerIds,
  validateLayerOrder,
} from "@map-migration/map-style";
import type { ParcelFeatureTarget } from "@/features/parcels/parcels.layer.types";
import {
  createStressGovernor,
  evaluateParcelsGuardrails,
} from "@/features/parcels/parcels.service";
import type {
  ParcelsGuardrailReason,
  ParcelsLayerController,
  ParcelsLayerOptions,
  ParcelsLayerState,
  ParcelsStatus,
} from "@/features/parcels/parcels.types";
import { resolveParcelsManifestPath } from "@/features/tiles/tile-manifest-config.service";
import { mountManifestBackedLayerBootstrap } from "@/lib/manifest-backed-layer.service";
import { createFeatureHoverController } from "@/lib/map-feature-hover.service";
import { isFeatureId, readStringProperty } from "@/lib/map-feature-readers";

const PARCELS_DRAW_TILESET_SCHEMA = Object.freeze<VectorTilesetSchemaContract>({
  dataset: "parcels-draw-v1",
  featureIdProperty: "pid",
  sourceLayer: "parcels",
});

function initialState(): ParcelsLayerState {
  return {
    destroyed: false,
    ready: false,
    sourceInitialized: false,
    sourceInitializationPromise: null,
    visible: false,
    stressBlocked: false,
    manifest: null,
    guardrail: null,
    selectedFeatureId: null,
    selectedParcelId: null,
  };
}

function toParcelFeatureTarget(feature: {
  id: unknown;
  properties?: unknown;
}): ParcelFeatureTarget | null {
  if (!isFeatureId(feature.id)) {
    return null;
  }

  const parcelId =
    readStringProperty(feature.properties, PARCELS_DRAW_TILESET_SCHEMA.featureIdProperty) ??
    String(feature.id);
  return {
    featureId: feature.id,
    parcelId,
  };
}

const FACILITIES_LAYER_IDS: readonly string[] = [
  ...Object.values(getFacilitiesStyleLayerIds("facilities.colocation")),
  ...Object.values(getFacilitiesStyleLayerIds("facilities.hyperscale")),
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
  const VIEWPORT_FACETS_DEBOUNCE_MS = 140;
  const sourceId = "parcels";
  const sourceLayer = options.sourceLayer ?? PARCELS_DRAW_TILESET_SCHEMA.sourceLayer;
  const parcelsStyleLayerIds = getParcelsStyleLayerIds();
  const fillLayerId = parcelsStyleLayerIds.fillLayerId;
  const outlineLayerId = parcelsStyleLayerIds.outlineLayerId;
  const manifestPath = resolveParcelsManifestPath(options.manifestPath);
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
      applyVisibility();
    },
  });

  const isInteractionEnabled = (): boolean => {
    return options.isInteractionEnabled?.() ?? true;
  };

  let lastStatusKey: string | null = null;
  let viewportFacetsTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (status: ParcelsStatus): void => {
    const nextStatusKey = JSON.stringify(status);
    if (nextStatusKey === lastStatusKey) {
      return;
    }

    lastStatusKey = nextStatusKey;
    options.onStatus?.(status);
  };

  const emitSelectedParcel = (parcelId: string | null): void => {
    if (parcelId === null) {
      options.onSelectParcel?.(null);
      return;
    }

    const ingestionRunId = state.manifest?.current.ingestionRunId;
    if (typeof ingestionRunId === "string") {
      const snapshot = makeParcelSnapshotId(parcelId, ingestionRunId);
      options.onSelectParcel?.({
        parcelId: snapshot.parcelId,
        expectedIngestionRunId: snapshot.ingestionRunId,
      });
    } else {
      options.onSelectParcel?.({ parcelId });
    }
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

  const buildHiddenStatus = (args: {
    readonly predictedTileCount: number;
    readonly reason: ParcelsGuardrailReason;
    readonly viewportWidthKm: number;
  }): ParcelsStatus => {
    const ingestionRunId = state.manifest?.current.ingestionRunId;
    if (typeof ingestionRunId === "string") {
      return {
        state: "hidden",
        ingestionRunId,
        reason: args.reason,
        viewportWidthKm: args.viewportWidthKm,
        predictedTileCount: args.predictedTileCount,
      };
    }

    return {
      state: "hidden",
      reason: args.reason,
      viewportWidthKm: args.viewportWidthKm,
      predictedTileCount: args.predictedTileCount,
    };
  };

  const buildReadyStatus = (args: {
    readonly manifest: NonNullable<ParcelsLayerState["manifest"]>;
    readonly predictedTileCount: number;
    readonly viewportWidthKm: number;
  }): ParcelsStatus => {
    const ingestionRunId = args.manifest.current.ingestionRunId;
    if (typeof ingestionRunId === "string") {
      return {
        state: "ready",
        dataset: args.manifest.dataset,
        ingestionRunId,
        version: args.manifest.current.version,
        viewportWidthKm: args.viewportWidthKm,
        predictedTileCount: args.predictedTileCount,
      };
    }

    return {
      state: "ready",
      dataset: args.manifest.dataset,
      version: args.manifest.current.version,
      viewportWidthKm: args.viewportWidthKm,
      predictedTileCount: args.predictedTileCount,
    };
  };

  const applyVisibility = (): void => {
    if (state.destroyed || !(state.ready && state.sourceInitialized)) {
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
      setStatus(
        buildHiddenStatus({
          reason: guardrailResult.reason,
          viewportWidthKm: guardrailResult.viewportWidthKm,
          predictedTileCount: guardrailResult.predictedTileCount,
        })
      );
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

    setStatus(
      buildReadyStatus({
        manifest,
        viewportWidthKm: guardrailResult.viewportWidthKm,
        predictedTileCount: guardrailResult.predictedTileCount,
      })
    );
  };

  const ensureSource = (manifest: NonNullable<ParcelsLayerState["manifest"]>): void => {
    if (map.hasSource(sourceId)) {
      return;
    }

    map.addSource(sourceId, {
      type: "vector",
      url: createPmtilesSourceUrl(manifest, manifestPath),
      promoteId: PARCELS_DRAW_TILESET_SCHEMA.featureIdProperty,
    });
  };

  const ensureFillLayer = (): void => {
    if (map.hasLayer(fillLayerId)) {
      return;
    }

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
  };

  const ensureOutlineLayer = (): void => {
    if (map.hasLayer(outlineLayerId)) {
      return;
    }

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
  };

  const logLayerOrderFailures = (): void => {
    const layerOrderFailures = validateLayerOrder(
      (map.getStyle()?.layers ?? []).map((layer) => layer.id)
    );
    if (layerOrderFailures.length === 0) {
      return;
    }

    console.error(`[parcels] layer order invariant failures: ${layerOrderFailures.join(" | ")}`);
  };

  const bootstrap = mountManifestBackedLayerBootstrap({
    contextLabel: "parcels",
    dataset: PARCELS_DRAW_TILESET_SCHEMA.dataset,
    ensureLayers() {
      ensureFillLayer();
      ensureOutlineLayer();
      logLayerOrderFailures();
    },
    ensureSource(manifest) {
      state.manifest = manifest;
      ensureSource(manifest);
    },
    manifestPath,
    map,
    onInitializeSettled() {
      state.sourceInitializationPromise = null;
    },
    onInitializeStart(sourceInitializationPromise) {
      state.sourceInitializationPromise = sourceInitializationPromise;
      setStatus({ state: "loading-manifest" });
    },
    onInitializationError(error: unknown) {
      if (state.destroyed) {
        return;
      }

      setStatus({
        state: "error",
        reason: error instanceof Error ? error.message : String(error),
      });
    },
    onInitialized(manifest) {
      state.manifest = manifest;
      state.sourceInitialized = true;
      applyVisibility();
      scheduleInitialFacetsCollection();
    },
    onReady(readyBootstrap) {
      state.ready = true;
      stressGovernor.setEnabled(state.visible);
      if (!state.visible) {
        return;
      }

      readyBootstrap.initializeSource().catch(() => {
        return;
      });
    },
    preserveNetworkErrorCause: true,
    startWhenStyleReady: true,
  });

  const initializeSource = (): Promise<void> => {
    return bootstrap.initializeSource();
  };

  let facetsRetryTimer: ReturnType<typeof setTimeout> | null = null;

  const clearViewportFacetsTimer = (): void => {
    if (viewportFacetsTimer !== null) {
      clearTimeout(viewportFacetsTimer);
      viewportFacetsTimer = null;
    }
  };

  const scheduleViewportFacetsCollection = (delayMs = VIEWPORT_FACETS_DEBOUNCE_MS): void => {
    clearViewportFacetsTimer();

    if (!(state.visible && state.sourceInitialized && options.onViewportFacets)) {
      return;
    }

    viewportFacetsTimer = setTimeout(() => {
      viewportFacetsTimer = null;
      collectViewportFacets();
    }, delayMs);
  };

  const scheduleInitialFacetsCollection = (): void => {
    if (facetsRetryTimer !== null) {
      clearTimeout(facetsRetryTimer);
    }
    let attempts = 0;
    const tryCollect = (): void => {
      facetsRetryTimer = null;
      if (!(state.visible && state.sourceInitialized) || state.destroyed) {
        return;
      }
      collectViewportFacets();
      if (!options.onViewportFacets) {
        return;
      }
      // If queryRenderedFeatures returned nothing, tiles may still be loading — retry
      if (!map.hasLayer(fillLayerId)) {
        return;
      }
      const canvasSize = map.getCanvasSize();
      const features = map.queryRenderedFeatures(
        [
          [0, 0],
          [canvasSize.width, canvasSize.height],
        ],
        { layers: [fillLayerId] }
      );
      if (features.length === 0 && attempts < 10) {
        attempts += 1;
        facetsRetryTimer = setTimeout(tryCollect, 500);
      }
    };
    facetsRetryTimer = setTimeout(tryCollect, 500);
  };

  const collectViewportFacets = (): void => {
    if (!(state.visible && state.sourceInitialized && options.onViewportFacets)) {
      return;
    }
    if (!map.hasLayer(fillLayerId)) {
      return;
    }

    const canvasSize = map.getCanvasSize();
    const features = map.queryRenderedFeatures(
      [
        [0, 0],
        [canvasSize.width, canvasSize.height],
      ],
      { layers: [fillLayerId] }
    );
    const zoningTypes = new Set<string>();
    const floodZones = new Set<string>();
    let acresMin: number | null = null;
    let acresMax: number | null = null;
    let distTransmissionMin: number | null = null;
    let distTransmissionMax: number | null = null;

    for (const feature of features) {
      const props = feature.properties;
      if (typeof props !== "object" || props === null) {
        continue;
      }
      const zt = Reflect.get(props, "zoning_type");
      if (typeof zt === "string" && zt.length > 0) {
        zoningTypes.add(zt.toLowerCase());
      }
      const fz = Reflect.get(props, "fema_flood_zone");
      if (typeof fz === "string" && fz.length > 0) {
        floodZones.add(fz);
      }
      const rawAcres = Reflect.get(props, "ll_gisacre");
      const acres = typeof rawAcres === "number" ? rawAcres : Number(rawAcres);
      if (Number.isFinite(acres) && acres >= 0) {
        acresMin = acresMin === null ? acres : Math.min(acresMin, acres);
        acresMax = acresMax === null ? acres : Math.max(acresMax, acres);
      }
      const rawDist = Reflect.get(props, "dist_transmission_mi");
      const dist = typeof rawDist === "number" ? rawDist : Number(rawDist);
      if (Number.isFinite(dist) && dist >= 0) {
        distTransmissionMin =
          distTransmissionMin === null ? dist : Math.min(distTransmissionMin, dist);
        distTransmissionMax =
          distTransmissionMax === null ? dist : Math.max(distTransmissionMax, dist);
      }
    }

    options.onViewportFacets({
      acresMin,
      acresMax,
      distTransmissionMin,
      distTransmissionMax,
      zoningTypes,
      floodZones,
    });
  };

  const onMoveEnd = (): void => {
    applyVisibility();
    scheduleViewportFacetsCollection();
  };

  const hoverController = createFeatureHoverController(map, {
    isInteractionEnabled,
    onHoverChange() {
      return;
    },
    resolveHoverCandidate(event) {
      if (!(state.visible && state.sourceInitialized)) {
        return null;
      }

      const features = map.queryRenderedFeatures(event.point, {
        layers: [outlineLayerId, fillLayerId],
      });

      for (const feature of features) {
        const target = toParcelFeatureTarget(feature);
        if (target === null) {
          continue;
        }

        return {
          nextHover: target,
          nextTarget: {
            source: sourceId,
            sourceLayer,
            id: target.featureId,
          },
        };
      }

      return null;
    },
  });

  const clearHover = (): void => {
    hoverController.clear({ emit: false });
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

  map.on("moveend", onMoveEnd);
  map.onClick(onClick);

  let currentFilter: import("@map-migration/map-engine").MapExpression | null = null;

  const applyFilter = (): void => {
    if (!state.sourceInitialized) {
      return;
    }
    if (map.hasLayer(fillLayerId)) {
      map.setLayerFilter(fillLayerId, currentFilter);
    }
    if (map.hasLayer(outlineLayerId)) {
      map.setLayerFilter(outlineLayerId, currentFilter);
    }
  };

  return {
    clearSelection,
    setFilter(filter: import("@map-migration/map-engine").MapExpression | null): void {
      currentFilter = filter;
      applyFilter();
      scheduleViewportFacetsCollection(0);
    },
    setVisible(visible: boolean): void {
      if (state.visible === visible) {
        return;
      }

      state.visible = visible;
      stressGovernor.setEnabled(visible);
      if (!visible) {
        clearViewportFacetsTimer();
        clearHover();
        setLayersVisible(false);
        const guardrail = state.guardrail;
        if (guardrail?.blocked && guardrail.reason !== null) {
          setStatus(
            buildHiddenStatus({
              reason: guardrail.reason,
              viewportWidthKm: guardrail.viewportWidthKm,
              predictedTileCount: guardrail.predictedTileCount,
            })
          );
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
          scheduleInitialFacetsCollection();
        })
        .catch(() => {
          return;
        });
    },
    destroy(): void {
      state.destroyed = true;
      if (facetsRetryTimer !== null) {
        clearTimeout(facetsRetryTimer);
        facetsRetryTimer = null;
      }
      clearViewportFacetsTimer();
      clearHover();
      clearSelection();

      bootstrap.destroy();
      state.ready = false;
      state.sourceInitialized = false;
      state.sourceInitializationPromise = null;
      state.manifest = null;

      stressGovernor.destroy();

      map.off("moveend", onMoveEnd);
      map.offClick(onClick);
      hoverController.destroy();

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
