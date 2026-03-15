import type {
  IMap,
  MapExpression,
  MapProjectionSpecification,
  MapStyleLayer,
  MapStyleSpecification,
} from "@map-migration/map-engine";
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
  terrain: false,
};

const BASEMAP_LAYER_IDS: BasemapLayerId[] = [
  "color",
  "globe",
  "satellite",
  "terrain",
  "landmarks",
  "labels",
  "roads",
  "boundaries",
  "buildings3d",
];

const SATELLITE_SOURCE_ID = "basemap.satellite-source";
const SATELLITE_LAYER_ID = "basemap.satellite";
const TERRAIN_SOURCE_ID = "basemap.terrain-source";
const TERRAIN_HILLSHADE_LAYER_ID = "basemap.terrain-hillshade";
const OPENMAPTILES_SOURCE_ID = "openmaptiles";
const LANDMARKS_POI_LAYER_ID = "basemap.landmarks.poi";
const LANDMARKS_PEAK_LAYER_ID = "basemap.landmarks.peak";
const STATE_BOUNDARY_LAYER_ID = "boundary_3";
const STATE_LABELS_LAYER_ID = "basemap.state-labels";
const MISSING_SPRITE_SHIELD_LAYER_IDS = [
  "highway-shield-non-us",
  "highway-shield-us-interstate",
  "road_shield_us",
] as const;
const MISSING_SPRITE_SHIELD_LAYER_ID_SET = new Set<string>(MISSING_SPRITE_SHIELD_LAYER_IDS);
const DEFAULT_SATELLITE_TILE_URLS = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
];
const DEFAULT_SATELLITE_ATTRIBUTION =
  "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community";
const DEFAULT_SATELLITE_MAX_ZOOM = 19;
const DEFAULT_TERRAIN_SOURCE_URL = "https://demotiles.maplibre.org/terrain-tiles/tiles.json";
const DEFAULT_TERRAIN_EXAGGERATION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMapStyleSpecification(value: unknown): value is MapStyleSpecification {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof Reflect.get(value, "version") === "number" && Array.isArray(Reflect.get(value, "layers"))
  );
}

function isGetExpression(value: unknown): value is readonly ["get", string] {
  return (
    Array.isArray(value) && value.length === 2 && value[0] === "get" && typeof value[1] === "string"
  );
}

function isNameFieldExpression(value: unknown): value is readonly ["get", string] {
  return (
    isGetExpression(value) && (value[1] === "name" || value[1] === "name_en" || value[1] === "ref")
  );
}

function isNumericComparisonOperator(value: unknown): value is "<" | "<=" | ">" | ">=" {
  return value === "<" || value === "<=" || value === ">" || value === ">=";
}

function fallbackComparisonValue(
  operator: "<" | "<=" | ">" | ">=",
  comparisonValue: number
): number {
  if (operator === ">" || operator === ">=") {
    return comparisonValue - 1;
  }

  return comparisonValue + 1;
}

function sanitizeNumericComparisonOperand(
  operand: unknown,
  operator: "<" | "<=" | ">" | ">=",
  comparisonValue: number
): unknown {
  if (!isGetExpression(operand)) {
    return sanitizeStyleValue(operand);
  }

  return ["to-number", ["coalesce", operand, fallbackComparisonValue(operator, comparisonValue)]];
}

function sanitizeStyleValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (
      value[0] === "case" &&
      value.some((item) => isGetExpression(item) && item[1] === "name:nonlatin")
    ) {
      return ["coalesce", ["get", "name_en"], ["get", "name"], ["get", "ref"]];
    }

    if (
      value[0] === "concat" &&
      value.some((item) => isGetExpression(item) && item[1] === "name:nonlatin")
    ) {
      const textFields = value.filter((item) => isNameFieldExpression(item));
      if (textFields.length > 0) {
        return ["coalesce", ...textFields];
      }

      return ["coalesce", ["get", "name_en"], ["get", "name"], ["get", "ref"]];
    }

    if (
      value.length === 3 &&
      isNumericComparisonOperator(value[0]) &&
      typeof value[2] === "number"
    ) {
      return [value[0], sanitizeNumericComparisonOperand(value[1], value[0], value[2]), value[2]];
    }

    if (
      value.length === 3 &&
      typeof value[1] === "number" &&
      isNumericComparisonOperator(value[0])
    ) {
      return [value[0], value[1], sanitizeNumericComparisonOperand(value[2], value[0], value[1])];
    }

    return value.map((item) => sanitizeStyleValue(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  const nextValue: Record<string, unknown> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    nextValue[entryKey] = sanitizeStyleValue(entryValue);
  }

  return nextValue;
}

