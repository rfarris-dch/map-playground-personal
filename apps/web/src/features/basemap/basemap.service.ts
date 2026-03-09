import type { IMap, MapProjectionSpecification } from "@map-migration/map-engine";
import type {
  BasemapLayerId,
  BasemapLayerVisibilityController,
  BasemapProfile,
  BasemapVisibilityState,
} from "@/features/basemap/basemap.types";
import type {
  BasemapLayerGroups,
  MountBasemapLayerVisibilityOptions,
} from "./basemap.service.types";

const MONOCHROME_BASEMAP_PROFILE: BasemapProfile = {
  id: "monochrome",
  styleUrl: "https://tiles.openfreemap.org/styles/positron",
  buildingSourceLayer: "building",
  buildingsLayerId: "basemap.3d-buildings",
  buildingsMinZoom: 15,
  buildingsOpacity: 0.65,
};

const COLOR_BASEMAP_PROFILE: BasemapProfile = {
  id: "color",
  styleUrl: "https://tiles.openfreemap.org/styles/liberty",
  buildingSourceLayer: "building",
  buildingsLayerId: "basemap.3d-buildings",
  buildingsMinZoom: 15,
  buildingsOpacity: 0.65,
};

const DEFAULT_BASEMAP_PROFILE = MONOCHROME_BASEMAP_PROFILE;

const DEFAULT_BASEMAP_VISIBILITY_STATE: BasemapVisibilityState = {
  boundaries: false,
  buildings3d: true,
  color: false,
  globe: false,
  labels: true,
  landmarks: false,
  roads: true,
  satellite: false,
};

const BASEMAP_LAYER_IDS: BasemapLayerId[] = [
  "color",
  "globe",
  "satellite",
  "landmarks",
  "labels",
  "roads",
  "boundaries",
  "buildings3d",
];

const SATELLITE_SOURCE_ID = "basemap.satellite-source";
const SATELLITE_LAYER_ID = "basemap.satellite";
const OPENMAPTILES_SOURCE_ID = "openmaptiles";
const LANDMARKS_POI_LAYER_ID = "basemap.landmarks.poi";
const LANDMARKS_PEAK_LAYER_ID = "basemap.landmarks.peak";
const DEFAULT_SATELLITE_TILE_URLS = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
];
const DEFAULT_SATELLITE_ATTRIBUTION =
  "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community";
const DEFAULT_SATELLITE_MAX_ZOOM = 19;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push(value);
  }

  return unique;
}

function parseCsvUrls(value: string): readonly string[] {
  const urls = value
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  return uniqueStrings(urls);
}

function readSatelliteTileUrls(): readonly string[] {
  const multiUrlValue = import.meta.env.VITE_SATELLITE_BASEMAP_URLS;
  if (typeof multiUrlValue === "string" && multiUrlValue.trim().length > 0) {
    const parsedUrls = parseCsvUrls(multiUrlValue);
    if (parsedUrls.length > 0) {
      return parsedUrls;
    }
  }

  const singleUrlValue = import.meta.env.VITE_SATELLITE_BASEMAP_URL;
  if (typeof singleUrlValue === "string" && singleUrlValue.trim().length > 0) {
    return [singleUrlValue.trim()];
  }

  return DEFAULT_SATELLITE_TILE_URLS;
}

function readSatelliteMaxZoom(): number {
  const rawValue = import.meta.env.VITE_SATELLITE_MAX_ZOOM;
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return DEFAULT_SATELLITE_MAX_ZOOM;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_SATELLITE_MAX_ZOOM;
  }

  const normalizedValue = Math.floor(parsedValue);
  if (normalizedValue < 0 || normalizedValue > 22) {
    return DEFAULT_SATELLITE_MAX_ZOOM;
  }

  return normalizedValue;
}

function findBuildingSourceId(map: IMap, profile: BasemapProfile): string {
  const style = map.getStyle();
  const layers = style.layers ?? [];

  for (const layer of layers) {
    if (readSourceLayerId(layer) !== profile.buildingSourceLayer) {
      continue;
    }

    const sourceId = readSourceId(layer);
    if (sourceId !== null) {
      return sourceId;
    }
  }

  throw new Error(
    `[basemap] Missing "${profile.buildingSourceLayer}" source-layer in style "${style.name ?? "unnamed"}".`
  );
}

