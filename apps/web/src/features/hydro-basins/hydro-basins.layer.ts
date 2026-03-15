import { createPmtilesSourceUrl, type TilePublishManifest } from "@map-migration/geo-tiles";
import { getCatalogStyleLayerIds, getHydroBasinsStyleLayerIds } from "@map-migration/map-style";
import { initialLayerStatus, type LayerStatus } from "@/features/layers/layer-runtime.types";
import { resolveEnvironmentalHydroBasinsManifestPath } from "@/features/tiles/tile-manifest-config.service";
import { mountManifestBackedLayerBootstrap } from "@/lib/manifest-backed-layer.service";
import type {
  HydroBasinsStressMode,
  HydroBasinsVisibilityController,
  MountHydroBasinsLayerOptions,
} from "./hydro-basins.types";
import {
  hydroBasinsFillPaint,
  hydroBasinsLabelLayout,
  hydroBasinsLabelPaint,
  hydroBasinsLinePaint,
} from "./hydro-basins-style.service";

const HYDRO_BASINS_DATASET = "environmental-hydro-basins";
const HYDRO_BASINS_SOURCE_ID = "environmental-hydro-basins";
const HYDRO_BASINS_VISUAL_LEVEL = "huc6";
const HYDRO_BASINS_VISUAL_MIN_ZOOM = 5;
const HYDRO_BASINS_VISUAL_MAX_ZOOM = 22;
const HYDRO_BASINS_FILL_LAYER_IDS: readonly string[] = ["environmental-hydro-basins-huc6-fill"];
const UPPER_BOUND_LAYER_ANCHORS: readonly string[] = [
  ...getCatalogStyleLayerIds("property.parcels"),
  ...getCatalogStyleLayerIds("facilities.colocation"),
  ...getCatalogStyleLayerIds("facilities.hyperscale"),
];

interface HydroBasinsState {
  status: LayerStatus;
  stressMode: HydroBasinsStressMode;
  visible: boolean;
}

function initialState(): HydroBasinsState {
  return {
    status: initialLayerStatus(),
    stressMode: "normal",
    visible: false,
  };
}

function resolveBeforeLayerId(map: MountHydroBasinsLayerOptions["map"]): string | undefined {
  for (const layerId of UPPER_BOUND_LAYER_ANCHORS) {
    if (map.hasLayer(layerId)) {
      return layerId;
    }
  }

  return undefined;
}

function setLayerVisibility(
  map: MountHydroBasinsLayerOptions["map"],
  layerIds: readonly string[],
  visible: boolean
): void {
  for (const layerId of layerIds) {
    if (!map.hasLayer(layerId)) {
      continue;
    }

    map.setLayerVisibility(layerId, visible);
  }
}

function ensureHydroBasinsSource(
  map: MountHydroBasinsLayerOptions["map"],
  manifest: TilePublishManifest,
  manifestPath: string
): void {
  if (map.hasSource(HYDRO_BASINS_SOURCE_ID)) {
    return;
  }

  map.addSource(HYDRO_BASINS_SOURCE_ID, {
    type: "vector",
    url: createPmtilesSourceUrl(manifest, manifestPath),
  });
}

function ensureHydroBasinsLayers(map: MountHydroBasinsLayerOptions["map"]): void {
  const styleLayerIds = getHydroBasinsStyleLayerIds();
  const beforeLayerId = resolveBeforeLayerId(map);
  const fillLevels: readonly ["huc6", string][] = [
    [HYDRO_BASINS_VISUAL_LEVEL, "environmental-hydro-basins-huc6-fill"],
  ];
  const lineLevels: readonly ["huc6", string][] = [
    [
      HYDRO_BASINS_VISUAL_LEVEL,
      styleLayerIds.lineLayerIds[1] ?? "environmental-hydro-basins-huc6-line",
    ],
  ];
  const labelLevels: readonly ["huc6", string][] = [
    [
      HYDRO_BASINS_VISUAL_LEVEL,
      styleLayerIds.labelLayerIds[1] ?? "environmental-hydro-basins-huc6-label",
    ],
  ];

  for (const [level, layerId] of fillLevels) {
    if (map.hasLayer(layerId)) {
      continue;
    }

    map.addLayer(
      {
        id: layerId,
        type: "fill",
        source: HYDRO_BASINS_SOURCE_ID,
        "source-layer": `${level}-fill`,
        minzoom: HYDRO_BASINS_VISUAL_MIN_ZOOM,
        maxzoom: HYDRO_BASINS_VISUAL_MAX_ZOOM,
        paint: hydroBasinsFillPaint(level),
      },
      beforeLayerId
    );
  }

  for (const [level, layerId] of lineLevels) {
    if (map.hasLayer(layerId)) {
      continue;
    }

    map.addLayer(
      {
        id: layerId,
        type: "line",
        source: HYDRO_BASINS_SOURCE_ID,
        "source-layer": `${level}-line`,
        minzoom: HYDRO_BASINS_VISUAL_MIN_ZOOM,
        maxzoom: HYDRO_BASINS_VISUAL_MAX_ZOOM,
        paint: hydroBasinsLinePaint(level),
      },
      beforeLayerId
    );
  }

  for (const [level, layerId] of labelLevels) {
    if (map.hasLayer(layerId)) {
      continue;
    }

    map.addLayer(
      {
        id: layerId,
        type: "symbol",
        source: HYDRO_BASINS_SOURCE_ID,
        "source-layer": `${level}-label`,
        minzoom: HYDRO_BASINS_VISUAL_MIN_ZOOM,
        maxzoom: HYDRO_BASINS_VISUAL_MAX_ZOOM,
        layout: hydroBasinsLabelLayout(level),
        paint: hydroBasinsLabelPaint(),
      },
      beforeLayerId
    );
  }
}

