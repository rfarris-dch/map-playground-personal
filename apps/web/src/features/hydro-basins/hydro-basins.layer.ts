import {
  assertTileManifestMatchesDataset,
  createPmtilesSourceUrl,
  type TilePublishManifest,
} from "@map-migration/geo-tiles";
import { loadTilePublishManifest } from "@map-migration/geo-tiles/effect";
import { getCatalogStyleLayerIds, getHydroBasinsStyleLayerIds } from "@map-migration/map-style";
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
const HYDRO_BASINS_MANIFEST_PATH = "/tiles/environmental-hydro-basins/latest.json";
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
  destroyed: boolean;
  manifest: TilePublishManifest | null;
  ready: boolean;
  sourceInitializationAbortController: AbortController | null;
  sourceInitializationPromise: Promise<void> | null;
  sourceInitialized: boolean;
  stressMode: HydroBasinsStressMode;
  visible: boolean;
}

function initialState(): HydroBasinsState {
  return {
    destroyed: false,
    manifest: null,
    ready: false,
    sourceInitialized: false,
    sourceInitializationAbortController: null,
    sourceInitializationPromise: null,
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
  manifest: TilePublishManifest
): void {
  if (map.hasSource(HYDRO_BASINS_SOURCE_ID)) {
    return;
  }

  map.addSource(HYDRO_BASINS_SOURCE_ID, {
    type: "vector",
    url: createPmtilesSourceUrl(manifest),
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
  const manifestPath = options.manifestPath ?? HYDRO_BASINS_MANIFEST_PATH;
  const styleLayerIds = getHydroBasinsStyleLayerIds();
  const degradedLineLayerIds: readonly string[] = [];
  const degradedFillLayerIds: readonly string[] = [];
  const degradedLabelLayerIds = ["environmental-hydro-basins-huc6-label"];

  function applyVisibility(): void {
    if (!(state.ready && state.sourceInitialized)) {
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

  function completeSourceInitialization(manifest: TilePublishManifest): void {
    assertTileManifestMatchesDataset(manifest, HYDRO_BASINS_DATASET, "hydro basins layer manifest");
    state.manifest = manifest;
    ensureHydroBasinsSource(options.map, manifest);
    ensureHydroBasinsLayers(options.map);
    state.sourceInitialized = true;
    applyVisibility();
  }

  function initializeSource(): Promise<void> {
    if (state.destroyed || state.sourceInitialized) {
      return Promise.resolve();
    }

    if (state.sourceInitializationPromise !== null) {
      return state.sourceInitializationPromise;
    }

    const nextPromise = (async (): Promise<void> => {
      state.sourceInitializationAbortController?.abort();
      const abortController = new AbortController();
      state.sourceInitializationAbortController = abortController;
      const manifest = await loadTilePublishManifest({
        contextLabel: "hydro-basins",
        manifestPath,
        signal: abortController.signal,
      });

      if (state.destroyed || abortController.signal.aborted) {
        return;
      }

      completeSourceInitialization(manifest);
    })().finally(() => {
      state.sourceInitializationAbortController = null;
      state.sourceInitializationPromise = null;
    });

    state.sourceInitializationPromise = nextPromise;
    return nextPromise;
  }

  const onLoad = (): void => {
    state.ready = true;

    if (state.visible) {
      initializeSource().catch((error: unknown) => {
        console.error("[hydro-basins] source initialization failed", error);
      });
      return;
    }

    if (state.sourceInitialized) {
      applyVisibility();
    }
  };

  options.map.on("load", onLoad);
  const existingStyleLayers = options.map.getStyle().layers;
  if (existingStyleLayers.length > 0) {
    onLoad();
  }

  return {
    setVisible(visible: boolean): void {
      state.visible = visible;
      if (visible) {
        initializeSource().catch((error: unknown) => {
          console.error("[hydro-basins] source initialization failed", error);
        });
      }

      applyVisibility();
    },
    setStressMode(mode: HydroBasinsStressMode): void {
      state.stressMode = mode;
      applyVisibility();
    },
    destroy(): void {
      state.destroyed = true;
      options.map.off("load", onLoad);
      state.sourceInitializationAbortController?.abort();

      for (const layerId of [...styleLayerIds.labelLayerIds, ...styleLayerIds.lineLayerIds]) {
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