function findFirstLabelLayerId(map: IMap): string | undefined {
  const style = map.getStyle();
  const layers = style.layers ?? [];

  for (const layer of layers) {
    if (layer.type !== "symbol" || !layer.layout) {
      continue;
    }
    if ("text-field" in layer.layout) {
      return layer.id;
    }
  }

  return undefined;
}

function findSatelliteInsertLayerId(map: IMap): string | undefined {
  const style = map.getStyle();
  const layers = style.layers ?? [];

  for (const layer of layers) {
    if (layer.type === "line" || layer.type === "symbol") {
      return layer.id;
    }
  }

  return undefined;
}

function readLayerId(layer: unknown): string | null {
  if (!isRecord(layer)) {
    return null;
  }

  const layerId = Reflect.get(layer, "id");
  if (typeof layerId !== "string" || layerId.trim().length === 0) {
    return null;
  }

  return layerId;
}

function readSourceId(layer: unknown): string | null {
  if (!isRecord(layer)) {
    return null;
  }

  const sourceId = Reflect.get(layer, "source");
  if (typeof sourceId !== "string" || sourceId.trim().length === 0) {
    return null;
  }

  return sourceId;
}

function readLayerType(layer: unknown): string | null {
  if (!isRecord(layer)) {
    return null;
  }

  const layerType = Reflect.get(layer, "type");
  if (typeof layerType !== "string" || layerType.trim().length === 0) {
    return null;
  }

  return layerType;
}

function readProjectionType(projection: unknown): string | null {
  if (!isRecord(projection)) {
    return null;
  }

  const projectionType = Reflect.get(projection, "type");
  if (typeof projectionType !== "string" || projectionType.trim().length === 0) {
    return null;
  }

  return projectionType;
}

function readSourceLayerId(layer: unknown): string | null {
  if (!isRecord(layer)) {
    return null;
  }

  const sourceLayerId = Reflect.get(layer, "source-layer");
  if (typeof sourceLayerId !== "string" || sourceLayerId.trim().length === 0) {
    return null;
  }

  return sourceLayerId;
}

function hasTextFieldLayout(layer: unknown): boolean {
  if (!isRecord(layer)) {
    return false;
  }

  const layout = Reflect.get(layer, "layout");
  if (!isRecord(layout)) {
    return false;
  }

  return typeof Reflect.get(layout, "text-field") !== "undefined";
}

function collectBasemapLayerGroups(map: IMap, profile: BasemapProfile): BasemapLayerGroups {
  const style = map.getStyle();
  const styleLayers = style.layers ?? [];
  const boundaryLayerIds: string[] = [];
  const labelLayerIds: string[] = [];
  const roadLayerIds: string[] = [];

  for (const styleLayer of styleLayers) {
    const layerId = readLayerId(styleLayer);
    if (layerId === null) {
      continue;
    }

    if (
      layerId === profile.buildingsLayerId ||
      layerId === SATELLITE_LAYER_ID ||
      layerId === LANDMARKS_POI_LAYER_ID ||
      layerId === LANDMARKS_PEAK_LAYER_ID
    ) {
      continue;
    }

    const layerType = readLayerType(styleLayer);
    if (layerType === null) {
      continue;
    }

    const sourceLayerId = readSourceLayerId(styleLayer);

    if (layerType === "line" && sourceLayerId !== null && sourceLayerId.includes("boundar")) {
      boundaryLayerIds.push(layerId);
    }

    if (sourceLayerId === "transportation" && (layerType === "fill" || layerType === "line")) {
      roadLayerIds.push(layerId);
    }

    if (layerType === "symbol" && hasTextFieldLayout(styleLayer)) {
      labelLayerIds.push(layerId);
    }
  }

  return {
    boundaryLayerIds,
    labelLayerIds,
    roadLayerIds,
  };
}

function ensureSatelliteLayer(map: IMap): void {
  const satelliteTileUrls = readSatelliteTileUrls();
  const satelliteMaxZoom = readSatelliteMaxZoom();

  if (!map.hasSource(SATELLITE_SOURCE_ID)) {
    map.addSource(SATELLITE_SOURCE_ID, {
      type: "raster",
      tiles: [...satelliteTileUrls],
      tileSize: 256,
      maxzoom: satelliteMaxZoom,
      attribution: DEFAULT_SATELLITE_ATTRIBUTION,
    });
  }

  if (!map.hasLayer(SATELLITE_LAYER_ID)) {
    map.addLayer(
      {
        id: SATELLITE_LAYER_ID,
        type: "raster",
        source: SATELLITE_SOURCE_ID,
        paint: {
          "raster-opacity": 1,
          "raster-fade-duration": 0,
        },
      },
      findSatelliteInsertLayerId(map)
    );
  }
}