export function mountHydroBasinsLayer(
  options: MountHydroBasinsLayerOptions
): HydroBasinsVisibilityController {
  const state = initialState();
  const manifestPath = resolveEnvironmentalHydroBasinsManifestPath(options.manifestPath);
  const styleLayerIds = getHydroBasinsStyleLayerIds();
  const degradedLineLayerIds: readonly string[] = [];
  const degradedFillLayerIds: readonly string[] = [];
  const degradedLabelLayerIds = ["environmental-hydro-basins-huc6-label"];

  function applyVisibility(): void {
    if (!(bootstrap.isReady() && bootstrap.isSourceInitialized())) {
      return;
    }

    setLayerVisibility(
      options.map,
      [
        ...HYDRO_BASINS_FILL_LAYER_IDS,
        ...styleLayerIds.lineLayerIds,
        ...styleLayerIds.labelLayerIds,
      ],
      state.visible
    );

    if (!(state.visible && state.stressMode === "degraded")) {
      return;
    }

    setLayerVisibility(options.map, degradedFillLayerIds, false);
    setLayerVisibility(options.map, degradedLineLayerIds, false);
    setLayerVisibility(options.map, degradedLabelLayerIds, false);
  }

  const bootstrap = mountManifestBackedLayerBootstrap({
    contextLabel: "hydro-basins",
    dataset: HYDRO_BASINS_DATASET,
    ensureLayers() {
      ensureHydroBasinsLayers(options.map);
    },
    ensureSource(manifest) {
      ensureHydroBasinsSource(options.map, manifest, manifestPath);
    },
    manifestPath,
    map: options.map,

    onInitializationError(error: unknown) {
      const reason = error instanceof Error ? error.message : "initialization failed";
      state.status = { state: "error", reason };
    },
    onInitialized() {
      state.status = { state: "ready" };
      applyVisibility();
    },
    onReady(readyBootstrap) {
      if (state.visible) {
        state.status = { state: "loading" };
        readyBootstrap.initializeSource().catch(() => {
          return;
        });
        return;
      }

      if (readyBootstrap.isSourceInitialized()) {
        applyVisibility();
      }
    },
    startWhenStyleReady: true,
  });

  return {
    get status(): LayerStatus {
      return state.status;
    },
    setVisible(visible: boolean): void {
      state.visible = visible;
      if (visible && state.status.state !== "loading") {
        state.status = { state: "loading" };
        bootstrap.initializeSource().catch(() => {
          return;
        });
      }

      applyVisibility();
    },
    setStressMode(mode: HydroBasinsStressMode): void {
      state.stressMode = mode;
      applyVisibility();
    },
    destroy(): void {
      bootstrap.destroy();

      for (const layerId of [
        ...HYDRO_BASINS_FILL_LAYER_IDS,
        ...styleLayerIds.labelLayerIds,
        ...styleLayerIds.lineLayerIds,
      ]) {
        if (options.map.hasLayer(layerId)) {
          options.map.removeLayer(layerId);
        }
      }

      if (options.map.hasSource(HYDRO_BASINS_SOURCE_ID)) {
        options.map.removeSource(HYDRO_BASINS_SOURCE_ID);
      }
    },
  };
}