function sanitizeBasemapStyleLayer(layer: MapStyleLayer): MapStyleLayer {
  const sanitizedLayer = sanitizeStyleValue(layer);
  if (!isRecord(sanitizedLayer)) {
    return layer;
  }

  return sanitizedLayer as MapStyleLayer;
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

function findBuildingSourceId(map: IMap, profile: BasemapProfile): string | null {
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

  return null;
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

function shouldSkipGroupedBasemapLayer(layerId: string, profile: BasemapProfile): boolean {
  return (
    layerId === profile.buildingsLayerId ||
    layerId === SATELLITE_LAYER_ID ||
    layerId === LANDMARKS_POI_LAYER_ID ||
    layerId === LANDMARKS_PEAK_LAYER_ID
  );
}

function isBoundaryGroupLayer(
  layerId: string,
  layerType: string,
  sourceLayerId: string | null
): boolean {
  return (
    layerType === "line" &&
    sourceLayerId !== null &&
    sourceLayerId.includes("boundar") &&
    layerId !== STATE_BOUNDARY_LAYER_ID
  );
}

function isRoadGroupLayer(layerType: string, sourceLayerId: string | null): boolean {
  return sourceLayerId === "transportation" && (layerType === "fill" || layerType === "line");
}

function isWaterGroupLayer(layerType: string, sourceLayerId: string | null): boolean {
  return sourceLayerId === "water" && layerType === "fill";
}

function isLandGroupLayer(
  layerId: string,
  layerType: string,
  sourceLayerId: string | null
): boolean {
  if (layerType === "background") {
    return true;
  }

  if (layerType !== "fill") {
    return false;
  }

  if (sourceLayerId === "landcover" || sourceLayerId === "landuse" || sourceLayerId === "park") {
    return true;
  }

  if (
    layerId === "background" ||
    layerId.startsWith("landcover") ||
    layerId.startsWith("landuse") ||
    layerId.startsWith("park")
  ) {
    return true;
  }

  return false;
}

function collectBasemapLayerGroups(map: IMap, profile: BasemapProfile): BasemapLayerGroups {
  const style = map.getStyle();
  const styleLayers = style.layers ?? [];
  const boundaryLayerIds: string[] = [];
  const labelLayerIds: string[] = [];
  const roadLayerIds: string[] = [];
  const waterLayerIds: string[] = [];
  const landLayerIds: string[] = [];

  for (const styleLayer of styleLayers) {
    const layerId = readLayerId(styleLayer);
    if (layerId === null) {
      continue;
    }

    if (shouldSkipGroupedBasemapLayer(layerId, profile)) {
      continue;
    }

    const layerType = readLayerType(styleLayer);
    if (layerType === null) {
      continue;
    }

    const sourceLayerId = readSourceLayerId(styleLayer);

    if (isBoundaryGroupLayer(layerId, layerType, sourceLayerId)) {
      boundaryLayerIds.push(layerId);
    }

    if (isRoadGroupLayer(layerType, sourceLayerId)) {
      roadLayerIds.push(layerId);
    }

    if (layerType === "symbol" && hasTextFieldLayout(styleLayer)) {
      labelLayerIds.push(layerId);
    }

    if (isWaterGroupLayer(layerType, sourceLayerId)) {
      waterLayerIds.push(layerId);
    }

    if (isLandGroupLayer(layerId, layerType, sourceLayerId)) {
      landLayerIds.push(layerId);
    }
  }

  return {
    boundaryLayerIds,
    labelLayerIds,
    landLayerIds,
    roadLayerIds,
    waterLayerIds,
  };
}

function resolveLayerGroupIds(groups: BasemapLayerGroups, targetLayer: string): readonly string[] {
  switch (targetLayer) {
    case "water":
      return groups.waterLayerIds;
    case "road":
      return groups.roadLayerIds;
    case "boundary":
      return groups.boundaryLayerIds;
    case "land":
      return groups.landLayerIds;
    default:
      return [];
  }
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

function ensureTerrainSource(map: IMap): void {
  if (map.hasSource(TERRAIN_SOURCE_ID)) {
    return;
  }

  map.addSource(TERRAIN_SOURCE_ID, {
    type: "raster-dem",
    url: DEFAULT_TERRAIN_SOURCE_URL,
    tileSize: 256,
  });
}

function ensureTerrainHillshadeLayer(map: IMap): void {
  if (map.hasLayer(TERRAIN_HILLSHADE_LAYER_ID)) {
    return;
  }

  map.addLayer(
    {
      id: TERRAIN_HILLSHADE_LAYER_ID,
      type: "hillshade",
      source: TERRAIN_SOURCE_ID,
      paint: {
        "hillshade-shadow-color": "#473B24",
      },
    },
    findSatelliteInsertLayerId(map)
  );
}

function suppressMissingSpriteShieldLayers(map: IMap): void {
  for (const layerId of MISSING_SPRITE_SHIELD_LAYER_IDS) {
    if (!map.hasLayer(layerId)) {
      continue;
    }

    map.setLayerVisibility(layerId, false);
  }
}

function ensureLandmarkLayers(map: IMap): void {
  if (!map.hasSource(OPENMAPTILES_SOURCE_ID)) {
    console.warn(
      `[basemap] Missing "${OPENMAPTILES_SOURCE_ID}" vector source; landmarks unavailable.`
    );
    return;
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
          ["<=", ["to-number", ["coalesce", ["get", "rank"], 99]], 8],
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
          ["<=", ["to-number", ["coalesce", ["get", "rank"], 99]], 6],
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

function ensureStateBoundaryVisible(map: IMap): void {
  if (map.hasLayer(STATE_BOUNDARY_LAYER_ID)) {
    map.setLayerVisibility(STATE_BOUNDARY_LAYER_ID, true);
  }
}

function ensureStateLabels(map: IMap): void {
  if (!map.hasSource(OPENMAPTILES_SOURCE_ID)) {
    return;
  }

  if (map.hasLayer(STATE_LABELS_LAYER_ID)) {
    return;
  }

  map.addLayer({
    id: STATE_LABELS_LAYER_ID,
    type: "symbol",
    source: OPENMAPTILES_SOURCE_ID,
    "source-layer": "place",
    minzoom: 3,
    maxzoom: 8,
    filter: ["==", ["get", "class"], "state"],
    layout: {
      "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 6, 13, 8, 15],
      "text-transform": "uppercase",
      "text-letter-spacing": 0.1,
      "text-max-width": 8,
    },
    paint: {
      "text-color": "#475569",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.5,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.7, 5, 0.9, 8, 0.5],
    },
  });
}

function add3DBuildings(map: IMap, profile: BasemapProfile, sourceId: string): void {
  if (map.hasLayer(profile.buildingsLayerId)) {
    return;
  }

  const firstLabelLayerId = findFirstLabelLayerId(map);
  const buildingHeight: MapExpression = ["coalesce", ["get", "render_height"], 0];
  const buildingBaseHeight: MapExpression = ["coalesce", ["get", "render_min_height"], 0];
  const buildingZoomRampStart = profile.buildingsMinZoom - 1;
  const buildingZoomRampEnd = profile.buildingsMinZoom + 1;

  map.addLayer(
    {
      id: profile.buildingsLayerId,
      type: "fill-extrusion",
      source: sourceId,
      "source-layer": profile.buildingSourceLayer,
      filter: ["!=", ["get", "hide_3d"], true],
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          buildingHeight,
          0,
          "#d3d3d3",
          200,
          "#4169e1",
          400,
          "#add8e6",
        ],
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          buildingZoomRampStart,
          0,
          buildingZoomRampEnd,
          buildingHeight,
        ],
        "fill-extrusion-base": [
          "interpolate",
          ["linear"],
          ["zoom"],
          buildingZoomRampStart,
          0,
          buildingZoomRampEnd,
          buildingBaseHeight,
        ],
        "fill-extrusion-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          buildingZoomRampStart,
          0,
          profile.buildingsMinZoom,
          profile.buildingsOpacity,
        ],
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
  args.map.setLayerVisibility(TERRAIN_HILLSHADE_LAYER_ID, args.visibility.terrain);
  args.map.setTerrain(
    args.visibility.terrain
      ? {
          source: TERRAIN_SOURCE_ID,
          exaggeration: DEFAULT_TERRAIN_EXAGGERATION,
        }
      : null
  );
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

  if (layerId === "terrain") {
    return {
      ...visibility,
      terrain: visible,
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

  if (layerId === "terrain") {
    return visibility.terrain;
  }

  return visibility.satellite;
}

export function defaultBasemapStyleUrl(): string {
  return DEFAULT_BASEMAP_PROFILE.styleUrl;
}

export async function loadBasemapStyle(styleUrl: string): Promise<MapStyleSpecification> {
  const response = await fetch(styleUrl);
  if (!response.ok) {
    throw new Error(`[basemap] Failed to load style "${styleUrl}" (${response.status}).`);
  }

  const styleJson: unknown = await response.json();
  if (!isMapStyleSpecification(styleJson)) {
    throw new Error(`[basemap] Invalid style payload from "${styleUrl}".`);
  }

  return {
    ...styleJson,
    layers: (styleJson.layers ?? [])
      .filter((layer) => !MISSING_SPRITE_SHIELD_LAYER_ID_SET.has(layer.id))
      .map((layer) => sanitizeBasemapStyleLayer(layer)),
  };
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
    try {
      syncProjection();
      suppressMissingSpriteShieldLayers(map);
      ensureSatelliteLayer(map);
      ensureTerrainSource(map);
      ensureTerrainHillshadeLayer(map);
    } catch (coreError: unknown) {
      console.error("[basemap] failed during core layer setup in onLoad", coreError);
      return;
    }

    try {
      ensureLandmarkLayers(map);
    } catch (landmarkError: unknown) {
      console.warn("[basemap] landmarks unavailable", landmarkError);
    }

    try {
      ensureStateBoundaryVisible(map);
      ensureStateLabels(map);
    } catch (boundaryError: unknown) {
      console.warn("[basemap] state boundaries/labels unavailable", boundaryError);
    }

    try {
      const buildingSourceId = findBuildingSourceId(map, profile);
      if (buildingSourceId !== null) {
        add3DBuildings(map, profile, buildingSourceId);
      } else {
        console.warn("[basemap] building source not found; 3D buildings unavailable");
      }
    } catch (buildingError: unknown) {
      console.warn("[basemap] 3D buildings unavailable", buildingError);
    }

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
        const previousProfile = profile;
        const previousGroups = groups;
        const previousVisibility = withBasemapLayerVisibility(visibility, layerId, !nextVisible);

        loadBasemapStyle(nextProfile.styleUrl)
          .then((style) => {
            profile = nextProfile;
            groups = null;
            map.setStyle(style);
            syncProjection();
          })
          .catch((error: unknown) => {
            console.error("[basemap] failed to switch basemap style, reverting", error);
            profile = previousProfile;
            groups = previousGroups;
            visibility = previousVisibility;
          });
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
    setLayerColor(targetLayer: string, color: string): void {
      if (groups === null) {
        return;
      }

      const layerIds = resolveLayerGroupIds(groups, targetLayer);
      const style = map.getStyle();
      const styleLayers = style.layers ?? [];
      const layerTypeMap = new Map<string, string>();
      for (const sl of styleLayers) {
        const id = readLayerId(sl);
        const type = readLayerType(sl);
        if (id !== null && type !== null) {
          layerTypeMap.set(id, type);
        }
      }

      for (const lid of layerIds) {
        const type = layerTypeMap.get(lid);
        if (type === "background") {
          map.setPaintProperty(lid, "background-color", color);
        } else if (type === "line") {
          map.setPaintProperty(lid, "line-color", color);
        } else {
          map.setPaintProperty(lid, "fill-color", color);
        }
      }
    },
    destroy(): void {
      clearProjectionSyncTimer();
      map.off("load", onLoad);
    },
  };
}