function ensureLandmarkLayers(map: IMap): void {
  if (!map.hasSource(OPENMAPTILES_SOURCE_ID)) {
    throw new Error(`[basemap] Missing "${OPENMAPTILES_SOURCE_ID}" vector source for landmarks.`);
  }

  const beforeId = findFirstLabelLayerId(map);

  if (!map.hasLayer(LANDMARKS_POI_LAYER_ID)) {
    map.addLayer(
      {
        id: LANDMARKS_POI_LAYER_ID,
        type: "symbol",
        source: OPENMAPTILES_SOURCE_ID,
        "source-layer": "poi",
        minzoom: 10,
        filter: [
          "all",
          ["has", "name"],
          ["<=", ["coalesce", ["to-number", ["get", "rank"]], 99], 8],
        ],
        layout: {
          "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 14, 13],
          "text-anchor": "top",
          "text-offset": [0, 0.8],
        },
        paint: {
          "text-color": "#1f2937",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1,
        },
      },
      beforeId
    );
  }

  if (!map.hasLayer(LANDMARKS_PEAK_LAYER_ID)) {
    map.addLayer(
      {
        id: LANDMARKS_PEAK_LAYER_ID,
        type: "symbol",
        source: OPENMAPTILES_SOURCE_ID,
        "source-layer": "mountain_peak",
        minzoom: 9,
        filter: [
          "all",
          ["has", "name"],
          ["<=", ["coalesce", ["to-number", ["get", "rank"]], 99], 6],
        ],
        layout: {
          "text-field": ["concat", "▲ ", ["coalesce", ["get", "name_en"], ["get", "name"]]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 9, 10, 14, 12],
          "text-anchor": "top",
          "text-offset": [0, 0.7],
        },
        paint: {
          "text-color": "#334155",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1,
        },
      },
      beforeId
    );
  }
}

function add3DBuildings(map: IMap, profile: BasemapProfile, sourceId: string): void {
  if (map.hasLayer(profile.buildingsLayerId)) {
    return;
  }

  const firstLabelLayerId = findFirstLabelLayerId(map);

  map.addLayer(
    {
      id: profile.buildingsLayerId,
      type: "fill-extrusion",
      source: sourceId,
      "source-layer": profile.buildingSourceLayer,
      minzoom: profile.buildingsMinZoom,
      paint: {
        "fill-extrusion-color": "#d6d3d1",
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 0],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": profile.buildingsOpacity,
      },
    },
    firstLabelLayerId
  );
}

function applyLayerVisibility(map: IMap, layerIds: readonly string[], visible: boolean): void {
  for (const layerId of layerIds) {
    map.setLayerVisibility(layerId, visible);
  }
}

function applyBasemapVisibility(args: {
  readonly groups: BasemapLayerGroups;
  readonly map: IMap;
  readonly profile: BasemapProfile;
  readonly visibility: BasemapVisibilityState;
}): void {
  applyLayerVisibility(args.map, args.groups.boundaryLayerIds, args.visibility.boundaries);
  applyLayerVisibility(args.map, args.groups.roadLayerIds, args.visibility.roads);
  applyLayerVisibility(args.map, args.groups.labelLayerIds, args.visibility.labels);

  const landmarksVisible = args.visibility.landmarks && args.visibility.labels;
  args.map.setLayerVisibility(LANDMARKS_POI_LAYER_ID, landmarksVisible);
  args.map.setLayerVisibility(LANDMARKS_PEAK_LAYER_ID, landmarksVisible);
  args.map.setLayerVisibility(args.profile.buildingsLayerId, args.visibility.buildings3d);
  args.map.setLayerVisibility(SATELLITE_LAYER_ID, args.visibility.satellite);
}

function resolveBasemapProfile(visibility: BasemapVisibilityState): BasemapProfile {
  if (visibility.color) {
    return COLOR_BASEMAP_PROFILE;
  }

  return MONOCHROME_BASEMAP_PROFILE;
}

function resolveBasemapProjection(visibility: BasemapVisibilityState): MapProjectionSpecification {
  if (visibility.globe) {
    return { type: "globe" };
  }

  return { type: "mercator" };
}

function applyBasemapProjection(map: IMap, visibility: BasemapVisibilityState): void {
  map.setProjection(resolveBasemapProjection(visibility));
}

export function withBasemapLayerVisibility(
  visibility: BasemapVisibilityState,
  layerId: BasemapLayerId,
  visible: boolean
): BasemapVisibilityState {
  if (layerId === "boundaries") {
    return {
      ...visibility,
      boundaries: visible,
    };
  }

  if (layerId === "buildings3d") {
    return {
      ...visibility,
      buildings3d: visible,
    };
  }

  if (layerId === "color") {
    return {
      ...visibility,
      color: visible,
    };
  }

  if (layerId === "globe") {
    return {
      ...visibility,
      globe: visible,
    };
  }

  if (layerId === "labels") {
    return {
      ...visibility,
      labels: visible,
    };
  }

  if (layerId === "landmarks") {
    return {
      ...visibility,
      landmarks: visible,
    };
  }

  if (layerId === "roads") {
    return {
      ...visibility,
      roads: visible,
    };
  }

  return {
    ...visibility,
    satellite: visible,
  };
}

export function isBasemapLayerVisible(
  visibility: BasemapVisibilityState,
  layerId: BasemapLayerId
): boolean {
  if (layerId === "boundaries") {
    return visibility.boundaries;
  }

  if (layerId === "buildings3d") {
    return visibility.buildings3d;
  }

  if (layerId === "color") {
    return visibility.color;
  }

  if (layerId === "globe") {
    return visibility.globe;
  }

  if (layerId === "labels") {
    return visibility.labels;
  }

  if (layerId === "landmarks") {
    return visibility.landmarks;
  }

  if (layerId === "roads") {
    return visibility.roads;
  }

  return visibility.satellite;
}

export function defaultBasemapStyleUrl(): string {
  return DEFAULT_BASEMAP_PROFILE.styleUrl;
}

export function basemapLayerIds(): readonly BasemapLayerId[] {
  return BASEMAP_LAYER_IDS;
}

export function defaultBasemapVisibilityState(): BasemapVisibilityState {
  return DEFAULT_BASEMAP_VISIBILITY_STATE;
}

export function buildInitialBasemapVisibilityState(): BasemapVisibilityState {
  return defaultBasemapVisibilityState();
}

export function mountBasemapLayerVisibility(
  map: IMap,
  options: MountBasemapLayerVisibilityOptions = {}
): BasemapLayerVisibilityController {
  let visibility = options.visibility ?? DEFAULT_BASEMAP_VISIBILITY_STATE;
  let profile = options.profile ?? resolveBasemapProfile(visibility);
  let groups: BasemapLayerGroups | null = null;
  let projectionSyncTimer: number | null = null;

  function clearProjectionSyncTimer(): void {
    if (projectionSyncTimer === null) {
      return;
    }

    window.clearTimeout(projectionSyncTimer);
    projectionSyncTimer = null;
  }

  function syncProjection(attempt = 0): void {
    const desiredProjection = resolveBasemapProjection(visibility);

    applyBasemapProjection(map, visibility);

    const currentProjectionType = readProjectionType(map.getProjection());
    if (currentProjectionType === desiredProjection.type || attempt >= 6) {
      clearProjectionSyncTimer();
      return;
    }

    clearProjectionSyncTimer();
    projectionSyncTimer = window.setTimeout(() => {
      syncProjection(attempt + 1);
    }, 120);
  }

  const onLoad = (): void => {
    syncProjection();
    ensureSatelliteLayer(map);
    ensureLandmarkLayers(map);
    const buildingSourceId = findBuildingSourceId(map, profile);
    add3DBuildings(map, profile, buildingSourceId);
    groups = collectBasemapLayerGroups(map, profile);
    applyBasemapVisibility({
      map,
      profile,
      groups,
      visibility,
    });
  };

  map.on("load", onLoad);

  return {
    setVisible(layerId: BasemapLayerId, nextVisible: boolean): void {
      visibility = withBasemapLayerVisibility(visibility, layerId, nextVisible);
      if (layerId === "globe") {
        syncProjection();
      }

      const nextProfile = resolveBasemapProfile(visibility);
      if (nextProfile.id !== profile.id) {
        profile = nextProfile;
        groups = null;
        map.setStyle(profile.styleUrl);
        syncProjection();
        return;
      }

      if (groups === null) {
        return;
      }

      applyBasemapVisibility({
        map,
        profile,
        groups,
        visibility,
      });
    },
    getVisible(layerId: BasemapLayerId): boolean {
      return isBasemapLayerVisible(visibility, layerId);
    },
    destroy(): void {
      clearProjectionSyncTimer();
      map.off("load", onLoad);
    },
  };
}
