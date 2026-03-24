import { runEffectPromise } from "@map-migration/core-runtime/effect";
import type {
  CountyPowerStoryGeometryFeature,
  CountyPowerStoryId,
  CountyPowerStoryRow,
  CountyPowerStoryTimelineFrameRow,
  CountyPowerStoryWindow,
} from "@map-migration/http-contracts/county-power-story-http";
import {
  COUNTY_POWER_STORY_TILE_PROMOTE_ID,
  COUNTY_POWER_STORY_TILE_SOURCE_LAYER,
} from "@map-migration/http-contracts/county-power-story-http";
import type { MarketBoundaryFeature } from "@map-migration/http-contracts/market-boundaries-http";
import type {
  IMap,
  MapClickEvent,
  MapExpression,
  MapLayerSpecification,
  MapPointerEvent,
  MapRenderedFeature,
} from "@map-migration/map-engine";
import { DEFAULT_LAYER_CATALOG } from "@map-migration/map-layer-catalog";
import { getFacilitiesStyleLayerIds, validateLayerOrder } from "@map-migration/map-style";
import { Effect, Either } from "effect";
import { countyPowerStoryLayerId } from "@/features/app/core/app-shell.constants";
import { fetchCountyScoresStatus } from "@/features/county-intelligence/county-intelligence.api";
import { initialLayerStatus, type LayerStatus } from "@/features/layers/layer-runtime.types";
import { fetchMarketBoundariesEffect } from "@/features/market-boundaries/api";
import { createFeatureHoverController } from "@/lib/map-feature-hover.service";
import {
  fetchCountyPowerStoryGeometry,
  fetchCountyPowerStorySnapshot,
  fetchCountyPowerStoryTimeline,
  readCountyPowerStoryVectorTileTemplate,
} from "./county-power-story.api";
import {
  COUNTY_POWER_STORY_MORPH_STATE,
  COUNTY_POWER_STORY_PHASE_STATE,
  COUNTY_POWER_STORY_SOURCE_ID,
  COUNTY_POWER_STORY_STATUS_POLL_MS,
  countyPowerStoryCatalogLayerIds,
  countyPowerStoryExtrusionHeightExpression,
  countyPowerStoryExtrusionLayerId,
  countyPowerStoryFillColorExpression,
  countyPowerStoryFillOpacityExpression,
  countyPowerStoryOutlineColorExpression,
  countyPowerStoryOutlineDashExpression,
  countyPowerStoryOutlineWidthExpression,
  countyPowerStoryStyleLayerIds,
  storyIdFromCatalogLayerId,
} from "./county-power-story.service";
import type {
  CountyPowerStoryCatalogLayerId,
  CountyPowerStoryChapterId,
  CountyPowerStoryHoverState,
  CountyPowerStoryLayerVisibilityController,
  CountyPowerStoryMountResult,
  CountyPowerStoryRuntimeController,
  CountyPowerStorySelectionState,
} from "./county-power-story.types";
import {
  type AnimatedRoute,
  buildAnimatedRouteSegments,
  buildCountyCentroidsByFips,
  buildOperatorHeartbeatSources,
  buildPolicyShockwaveSourceData,
  buildQueuePressureSources,
  buildSeamHazeSourceData,
  buildTransferConnectorSourceData,
  buildTransmissionCorridorSourceData,
  COUNTY_POWER_STORY_HEARTBEAT_FILL_LAYER_ID,
  COUNTY_POWER_STORY_HEARTBEAT_OUTLINE_LAYER_ID,
  COUNTY_POWER_STORY_HEARTBEAT_SOURCE_ID,
  COUNTY_POWER_STORY_POLICY_CENTER_LAYER_ID,
  COUNTY_POWER_STORY_POLICY_RING_LAYER_ID,
  COUNTY_POWER_STORY_POLICY_SOURCE_ID,
  COUNTY_POWER_STORY_QUEUE_HEAT_LAYER_ID,
  COUNTY_POWER_STORY_QUEUE_HOTSPOT_LAYER_ID,
  COUNTY_POWER_STORY_QUEUE_HOTSPOT_SOURCE_ID,
  COUNTY_POWER_STORY_QUEUE_PULSE_IMAGE_ID,
  COUNTY_POWER_STORY_QUEUE_SOURCE_ID,
  COUNTY_POWER_STORY_SCAN_AMBER_IMAGE_ID,
  COUNTY_POWER_STORY_SCAN_GREEN_IMAGE_ID,
  COUNTY_POWER_STORY_SCAN_LAYER_ID,
  COUNTY_POWER_STORY_SCAN_RED_IMAGE_ID,
  COUNTY_POWER_STORY_SEAM_HAZE_LAYER_ID,
  COUNTY_POWER_STORY_SEAM_HAZE_SOURCE_ID,
  COUNTY_POWER_STORY_SUBREGION_OUTLINE_LAYER_ID,
  COUNTY_POWER_STORY_SUBREGION_SOURCE_ID,
  COUNTY_POWER_STORY_TRANSFER_BASE_LAYER_ID,
  COUNTY_POWER_STORY_TRANSFER_BASE_SOURCE_ID,
  COUNTY_POWER_STORY_TRANSFER_FLOW_LAYER_ID,
  COUNTY_POWER_STORY_TRANSFER_FLOW_SOURCE_ID,
  COUNTY_POWER_STORY_TRANSMISSION_BASE_LAYER_ID,
  COUNTY_POWER_STORY_TRANSMISSION_FLOW_LAYER_ID,
  COUNTY_POWER_STORY_TRANSMISSION_FLOW_SOURCE_ID,
  COUNTY_POWER_STORY_TRANSMISSION_SOURCE_ID,
  COUNTY_POWER_STORY_TRANSMISSION_TILE_URL,
  createPulsingDotImage,
  createStripePatternImage,
  emptyLineFeatureCollection,
  emptyPointFeatureCollection,
  emptyPolygonFeatureCollection,
  prepareAnimatedRoutes,
  scanCategoryForRow,
  visibleChapterLayerIds,
} from "./county-power-story-overlay.service";

interface MountCountyPowerStoryLayerOptions {
  readonly isHoverSuppressed?: (() => boolean) | undefined;
  readonly isInteractionEnabled?: (() => boolean) | undefined;
  readonly onHoverChange?: ((nextHover: CountyPowerStoryHoverState | null) => void) | undefined;
  readonly onSelectionChange?:
    | ((nextSelection: CountyPowerStorySelectionState | null) => void)
    | undefined;
}

interface CountyPowerStorySnapshotCacheEntry {
  readonly publicationRunId: string | null;
  readonly rowsByCounty: ReadonlyMap<string, CountyPowerStoryRow>;
  readonly storyId: CountyPowerStoryId;
  readonly window: CountyPowerStoryWindow;
}

interface CountyPowerStoryLayerState {
  activeSnapshotKey: string | null;
  animationEnabled: boolean;
  chapterId: CountyPowerStoryChapterId;
  chapterVisible: boolean;
  countyGeometryFeatures: readonly CountyPowerStoryGeometryFeature[];
  countyGeometryRequest: Promise<void> | null;
  destroyed: boolean;
  latestRequestedSnapshotKey: string | null;
  layerVisibility: Record<CountyPowerStoryCatalogLayerId, boolean>;
  marketBoundaryRequest: Promise<void> | null;
  marketFeatures: readonly MarketBoundaryFeature[];
  morphFrame: number | null;
  pendingSnapshotRequests: Map<string, Promise<CountyPowerStorySnapshotCacheEntry>>;
  pollInFlight: boolean;
  pollTimer: ReturnType<typeof globalThis.setInterval> | null;
  publicationRunId: string | null;
  queueTimelineFrames: ReadonlyMap<
    CountyPowerStoryWindow,
    readonly CountyPowerStoryTimelineFrameRow[]
  >;
  queueTimelineRequest: Promise<void> | null;
  ready: boolean;
  renderedStoryId: CountyPowerStoryId | null;
  renderedWindow: CountyPowerStoryWindow | null;
  rowsByCounty: ReadonlyMap<string, CountyPowerStoryRow>;
  seamHazeEnabled: boolean;
  selectedCountyFips: string | null;
  snapshotCache: Map<string, CountyPowerStorySnapshotCacheEntry>;
  storyId: CountyPowerStoryId;
  styleReady: boolean;
  submarketFeatures: readonly MarketBoundaryFeature[];
  threeDimensional: boolean;
  transferRoutes: readonly AnimatedRoute[];
  transmissionRoutes: readonly AnimatedRoute[];
  visible: boolean;
  window: CountyPowerStoryWindow;
}

interface CountyPowerStoryRenderProperties
  extends Record<string, boolean | null | number | string> {
  readonly categoryKey: string | null;
  readonly direction: CountyPowerStoryRow["direction"];
  readonly isSeamCounty: boolean;
  readonly marketStructure: CountyPowerStoryRow["marketStructure"];
  readonly moratoriumStatus: CountyPowerStoryRow["moratoriumStatus"];
  readonly normalizedScore: number;
  readonly outlineIntensity: number;
  readonly previousNormalizedScore: number;
  readonly previousOutlineIntensity: number;
  readonly previousPulseAmplitude: number;
  readonly pulseAmplitude: number;
  readonly scanCategory: string;
  readonly seed: number;
}

const STORY_LAYER_IDS = countyPowerStoryCatalogLayerIds();
const ANIMATION_PERIOD_MS = 2800;
const MORPH_DURATION_MS = 900;
const MAX_SNAPSHOT_CACHE_KEYS = 8;
const QUEUE_WINDOW_PLAYBACK_MS = 2200;

function buildSnapshotCacheKey(args: {
  readonly publicationRunId?: string | undefined;
  readonly storyId: CountyPowerStoryId;
  readonly window: CountyPowerStoryWindow;
}): string {
  const publicationKey =
    typeof args.publicationRunId === "string" && args.publicationRunId.trim().length > 0
      ? args.publicationRunId
      : "latest";

  return `${args.storyId}:${args.window}:${publicationKey}`;
}

function readStyleLayerId(layer: unknown): string | null {
  if (typeof layer !== "object" || layer === null) {
    return null;
  }

  const maybeLayerId = Reflect.get(layer, "id");
  if (typeof maybeLayerId !== "string" || maybeLayerId.trim().length === 0) {
    return null;
  }

  return maybeLayerId;
}

function findFirstLabelLayerId(map: IMap): string | undefined {
  const style = map.getStyle();
  const styleLayers = style.layers ?? [];

  for (const styleLayer of styleLayers) {
    if (Reflect.get(styleLayer, "type") !== "symbol") {
      continue;
    }

    const styleLayerId = readStyleLayerId(styleLayer);
    if (typeof styleLayerId === "string") {
      return styleLayerId;
    }
  }

  return undefined;
}

function facilityAnchorLayerIds(): readonly string[] {
  const colocation = getFacilitiesStyleLayerIds("facilities.colocation");
  const hyperscale = getFacilitiesStyleLayerIds("facilities.hyperscale");

  return [
    "hyperscale-leased-voronoi.fill",
    "hyperscale-leased-voronoi.line",
    "facilities.colocation.heatmap",
    colocation.clusterLayerId,
    "facilities.colocation.icon-fallback",
    colocation.pointLayerId,
    "facilities.hyperscale.heatmap",
    hyperscale.clusterLayerId,
    "facilities.hyperscale.icon-fallback",
    hyperscale.pointLayerId,
  ];
}

function findCountyPowerInsertBeforeId(map: IMap): string | undefined {
  const style = map.getStyle();
  const styleLayers = style.layers ?? [];
  const facilityLayerIds = new Set(facilityAnchorLayerIds());

  for (const styleLayer of styleLayers) {
    const styleLayerId = readStyleLayerId(styleLayer);
    if (typeof styleLayerId === "string" && facilityLayerIds.has(styleLayerId)) {
      return styleLayerId;
    }
  }

  return findFirstLabelLayerId(map);
}

function readCountyFipsFromFeature(feature: MapRenderedFeature): string | null {
  if (typeof feature.id === "string" && feature.id.trim().length > 0) {
    return feature.id;
  }

  if (typeof feature.id === "number") {
    return String(feature.id);
  }

  const properties = feature.properties;
  if (typeof properties !== "object" || properties === null) {
    return null;
  }

  const countyFips = Reflect.get(properties, "countyFips");
  if (typeof countyFips === "string" && countyFips.trim().length > 0) {
    return countyFips;
  }

  const countyFipsSnakeCase = Reflect.get(properties, "county_fips");
  return typeof countyFipsSnakeCase === "string" && countyFipsSnakeCase.trim().length > 0
    ? countyFipsSnakeCase
    : null;
}

function interactionFillOpacityExpression(storyId: CountyPowerStoryId): MapExpression {
  const baseOpacity = countyPowerStoryFillOpacityExpression(storyId);
  return [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    ["max", baseOpacity, 0.48],
    ["boolean", ["feature-state", "hover"], false],
    ["min", 0.98, ["+", baseOpacity, 0.14]],
    baseOpacity,
  ];
}

function interactionOutlineColorExpression(storyId: CountyPowerStoryId): MapExpression {
  return [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    "#020617",
    ["boolean", ["feature-state", "hover"], false],
    "#0f172a",
    countyPowerStoryOutlineColorExpression(storyId),
  ];
}

function interactionOutlineWidthExpression(storyId: CountyPowerStoryId): MapExpression {
  return countyPowerStoryOutlineWidthExpression(storyId);
}

function extrusionOpacityExpression(): number {
  return 0.78;
}

function extrusionColorExpression(storyId: CountyPowerStoryId): MapExpression {
  return [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    "#0f172a",
    ["boolean", ["feature-state", "hover"], false],
    "#1e293b",
    countyPowerStoryFillColorExpression(storyId),
  ];
}

function selectedStateFromRow(
  row: CountyPowerStoryRow,
  storyId: CountyPowerStoryId,
  window: CountyPowerStoryWindow
): CountyPowerStorySelectionState {
  return {
    countyFips: row.countyFips,
    countyName: row.countyName,
    stateAbbrev: row.stateAbbrev,
    storyId,
    window,
  };
}

function selectionStateForCounty(args: {
  readonly countyFips: string | null;
  readonly rowsByCounty: ReadonlyMap<string, CountyPowerStoryRow>;
  readonly storyId: CountyPowerStoryId;
  readonly window: CountyPowerStoryWindow;
}): CountyPowerStorySelectionState | null {
  if (args.countyFips === null) {
    return null;
  }

  const row = args.rowsByCounty.get(args.countyFips);
  return typeof row === "undefined" ? null : selectedStateFromRow(row, args.storyId, args.window);
}

function buildRenderProperties(args: {
  readonly currentRow: CountyPowerStoryRow | null;
  readonly previousRow: CountyPowerStoryRow | null;
}): CountyPowerStoryRenderProperties {
  const nextNormalizedScore = args.currentRow?.normalizedScore ?? 0;
  const nextOutlineIntensity = args.currentRow?.outlineIntensity ?? 0;
  const nextPulseAmplitude = args.currentRow?.pulseAmplitude ?? 0;

  return {
    categoryKey: args.currentRow?.categoryKey ?? null,
    direction: args.currentRow?.direction ?? "neutral",
    isSeamCounty: args.currentRow?.isSeamCounty ?? false,
    marketStructure: args.currentRow?.marketStructure ?? "unknown",
    moratoriumStatus: args.currentRow?.moratoriumStatus ?? "unknown",
    normalizedScore: nextNormalizedScore,
    outlineIntensity: nextOutlineIntensity,
    previousNormalizedScore: args.previousRow?.normalizedScore ?? nextNormalizedScore,
    previousOutlineIntensity: args.previousRow?.outlineIntensity ?? nextOutlineIntensity,
    previousPulseAmplitude: args.previousRow?.pulseAmplitude ?? nextPulseAmplitude,
    pulseAmplitude: nextPulseAmplitude,
    scanCategory: scanCategoryForRow(args.currentRow),
    seed: args.currentRow?.seed ?? 0,
  };
}

function buildFeatureStateTarget(countyFips: string) {
  return {
    source: COUNTY_POWER_STORY_SOURCE_ID,
    sourceLayer: COUNTY_POWER_STORY_TILE_SOURCE_LAYER,
    id: countyFips,
  };
}

function isCountyPowerStoryLayerVisibleAtZoom(
  layerId: CountyPowerStoryCatalogLayerId,
  zoom: number
): boolean {
  const layerDefinition = DEFAULT_LAYER_CATALOG[layerId];
  return zoom >= layerDefinition.zoomMin && zoom <= layerDefinition.zoomMax;
}

function interactiveLayerIds(state: CountyPowerStoryLayerState, zoom: number): string[] | null {
  if (!state.visible) {
    return null;
  }

  const renderedCurrentStory =
    state.renderedStoryId === state.storyId && state.renderedWindow === state.window;
  const storyLayerId = activeStoryLayerId(state.storyId);
  if (!(renderedCurrentStory && state.layerVisibility[storyLayerId])) {
    return null;
  }

  const styleLayerIds = countyPowerStoryStyleLayerIds(state.storyId);
  const layers: string[] = [];

  if (isCountyPowerStoryLayerVisibleAtZoom(storyLayerId, zoom)) {
    layers.push(styleLayerIds.fillLayerId, styleLayerIds.outlineLayerId);
  }

  if (
    state.threeDimensional &&
    state.layerVisibility["models.county-power-3d"] &&
    isCountyPowerStoryLayerVisibleAtZoom("models.county-power-3d", zoom)
  ) {
    layers.push(countyPowerStoryExtrusionLayerId());
  }

  return layers.length > 0 ? layers : null;
}

function createLayerVisibilityRecord(): Record<CountyPowerStoryCatalogLayerId, boolean> {
  return {
    "models.county-power-grid-stress": false,
    "models.county-power-queue-pressure": false,
    "models.county-power-market-structure": false,
    "models.county-power-policy-watch": false,
    "models.county-power-3d": false,
  };
}

function activeStoryLayerId(storyId: CountyPowerStoryId): CountyPowerStoryCatalogLayerId {
  return countyPowerStoryLayerId(storyId);
}

const ALL_CHAPTER_LAYER_IDS: readonly string[] = [
  COUNTY_POWER_STORY_HEARTBEAT_FILL_LAYER_ID,
  COUNTY_POWER_STORY_HEARTBEAT_OUTLINE_LAYER_ID,
  COUNTY_POWER_STORY_SUBREGION_OUTLINE_LAYER_ID,
  COUNTY_POWER_STORY_TRANSFER_BASE_LAYER_ID,
  COUNTY_POWER_STORY_TRANSFER_FLOW_LAYER_ID,
  COUNTY_POWER_STORY_QUEUE_HEAT_LAYER_ID,
  COUNTY_POWER_STORY_QUEUE_HOTSPOT_LAYER_ID,
  COUNTY_POWER_STORY_TRANSMISSION_BASE_LAYER_ID,
  COUNTY_POWER_STORY_TRANSMISSION_FLOW_LAYER_ID,
  COUNTY_POWER_STORY_POLICY_RING_LAYER_ID,
  COUNTY_POWER_STORY_POLICY_CENTER_LAYER_ID,
  COUNTY_POWER_STORY_SCAN_LAYER_ID,
  COUNTY_POWER_STORY_SEAM_HAZE_LAYER_ID,
];

function currentQueuePlaybackWindow(nowMs: number): CountyPowerStoryWindow {
  const windows: readonly CountyPowerStoryWindow[] = ["live", "30d", "60d", "90d"];
  const index = Math.floor(nowMs / QUEUE_WINDOW_PLAYBACK_MS) % windows.length;
  return windows[index] ?? "live";
}

function setGeoJsonSourceDataIfReady(
  map: IMap,
  sourceId: string,
  data:
    | GeoJSON.FeatureCollection<GeoJSON.LineString>
    | GeoJSON.FeatureCollection<GeoJSON.Point>
    | GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>
): void {
  if (!map.hasSource(sourceId)) {
    return;
  }

  map.setGeoJSONSourceData(sourceId, data);
}

export function mountCountyPowerStoryLayer(
  map: IMap,
  options: MountCountyPowerStoryLayerOptions = {}
): CountyPowerStoryMountResult {
  const statusState: { value: LayerStatus } = { value: initialLayerStatus() };
  const state: CountyPowerStoryLayerState = {
    activeSnapshotKey: null,
    animationEnabled: true,
    chapterId: "operator-heartbeat",
    chapterVisible: true,
    countyGeometryFeatures: [],
    countyGeometryRequest: null,
    destroyed: false,
    marketBoundaryRequest: null,
    marketFeatures: [],
    layerVisibility: createLayerVisibilityRecord(),
    latestRequestedSnapshotKey: null,
    morphFrame: null,
    pendingSnapshotRequests: new Map<string, Promise<CountyPowerStorySnapshotCacheEntry>>(),
    pollInFlight: false,
    pollTimer: null,
    publicationRunId: null,
    queueTimelineFrames: new Map<
      CountyPowerStoryWindow,
      readonly CountyPowerStoryTimelineFrameRow[]
    >(),
    queueTimelineRequest: null,
    ready: false,
    renderedStoryId: null,
    renderedWindow: null,
    rowsByCounty: new Map<string, CountyPowerStoryRow>(),
    seamHazeEnabled: false,
    selectedCountyFips: null,
    snapshotCache: new Map<string, CountyPowerStorySnapshotCacheEntry>(),
    storyId: "grid-stress",
    styleReady: false,
    submarketFeatures: [],
    threeDimensional: false,
    transferRoutes: [],
    transmissionRoutes: [],
    visible: false,
    window: "live",
  };
  let animationFrame: number | null = null;

  function canMutateStoryStyle(): boolean {
    return state.styleReady && map.hasSource(COUNTY_POWER_STORY_SOURCE_ID);
  }

  function setStoryGlobalState(name: string, value: number): void {
    if (!canMutateStoryStyle()) {
      return;
    }

    map.setGlobalStateProperty(name, value);
  }

  function applyFeatureStates(
    previousRowsByCounty: ReadonlyMap<string, CountyPowerStoryRow>
  ): void {
    if (!(state.styleReady && map.hasSource(COUNTY_POWER_STORY_SOURCE_ID))) {
      return;
    }

    const countyFipses = new Set<string>([
      ...previousRowsByCounty.keys(),
      ...state.rowsByCounty.keys(),
    ]);

    for (const countyFips of countyFipses) {
      const nextRow = state.rowsByCounty.get(countyFips);
      const previousRow = previousRowsByCounty.get(countyFips);
      const currentRow = nextRow ?? previousRow ?? null;
      if (currentRow === null) {
        continue;
      }

      map.setFeatureState(
        buildFeatureStateTarget(countyFips),
        buildRenderProperties({
          currentRow,
          previousRow: previousRow ?? null,
        })
      );
    }

    reapplySelectedFeatureState();
  }

  function applyExtrusionPaint(): void {
    const extrusionLayerId = countyPowerStoryExtrusionLayerId();
    if (!map.hasLayer(extrusionLayerId)) {
      return;
    }

    map.setPaintProperty(
      extrusionLayerId,
      "fill-extrusion-color",
      extrusionColorExpression(state.storyId)
    );
  }

  function centroidsByCounty(): ReadonlyMap<string, readonly [number, number]> {
    return buildCountyCentroidsByFips(state.countyGeometryFeatures);
  }

  function applyHeartbeatFeatureState(): void {
    if (
      !(map.hasSource(COUNTY_POWER_STORY_HEARTBEAT_SOURCE_ID) && state.marketFeatures.length > 0)
    ) {
      return;
    }

    const dominantOperator = buildOperatorHeartbeatSources({
      marketFeatures: state.marketFeatures,
      rowsByCounty: state.rowsByCounty,
      submarketFeatures: state.submarketFeatures,
    }).activeMarketIds;

    for (const feature of state.marketFeatures) {
      map.setFeatureState(
        {
          source: COUNTY_POWER_STORY_HEARTBEAT_SOURCE_ID,
          id: feature.id,
        },
        {
          active: dominantOperator.has(String(feature.id)),
        }
      );
    }
  }

  function ensureChapterImages(): void {
    if (!map.hasImage(COUNTY_POWER_STORY_QUEUE_PULSE_IMAGE_ID)) {
      map.addImage(
        COUNTY_POWER_STORY_QUEUE_PULSE_IMAGE_ID,
        createPulsingDotImage({
          outerColor: "rgba(248, 113, 113, ALPHA)",
          repaint: () => map.triggerRepaint(),
        })
      );
    }

    if (!map.hasImage(COUNTY_POWER_STORY_SCAN_GREEN_IMAGE_ID)) {
      map.addImage(
        COUNTY_POWER_STORY_SCAN_GREEN_IMAGE_ID,
        createStripePatternImage({
          color: "rgba(34, 197, 94, 0.82)",
          repaint: () => map.triggerRepaint(),
        })
      );
    }

    if (!map.hasImage(COUNTY_POWER_STORY_SCAN_AMBER_IMAGE_ID)) {
      map.addImage(
        COUNTY_POWER_STORY_SCAN_AMBER_IMAGE_ID,
        createStripePatternImage({
          color: "rgba(245, 158, 11, 0.82)",
          repaint: () => map.triggerRepaint(),
        })
      );
    }

    if (!map.hasImage(COUNTY_POWER_STORY_SCAN_RED_IMAGE_ID)) {
      map.addImage(
        COUNTY_POWER_STORY_SCAN_RED_IMAGE_ID,
        createStripePatternImage({
          color: "rgba(239, 68, 68, 0.82)",
          repaint: () => map.triggerRepaint(),
        })
      );
    }
  }

  function ensureChapterSources(): void {
    if (!map.hasSource(COUNTY_POWER_STORY_HEARTBEAT_SOURCE_ID)) {
      map.addSource(COUNTY_POWER_STORY_HEARTBEAT_SOURCE_ID, {
        type: "geojson",
        data: emptyPolygonFeatureCollection(),
      });
    }

    if (!map.hasSource(COUNTY_POWER_STORY_SUBREGION_SOURCE_ID)) {
      map.addSource(COUNTY_POWER_STORY_SUBREGION_SOURCE_ID, {
        type: "geojson",
        data: emptyPolygonFeatureCollection(),
      });
    }

    if (!map.hasSource(COUNTY_POWER_STORY_TRANSFER_BASE_SOURCE_ID)) {
      map.addSource(COUNTY_POWER_STORY_TRANSFER_BASE_SOURCE_ID, {
        type: "geojson",
        data: emptyLineFeatureCollection(),
      });
    }

    if (!map.hasSource(COUNTY_POWER_STORY_TRANSFER_FLOW_SOURCE_ID)) {
      map.addSource(COUNTY_POWER_STORY_TRANSFER_FLOW_SOURCE_ID, {
        type: "geojson",
        data: emptyLineFeatureCollection(),
        lineMetrics: true,
      });
    }

    if (!map.hasSource(COUNTY_POWER_STORY_QUEUE_SOURCE_ID)) {
      map.addSource(COUNTY_POWER_STORY_QUEUE_SOURCE_ID, {
        type: "geojson",
        data: emptyPointFeatureCollection(),
      });
    }

    if (!map.hasSource(COUNTY_POWER_STORY_QUEUE_HOTSPOT_SOURCE_ID)) {
      map.addSource(COUNTY_POWER_STORY_QUEUE_HOTSPOT_SOURCE_ID, {
        type: "geojson",
        data: emptyPointFeatureCollection(),
      });
    }

    if (!map.hasSource(COUNTY_POWER_STORY_POLICY_SOURCE_ID)) {
      map.addSource(COUNTY_POWER_STORY_POLICY_SOURCE_ID, {
        type: "geojson",
        data: emptyPointFeatureCollection(),
      });
    }

    if (!map.hasSource(COUNTY_POWER_STORY_SEAM_HAZE_SOURCE_ID)) {
      map.addSource(COUNTY_POWER_STORY_SEAM_HAZE_SOURCE_ID, {
        type: "geojson",
        data: emptyPointFeatureCollection(),
      });
    }

    if (!map.hasSource(COUNTY_POWER_STORY_TRANSMISSION_SOURCE_ID)) {
      map.addSource(COUNTY_POWER_STORY_TRANSMISSION_SOURCE_ID, {
        type: "vector",
        tiles: [COUNTY_POWER_STORY_TRANSMISSION_TILE_URL],
        maxzoom: 17,
      });
    }

    if (!map.hasSource(COUNTY_POWER_STORY_TRANSMISSION_FLOW_SOURCE_ID)) {
      map.addSource(COUNTY_POWER_STORY_TRANSMISSION_FLOW_SOURCE_ID, {
        type: "geojson",
        data: emptyLineFeatureCollection(),
        lineMetrics: true,
      });
    }
  }

  function ensureChapterLayer(
    layerId: string,
    buildSpec: () => MapLayerSpecification,
    beforeId: string | undefined
  ): void {
    if (map.hasLayer(layerId)) {
      return;
    }

    map.addLayer(buildSpec(), beforeId);
  }

  function ensureChapterLayers(): void {
    const beforeId = findCountyPowerInsertBeforeId(map);
    ensureChapterLayer(
      COUNTY_POWER_STORY_HEARTBEAT_FILL_LAYER_ID,
      () => ({
        id: COUNTY_POWER_STORY_HEARTBEAT_FILL_LAYER_ID,
        type: "fill",
        source: COUNTY_POWER_STORY_HEARTBEAT_SOURCE_ID,
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": ["case", ["boolean", ["feature-state", "active"], false], 0.22, 0.05],
        },
      }),
      beforeId
    );
    ensureChapterLayer(
      COUNTY_POWER_STORY_HEARTBEAT_OUTLINE_LAYER_ID,
      () => ({
        id: COUNTY_POWER_STORY_HEARTBEAT_OUTLINE_LAYER_ID,
        type: "line",
        source: COUNTY_POWER_STORY_HEARTBEAT_SOURCE_ID,
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["case", ["boolean", ["feature-state", "active"], false], 3, 1.2],
          "line-opacity": ["case", ["boolean", ["feature-state", "active"], false], 0.92, 0.28],
        },
      }),
      beforeId
    );
    ensureChapterLayer(
      COUNTY_POWER_STORY_SUBREGION_OUTLINE_LAYER_ID,
      () => ({
        id: COUNTY_POWER_STORY_SUBREGION_OUTLINE_LAYER_ID,
        type: "line",
        source: COUNTY_POWER_STORY_SUBREGION_SOURCE_ID,
        paint: {
          "line-color": ["get", "color"],
          "line-width": 1,
          "line-opacity": 0.25,
        },
      }),
      beforeId
    );
    ensureChapterLayer(
      COUNTY_POWER_STORY_TRANSFER_BASE_LAYER_ID,
      () => ({
        id: COUNTY_POWER_STORY_TRANSFER_BASE_LAYER_ID,
        type: "line",
        source: COUNTY_POWER_STORY_TRANSFER_BASE_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": ["get", "color"],
          "line-dasharray": [2, 2],
          "line-opacity": 0.26,
          "line-width": ["interpolate", ["linear"], ["get", "capacityProxyMw"], 0, 1, 1000, 4],
        },
      }),
      beforeId
    );
    ensureChapterLayer(
      COUNTY_POWER_STORY_TRANSFER_FLOW_LAYER_ID,
      () => ({
        id: COUNTY_POWER_STORY_TRANSFER_FLOW_LAYER_ID,
        type: "line",
        source: COUNTY_POWER_STORY_TRANSFER_FLOW_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-width": ["interpolate", ["linear"], ["get", "capacityProxyMw"], 0, 2, 1000, 8],
          "line-gradient": [
            "interpolate",
            ["linear"],
            ["line-progress"],
            0,
            "rgba(255,255,255,0)",
            0.35,
            "rgba(255,220,120,0.08)",
            0.5,
            "#f59e0b",
            0.65,
            "rgba(255,220,120,0.08)",
            1,
            "rgba(255,255,255,0)",
          ],
          "line-opacity": ["coalesce", ["get", "opacity"], 0.8],
        },
      }),
      beforeId
    );
    ensureChapterLayer(
      COUNTY_POWER_STORY_QUEUE_HEAT_LAYER_ID,
      () => ({
        id: COUNTY_POWER_STORY_QUEUE_HEAT_LAYER_ID,
        type: "heatmap",
        source: COUNTY_POWER_STORY_QUEUE_SOURCE_ID,
        paint: {
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(0,0,0,0)",
            0.2,
            "#2563eb",
            0.45,
            "#06b6d4",
            0.7,
            "#f59e0b",
            1,
            "#7f1d1d",
          ],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.8, 8, 2.5],
          "heatmap-opacity": 0.84,
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 8, 8, 30],
          "heatmap-weight": ["interpolate", ["linear"], ["get", "pressureScore"], 0, 0, 100, 1],
        },
      }),
      beforeId
    );
    ensureChapterLayer(
      COUNTY_POWER_STORY_QUEUE_HOTSPOT_LAYER_ID,
      () => ({
        id: COUNTY_POWER_STORY_QUEUE_HOTSPOT_LAYER_ID,
        type: "symbol",
        source: COUNTY_POWER_STORY_QUEUE_HOTSPOT_SOURCE_ID,
        layout: {
          "icon-allow-overlap": true,
          "icon-image": COUNTY_POWER_STORY_QUEUE_PULSE_IMAGE_ID,
          "icon-size": ["interpolate", ["linear"], ["get", "pressureScore"], 0, 0.24, 100, 0.72],
        },
      }),
      beforeId
    );
    ensureChapterLayer(
      COUNTY_POWER_STORY_TRANSMISSION_BASE_LAYER_ID,
      () => ({
        id: COUNTY_POWER_STORY_TRANSMISSION_BASE_LAYER_ID,
        type: "line",
        source: COUNTY_POWER_STORY_TRANSMISSION_SOURCE_ID,
        "source-layer": "power_line",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": [
            "case",
            [">=", ["to-number", ["coalesce", ["get", "voltage"], 0]], 500],
            "#60a5fa",
            [">=", ["to-number", ["coalesce", ["get", "voltage"], 0]], 220],
            "#38bdf8",
            "#94a3b8",
          ],
          "line-opacity": 0.22,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.55, 9, 1.1, 13, 2.1],
        },
      }),
      beforeId
    );
    ensureChapterLayer(
      COUNTY_POWER_STORY_TRANSMISSION_FLOW_LAYER_ID,
      () => ({
        id: COUNTY_POWER_STORY_TRANSMISSION_FLOW_LAYER_ID,
        type: "line",
        source: COUNTY_POWER_STORY_TRANSMISSION_FLOW_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 3, 8, 9],
          "line-blur": 1.6,
          "line-gradient": [
            "interpolate",
            ["linear"],
            ["line-progress"],
            0,
            "rgba(255,255,255,0)",
            0.35,
            "rgba(255,255,255,0.06)",
            0.5,
            "#60a5fa",
            0.65,
            "rgba(255,255,255,0.06)",
            1,
            "rgba(255,255,255,0)",
          ],
          "line-opacity": ["coalesce", ["get", "opacity"], 0.9],
        },
      }),
      beforeId
    );
    ensureChapterLayer(
      COUNTY_POWER_STORY_POLICY_RING_LAYER_ID,
      () => ({
        id: COUNTY_POWER_STORY_POLICY_RING_LAYER_ID,
        type: "circle",
        source: COUNTY_POWER_STORY_POLICY_SOURCE_ID,
        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-opacity": ["interpolate", ["linear"], ["get", "phase"], 0, 0.72, 1, 0],
          "circle-radius": ["interpolate", ["linear"], ["get", "phase"], 0, 4, 1, 30],
          "circle-stroke-color": [
            "match",
            ["get", "direction"],
            "supportive",
            "#22c55e",
            "restrictive",
            "#ef4444",
            "#f59e0b",
          ],
          "circle-stroke-width": 2,
        },
      }),
      beforeId
    );
    ensureChapterLayer(
      COUNTY_POWER_STORY_POLICY_CENTER_LAYER_ID,
      () => ({
        id: COUNTY_POWER_STORY_POLICY_CENTER_LAYER_ID,
        type: "circle",
        source: COUNTY_POWER_STORY_POLICY_SOURCE_ID,
        paint: {
          "circle-color": [
            "match",
            ["get", "direction"],
            "supportive",
            "#22c55e",
            "restrictive",
            "#ef4444",
            "#f59e0b",
          ],
          "circle-opacity": 0.9,
          "circle-radius": ["interpolate", ["linear"], ["get", "impactScore"], 0, 3, 1, 7],
        },
      }),
      beforeId
    );
    ensureChapterLayer(
      COUNTY_POWER_STORY_SCAN_LAYER_ID,
      () => ({
        id: COUNTY_POWER_STORY_SCAN_LAYER_ID,
        type: "fill",
        source: COUNTY_POWER_STORY_SOURCE_ID,
        "source-layer": COUNTY_POWER_STORY_TILE_SOURCE_LAYER,
        paint: {
          "fill-opacity": [
            "case",
            ["==", ["coalesce", ["feature-state", "scanCategory"], "none"], "none"],
            0,
            0.2,
          ],
          "fill-pattern": [
            "match",
            ["coalesce", ["feature-state", "scanCategory"], "none"],
            "advantaged",
            COUNTY_POWER_STORY_SCAN_GREEN_IMAGE_ID,
            "low-confidence",
            COUNTY_POWER_STORY_SCAN_AMBER_IMAGE_ID,
            "constrained",
            COUNTY_POWER_STORY_SCAN_RED_IMAGE_ID,
            COUNTY_POWER_STORY_SCAN_GREEN_IMAGE_ID,
          ],
        },
      }),
      beforeId
    );
    ensureChapterLayer(
      COUNTY_POWER_STORY_SEAM_HAZE_LAYER_ID,
      () => ({
        id: COUNTY_POWER_STORY_SEAM_HAZE_LAYER_ID,
        type: "heatmap",
        source: COUNTY_POWER_STORY_SEAM_HAZE_SOURCE_ID,
        paint: {
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(0,0,0,0)",
            0.25,
            "rgba(251,146,60,0.2)",
            0.6,
            "rgba(245,158,11,0.4)",
            1,
            "rgba(249,115,22,0.58)",
          ],
          "heatmap-intensity": 0.9,
          "heatmap-opacity": 0.5,
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 12, 8, 28],
          "heatmap-weight": ["coalesce", ["get", "intensity"], 0.5],
        },
      }),
      beforeId
    );
  }

  function applyChapterVisibility(): void {
    const chapterLayerIds = new Set(
      state.visible
        ? visibleChapterLayerIds({
            chapterId: state.chapterId,
            chapterVisible: state.chapterVisible,
            seamHazeEnabled: state.seamHazeEnabled,
          })
        : []
    );

    for (const layerId of ALL_CHAPTER_LAYER_IDS) {
      if (!map.hasLayer(layerId)) {
        continue;
      }

      map.setLayerVisibility(layerId, chapterLayerIds.has(layerId));
    }
  }

  function animateHeartbeatOutline(seconds: number): void {
    if (!map.hasLayer(COUNTY_POWER_STORY_HEARTBEAT_OUTLINE_LAYER_ID)) {
      return;
    }

    const pulse = 0.66 + 0.34 * (0.5 + 0.5 * Math.sin(seconds * 2.1));
    const width = 2.4 + 1.3 * (0.5 + 0.5 * Math.sin(seconds * 2.1));

    map.setPaintProperty(COUNTY_POWER_STORY_HEARTBEAT_OUTLINE_LAYER_ID, "line-opacity", [
      "case",
      ["boolean", ["feature-state", "active"], false],
      pulse,
      0.28,
    ]);
    map.setPaintProperty(COUNTY_POWER_STORY_HEARTBEAT_OUTLINE_LAYER_ID, "line-width", [
      "case",
      ["boolean", ["feature-state", "active"], false],
      width,
      1.2,
    ]);
  }

  async function ensureCountyGeometry(): Promise<void> {
    if (state.countyGeometryFeatures.length > 0) {
      return;
    }

    if (state.countyGeometryRequest !== null) {
      await state.countyGeometryRequest;
      return;
    }

    state.countyGeometryRequest = (async () => {
      const result = await fetchCountyPowerStoryGeometry();
      if (!result.ok) {
        throw new Error(result.message ?? "Failed to load county story geometry.");
      }

      state.countyGeometryFeatures = result.data.features;
    })().finally(() => {
      state.countyGeometryRequest = null;
    });

    await state.countyGeometryRequest;
  }

  async function ensureMarketBoundaries(): Promise<void> {
    if (state.marketFeatures.length > 0 && state.submarketFeatures.length > 0) {
      return;
    }

    if (state.marketBoundaryRequest !== null) {
      await state.marketBoundaryRequest;
      return;
    }

    state.marketBoundaryRequest = (async () => {
      const [marketResult, submarketResult] = await Promise.all([
        runEffectPromise(Effect.either(fetchMarketBoundariesEffect("market"))),
        runEffectPromise(Effect.either(fetchMarketBoundariesEffect("submarket"))),
      ]);

      if (Either.isLeft(marketResult)) {
        throw new Error("Failed to load market boundaries.");
      }

      if (Either.isLeft(submarketResult)) {
        throw new Error("Failed to load submarket boundaries.");
      }

      state.marketFeatures = marketResult.right.data.features;
      state.submarketFeatures = submarketResult.right.data.features;
      const connectors = buildTransferConnectorSourceData({
        marketFeatures: state.marketFeatures,
        submarketFeatures: state.submarketFeatures,
      });
      state.transferRoutes = prepareAnimatedRoutes(connectors);

      const heartbeatSources = buildOperatorHeartbeatSources({
        marketFeatures: state.marketFeatures,
        rowsByCounty: state.rowsByCounty,
        submarketFeatures: state.submarketFeatures,
      });
      setGeoJsonSourceDataIfReady(
        map,
        COUNTY_POWER_STORY_HEARTBEAT_SOURCE_ID,
        heartbeatSources.marketSourceData
      );
      setGeoJsonSourceDataIfReady(
        map,
        COUNTY_POWER_STORY_SUBREGION_SOURCE_ID,
        heartbeatSources.submarketSourceData
      );
      setGeoJsonSourceDataIfReady(map, COUNTY_POWER_STORY_TRANSFER_BASE_SOURCE_ID, connectors);
      applyHeartbeatFeatureState();
    })().finally(() => {
      state.marketBoundaryRequest = null;
    });

    await state.marketBoundaryRequest;
  }

  async function ensureQueueTimeline(): Promise<void> {
    if (state.queueTimelineFrames.size > 0) {
      return;
    }

    if (state.queueTimelineRequest !== null) {
      await state.queueTimelineRequest;
      return;
    }

    state.queueTimelineRequest = (async () => {
      const result = await fetchCountyPowerStoryTimeline("queue-pressure");
      if (!result.ok) {
        throw new Error(result.message ?? "Failed to load county story timeline.");
      }

      state.queueTimelineFrames = new Map(
        result.data.frames.map(
          (frame): [CountyPowerStoryWindow, readonly CountyPowerStoryTimelineFrameRow[]] => [
            frame.window,
            frame.rows,
          ]
        )
      );
    })().finally(() => {
      state.queueTimelineRequest = null;
    });

    await state.queueTimelineRequest;
  }

  function refreshHeartbeatSources(): void {
    if (!(state.marketFeatures.length > 0 && state.submarketFeatures.length > 0)) {
      return;
    }

    const sources = buildOperatorHeartbeatSources({
      marketFeatures: state.marketFeatures,
      rowsByCounty: state.rowsByCounty,
      submarketFeatures: state.submarketFeatures,
    });
    setGeoJsonSourceDataIfReady(
      map,
      COUNTY_POWER_STORY_HEARTBEAT_SOURCE_ID,
      sources.marketSourceData
    );
    setGeoJsonSourceDataIfReady(
      map,
      COUNTY_POWER_STORY_SUBREGION_SOURCE_ID,
      sources.submarketSourceData
    );
    applyHeartbeatFeatureState();
  }

  function refreshQueueSources(nowMs: number): void {
    const frameRows = state.queueTimelineFrames.get(currentQueuePlaybackWindow(nowMs)) ?? [];
    if (frameRows.length === 0) {
      setGeoJsonSourceDataIfReady(
        map,
        COUNTY_POWER_STORY_QUEUE_SOURCE_ID,
        emptyPointFeatureCollection()
      );
      setGeoJsonSourceDataIfReady(
        map,
        COUNTY_POWER_STORY_QUEUE_HOTSPOT_SOURCE_ID,
        emptyPointFeatureCollection()
      );
      return;
    }

    const queueSources = buildQueuePressureSources({
      centroidsByCounty: centroidsByCounty(),
      frameRows,
    });
    setGeoJsonSourceDataIfReady(
      map,
      COUNTY_POWER_STORY_QUEUE_SOURCE_ID,
      queueSources.pressureSourceData
    );
    setGeoJsonSourceDataIfReady(
      map,
      COUNTY_POWER_STORY_QUEUE_HOTSPOT_SOURCE_ID,
      queueSources.hotspotSourceData
    );
  }

  function refreshPolicySources(nowMs: number): void {
    setGeoJsonSourceDataIfReady(
      map,
      COUNTY_POWER_STORY_POLICY_SOURCE_ID,
      buildPolicyShockwaveSourceData({
        centroidsByCounty: centroidsByCounty(),
        nowMs,
        rowsByCounty: state.rowsByCounty,
      })
    );
  }

  function refreshSeamHazeSource(): void {
    setGeoJsonSourceDataIfReady(
      map,
      COUNTY_POWER_STORY_SEAM_HAZE_SOURCE_ID,
      buildSeamHazeSourceData({
        centroidsByCounty: centroidsByCounty(),
        rowsByCounty: state.rowsByCounty,
      })
    );
  }

  function refreshTransmissionSources(seconds: number): void {
    if (state.transmissionRoutes.length === 0) {
      const corridors = buildTransmissionCorridorSourceData({
        centroidsByCounty: centroidsByCounty(),
        rowsByCounty: state.rowsByCounty,
      });
      state.transmissionRoutes = prepareAnimatedRoutes(corridors);
    }

    setGeoJsonSourceDataIfReady(
      map,
      COUNTY_POWER_STORY_TRANSMISSION_FLOW_SOURCE_ID,
      buildAnimatedRouteSegments({
        routes: state.transmissionRoutes,
        seconds,
      })
    );
  }

  function refreshTransferSources(seconds: number): void {
    setGeoJsonSourceDataIfReady(
      map,
      COUNTY_POWER_STORY_TRANSFER_FLOW_SOURCE_ID,
      buildAnimatedRouteSegments({
        routes: state.transferRoutes,
        seconds,
      })
    );
  }

  function refreshChapterSources(now: number): void {
    if (!(state.styleReady && state.visible)) {
      return;
    }

    const nowMs = now;
    animateHeartbeatOutline(nowMs / 1000);
    if (state.marketFeatures.length > 0) {
      refreshHeartbeatSources();
    }

    if (state.transferRoutes.length > 0) {
      refreshTransferSources(nowMs / 1000);
    }

    if (state.queueTimelineFrames.size > 0) {
      refreshQueueSources(nowMs);
    }

    refreshPolicySources(nowMs);
    refreshSeamHazeSource();
    refreshTransmissionSources(nowMs / 1000);
  }

  async function ensureChapterDataLoaded(): Promise<void> {
    if (!(state.visible && state.styleReady)) {
      return;
    }

    ensureChapterImages();
    ensureChapterSources();
    ensureChapterLayers();
    await ensureCountyGeometry();

    if (state.chapterId === "operator-heartbeat" || state.chapterId === "transfer-friction") {
      await ensureMarketBoundaries();
    }

    if (state.chapterId === "queue-pressure-storm") {
      await ensureQueueTimeline();
      refreshQueueSources(performance.now());
    }

    if (state.chapterId === "transmission-current") {
      state.transmissionRoutes = [];
      refreshTransmissionSources(performance.now() / 1000);
    }

    if (state.chapterId === "policy-shockwaves") {
      refreshPolicySources(performance.now());
    }

    if (state.chapterId === "county-scan" || state.seamHazeEnabled) {
      refreshSeamHazeSource();
    }

    refreshChapterSources(performance.now());
    applyChapterVisibility();
  }

  function logLayerOrderFailures(): void {
    const failures = validateLayerOrder((map.getStyle()?.layers ?? []).map((layer) => layer.id));
    if (failures.length === 0) {
      return;
    }

    console.error(`[county-power-story] layer order invariant failures: ${failures.join(" | ")}`);
  }

  function applyVisibility(): void {
    const mapZoom = map.getZoom();
    const renderedCurrentStory =
      state.renderedStoryId === state.storyId && state.renderedWindow === state.window;
    const activeStoryLayerIdValue = activeStoryLayerId(state.storyId);
    const storyRequestedVisible = state.layerVisibility[activeStoryLayerIdValue];
    const activeStoryVisibleAtZoom = isCountyPowerStoryLayerVisibleAtZoom(
      activeStoryLayerIdValue,
      mapZoom
    );
    const extrusionVisible =
      renderedCurrentStory &&
      storyRequestedVisible &&
      state.threeDimensional &&
      state.layerVisibility["models.county-power-3d"] &&
      isCountyPowerStoryLayerVisibleAtZoom("models.county-power-3d", mapZoom);

    state.visible =
      (renderedCurrentStory && storyRequestedVisible && activeStoryVisibleAtZoom) ||
      extrusionVisible;

    for (const layerId of STORY_LAYER_IDS) {
      const storyId = storyIdFromCatalogLayerId(layerId);
      if (storyId === null) {
        continue;
      }

      const styleLayerIds = countyPowerStoryStyleLayerIds(storyId);
      const visible =
        state.layerVisibility[layerId] &&
        state.storyId === storyId &&
        state.renderedStoryId === storyId &&
        state.renderedWindow === state.window &&
        isCountyPowerStoryLayerVisibleAtZoom(layerId, mapZoom);
      map.setLayerVisibility(styleLayerIds.fillLayerId, visible);
      map.setLayerVisibility(styleLayerIds.outlineLayerId, visible);
    }

    map.setLayerVisibility(countyPowerStoryExtrusionLayerId(), extrusionVisible);
    applyChapterVisibility();
    updateAnimationLoop();
    updateStatusPolling();
  }

  function ensureStyleArtifacts(): void {
    const beforeId = findCountyPowerInsertBeforeId(map);

    if (!map.hasSource(COUNTY_POWER_STORY_SOURCE_ID)) {
      map.addSource(COUNTY_POWER_STORY_SOURCE_ID, {
        type: "vector",
        tiles: [readCountyPowerStoryVectorTileTemplate()],
        promoteId: COUNTY_POWER_STORY_TILE_PROMOTE_ID,
        maxzoom: 12,
      });
    }

    for (const layerId of STORY_LAYER_IDS) {
      const storyId = storyIdFromCatalogLayerId(layerId);
      if (storyId === null) {
        continue;
      }

      const styleLayerIds = countyPowerStoryStyleLayerIds(storyId);

      if (!map.hasLayer(styleLayerIds.fillLayerId)) {
        map.addLayer(
          {
            id: styleLayerIds.fillLayerId,
            minzoom: DEFAULT_LAYER_CATALOG[layerId].zoomMin,
            maxzoom: DEFAULT_LAYER_CATALOG[layerId].zoomMax,
            type: "fill",
            source: COUNTY_POWER_STORY_SOURCE_ID,
            "source-layer": COUNTY_POWER_STORY_TILE_SOURCE_LAYER,
            paint: {
              "fill-color": countyPowerStoryFillColorExpression(storyId),
              "fill-opacity": interactionFillOpacityExpression(storyId),
            },
          },
          beforeId
        );
      }

      if (!map.hasLayer(styleLayerIds.outlineLayerId)) {
        const lineDashArray = countyPowerStoryOutlineDashExpression(storyId);

        map.addLayer(
          {
            id: styleLayerIds.outlineLayerId,
            minzoom: DEFAULT_LAYER_CATALOG[layerId].zoomMin,
            maxzoom: DEFAULT_LAYER_CATALOG[layerId].zoomMax,
            type: "line",
            source: COUNTY_POWER_STORY_SOURCE_ID,
            "source-layer": COUNTY_POWER_STORY_TILE_SOURCE_LAYER,
            paint: {
              "line-color": interactionOutlineColorExpression(storyId),
              "line-opacity": 0.92,
              "line-width": interactionOutlineWidthExpression(storyId),
              ...(typeof lineDashArray === "undefined"
                ? {}
                : {
                    "line-dasharray": lineDashArray,
                  }),
            },
          },
          beforeId
        );
      }
    }

    if (!map.hasLayer(countyPowerStoryExtrusionLayerId())) {
      map.addLayer(
        {
          id: countyPowerStoryExtrusionLayerId(),
          minzoom: DEFAULT_LAYER_CATALOG["models.county-power-3d"].zoomMin,
          maxzoom: DEFAULT_LAYER_CATALOG["models.county-power-3d"].zoomMax,
          type: "fill-extrusion",
          source: COUNTY_POWER_STORY_SOURCE_ID,
          "source-layer": COUNTY_POWER_STORY_TILE_SOURCE_LAYER,
          paint: {
            "fill-extrusion-base": 0,
            "fill-extrusion-color": extrusionColorExpression(state.storyId),
            "fill-extrusion-height": countyPowerStoryExtrusionHeightExpression(),
            "fill-extrusion-opacity": extrusionOpacityExpression(),
          },
        },
        beforeId
      );
    }

    state.styleReady = true;
    applyExtrusionPaint();
    applyFeatureStates(new Map<string, CountyPowerStoryRow>());
    applyVisibility();
    ensureChapterDataLoaded().catch((error: unknown) => {
      console.error("[county-power-story] chapter setup failed", error);
    });
    logLayerOrderFailures();
  }

  function reapplySelectedFeatureState(): void {
    if (state.selectedCountyFips === null) {
      return;
    }

    map.setFeatureState(buildFeatureStateTarget(state.selectedCountyFips), { selected: true });
  }

  function clearSelectedFeatureState(): void {
    if (state.selectedCountyFips === null) {
      return;
    }

    map.setFeatureState(buildFeatureStateTarget(state.selectedCountyFips), { selected: false });
  }

  function emitSelectedCounty(countyFips: string | null): void {
    options.onSelectionChange?.(
      selectionStateForCounty({
        countyFips,
        rowsByCounty: state.rowsByCounty,
        storyId: state.storyId,
        window: state.window,
      })
    );
  }

  function updateSelectedCounty(countyFips: string | null, emit = true): void {
    if (state.selectedCountyFips === countyFips) {
      if (emit) {
        emitSelectedCounty(countyFips);
      }
      return;
    }

    clearSelectedFeatureState();
    state.selectedCountyFips = countyFips;
    reapplySelectedFeatureState();

    if (!emit) {
      return;
    }

    emitSelectedCounty(countyFips);
  }

  function stopMorphAnimation(): void {
    if (state.morphFrame !== null) {
      cancelAnimationFrame(state.morphFrame);
      state.morphFrame = null;
    }
    setStoryGlobalState(COUNTY_POWER_STORY_MORPH_STATE, 1);
  }

  function startMorphAnimation(): void {
    stopMorphAnimation();

    const startedAt = performance.now();
    const step = (now: number): void => {
      if (state.destroyed) {
        return;
      }

      const progress = Math.min(1, (now - startedAt) / MORPH_DURATION_MS);
      setStoryGlobalState(COUNTY_POWER_STORY_MORPH_STATE, progress);
      if (canMutateStoryStyle()) {
        map.triggerRepaint();
      }

      if (progress >= 1) {
        state.morphFrame = null;
        return;
      }

      state.morphFrame = requestAnimationFrame(step);
    };

    setStoryGlobalState(COUNTY_POWER_STORY_MORPH_STATE, 0);
    state.morphFrame = requestAnimationFrame(step);
  }

  function updateAnimationLoop(): void {
    const shouldAnimate = state.animationEnabled && state.visible;
    if (!shouldAnimate) {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      setStoryGlobalState(COUNTY_POWER_STORY_PHASE_STATE, 0);
      return;
    }

    if (animationFrame !== null) {
      return;
    }

    const step = (now: number): void => {
      if (state.destroyed) {
        return;
      }

      setStoryGlobalState(
        COUNTY_POWER_STORY_PHASE_STATE,
        (now / ANIMATION_PERIOD_MS) * Math.PI * 2
      );
      refreshChapterSources(now);
      if (canMutateStoryStyle()) {
        map.triggerRepaint();
      }
      animationFrame = requestAnimationFrame(step);
    };

    animationFrame = requestAnimationFrame(step);
  }

  function cacheSnapshotEntry(args: {
    readonly cacheAsLatest: boolean;
    readonly entry: CountyPowerStorySnapshotCacheEntry;
    readonly snapshotKey: string;
  }): void {
    const preservedKeys: string[] = [args.snapshotKey];

    state.snapshotCache.set(args.snapshotKey, args.entry);

    if (args.entry.publicationRunId !== null) {
      const publicationSnapshotKey = buildSnapshotCacheKey({
        publicationRunId: args.entry.publicationRunId,
        storyId: args.entry.storyId,
        window: args.entry.window,
      });
      state.snapshotCache.set(publicationSnapshotKey, args.entry);
      preservedKeys.push(publicationSnapshotKey);
    }

    if (args.cacheAsLatest) {
      // Keep the current publication reusable for ordinary story/window toggles.
      const latestSnapshotKey = buildSnapshotCacheKey({
        storyId: args.entry.storyId,
        window: args.entry.window,
      });
      state.snapshotCache.set(latestSnapshotKey, args.entry);
      preservedKeys.push(latestSnapshotKey);
    }

    if (state.activeSnapshotKey !== null) {
      preservedKeys.push(state.activeSnapshotKey);
    }

    if (state.latestRequestedSnapshotKey !== null) {
      preservedKeys.push(state.latestRequestedSnapshotKey);
    }

    const retainedKeys = new Set(preservedKeys);
    for (const cacheKey of state.snapshotCache.keys()) {
      if (state.snapshotCache.size <= MAX_SNAPSHOT_CACHE_KEYS) {
        break;
      }
      if (retainedKeys.has(cacheKey)) {
        continue;
      }

      state.snapshotCache.delete(cacheKey);
    }
  }

  function applySnapshotEntry(args: {
    readonly entry: CountyPowerStorySnapshotCacheEntry;
    readonly snapshotKey: string;
  }): void {
    const previousRowsByCounty = state.rowsByCounty;
    const snapshotChanged =
      state.activeSnapshotKey !== args.snapshotKey ||
      state.rowsByCounty !== args.entry.rowsByCounty;

    state.storyId = args.entry.storyId;
    state.window = args.entry.window;
    state.publicationRunId = args.entry.publicationRunId;
    state.renderedStoryId = args.entry.storyId;
    state.renderedWindow = args.entry.window;
    state.rowsByCounty = args.entry.rowsByCounty;
    state.activeSnapshotKey = args.snapshotKey;
    state.transmissionRoutes = [];

    applyFeatureStates(previousRowsByCounty);
    applyVisibility();
    refreshHeartbeatSources();
    refreshSeamHazeSource();
    refreshPolicySources(performance.now());
    emitSelectedCounty(state.selectedCountyFips);
    statusState.value = { state: "ready" };

    if (snapshotChanged) {
      startMorphAnimation();
    }

    ensureChapterDataLoaded().catch((error: unknown) => {
      console.error("[county-power-story] chapter data refresh failed", error);
    });
  }

  function requestSnapshotEntry(args: {
    readonly cacheAsLatest: boolean;
    readonly publicationRunId?: string | undefined;
    readonly snapshotKey: string;
    readonly storyId: CountyPowerStoryId;
    readonly window: CountyPowerStoryWindow;
  }): Promise<CountyPowerStorySnapshotCacheEntry> {
    const existingRequest = state.pendingSnapshotRequests.get(args.snapshotKey);
    if (typeof existingRequest !== "undefined") {
      return existingRequest;
    }

    const request = (async () => {
      const result = await fetchCountyPowerStorySnapshot(args.storyId, {
        publicationRunId: args.publicationRunId,
        window: args.window,
      });
      if (!result.ok) {
        throw new Error(result.message ?? "Failed to load county story snapshot.");
      }

      const entry: CountyPowerStorySnapshotCacheEntry = {
        publicationRunId: result.data.publicationRunId,
        rowsByCounty: new Map(
          result.data.rows.map((row): [string, CountyPowerStoryRow] => [row.countyFips, row])
        ),
        storyId: result.data.storyId,
        window: result.data.window,
      };

      cacheSnapshotEntry({
        cacheAsLatest: args.cacheAsLatest,
        entry,
        snapshotKey: args.snapshotKey,
      });

      return entry;
    })().finally(() => {
      state.pendingSnapshotRequests.delete(args.snapshotKey);
    });

    state.pendingSnapshotRequests.set(args.snapshotKey, request);
    return request;
  }

  function isStoryRequestedVisible(storyId: CountyPowerStoryId): boolean {
    return state.layerVisibility[activeStoryLayerId(storyId)];
  }

  function setStoryRequestedVisible(storyId: CountyPowerStoryId, visible: boolean): void {
    const nextLayerId = activeStoryLayerId(storyId);

    if (visible) {
      for (const layerId of STORY_LAYER_IDS) {
        const candidateStoryId = storyIdFromCatalogLayerId(layerId);
        if (candidateStoryId !== null) {
          state.layerVisibility[layerId] = layerId === nextLayerId;
        }
      }
      return;
    }

    state.layerVisibility[nextLayerId] = false;
  }

  function readRequestedVisibleStoryId(): CountyPowerStoryId | null {
    for (const layerId of STORY_LAYER_IDS) {
      const storyId = storyIdFromCatalogLayerId(layerId);
      if (storyId !== null && state.layerVisibility[layerId]) {
        return storyId;
      }
    }

    return null;
  }

  function loadSnapshot(args: {
    readonly cacheAsLatest?: boolean | undefined;
    readonly publicationRunId?: string | undefined;
    readonly storyId: CountyPowerStoryId;
    readonly window: CountyPowerStoryWindow;
  }): Promise<void> {
    const snapshotKey = buildSnapshotCacheKey(args);
    const cacheAsLatest =
      typeof args.cacheAsLatest === "boolean" ? args.cacheAsLatest : !args.publicationRunId;
    const cachedEntry = state.snapshotCache.get(snapshotKey);

    state.latestRequestedSnapshotKey = snapshotKey;

    if (typeof cachedEntry !== "undefined") {
      applySnapshotEntry({
        entry: cachedEntry,
        snapshotKey,
      });
      return Promise.resolve();
    }

    statusState.value = { state: "loading" };

    return (async () => {
      try {
        let entry: CountyPowerStorySnapshotCacheEntry;

        if (typeof cachedEntry === "undefined") {
          entry = await requestSnapshotEntry({
            cacheAsLatest,
            publicationRunId: args.publicationRunId,
            snapshotKey,
            storyId: args.storyId,
            window: args.window,
          });
        } else {
          entry = cachedEntry;
        }

        if (state.destroyed || state.latestRequestedSnapshotKey !== snapshotKey) {
          return;
        }

        applySnapshotEntry({
          entry,
          snapshotKey,
        });
      } catch (error: unknown) {
        if (state.destroyed || state.latestRequestedSnapshotKey !== snapshotKey) {
          return;
        }

        const reason =
          error instanceof Error ? error.message : "Failed to load county story snapshot.";
        statusState.value = { state: "error", reason };
        throw error;
      }
    })();
  }

  async function refreshPublicationStatus(): Promise<void> {
    if (!(state.visible && !state.pollInFlight)) {
      return;
    }

    state.pollInFlight = true;

    try {
      const result = await fetchCountyScoresStatus();
      if (state.destroyed) {
        return;
      }

      if (!result.ok) {
        throw new Error(result.message ?? "Failed to refresh county story publication status.");
      }

      const nextPublicationRunId = result.data.publicationRunId;
      if (
        typeof nextPublicationRunId === "string" &&
        nextPublicationRunId.length > 0 &&
        nextPublicationRunId !== state.publicationRunId
      ) {
        await loadSnapshot({
          cacheAsLatest: true,
          publicationRunId: nextPublicationRunId,
          storyId: state.storyId,
          window: state.window,
        });
      }
    } catch (error: unknown) {
      if (!state.destroyed) {
        console.error("[county-power-story] publication status refresh failed", error);
      }
    } finally {
      state.pollInFlight = false;
    }
  }

  function updateStatusPolling(): void {
    if (state.destroyed) {
      if (state.pollTimer !== null) {
        globalThis.clearInterval(state.pollTimer);
        state.pollTimer = null;
      }
      return;
    }

    if (state.visible) {
      if (state.pollTimer !== null) {
        return;
      }

      state.pollTimer = globalThis.setInterval(() => {
        refreshPublicationStatus().catch(() => undefined);
      }, COUNTY_POWER_STORY_STATUS_POLL_MS);
      refreshPublicationStatus().catch(() => undefined);
      return;
    }

    if (state.pollTimer !== null) {
      globalThis.clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function queryTopStoryFeature(event: MapPointerEvent): CountyPowerStoryRow | null {
    const layers = interactiveLayerIds(state, map.getZoom());
    if (layers === null) {
      return null;
    }

    const features = map.queryRenderedFeatures(event.point, { layers });
    for (const feature of features) {
      const countyFips = readCountyFipsFromFeature(feature);
      if (countyFips === null) {
        continue;
      }

      const row = state.rowsByCounty.get(countyFips);
      if (typeof row !== "undefined") {
        return row;
      }
    }

    return null;
  }

  const hoverController = createFeatureHoverController(map, {
    isInteractionEnabled: () => {
      if (!(options.isInteractionEnabled?.() ?? true)) {
        return false;
      }

      return !(options.isHoverSuppressed?.() ?? false);
    },
    onHoverChange: options.onHoverChange,
    resolveHoverCandidate(event) {
      const row = queryTopStoryFeature(event);
      if (row === null) {
        return null;
      }

      const screenPoint: CountyPowerStoryHoverState["screenPoint"] = [
        event.point[0],
        event.point[1],
      ];

      return {
        nextHover: {
          row,
          screenPoint,
          storyId: state.storyId,
          window: state.window,
        },
        nextTarget: {
          ...buildFeatureStateTarget(row.countyFips),
        },
      };
    },
  });

  const onClick = (event: MapClickEvent): void => {
    if (!(options.isInteractionEnabled?.() ?? true)) {
      return;
    }

    const layers = interactiveLayerIds(state, map.getZoom());
    if (layers === null) {
      updateSelectedCounty(null);
      return;
    }

    const features = map.queryRenderedFeatures(event.point, { layers });
    const row = features
      .map((feature) => {
        const countyFips = readCountyFipsFromFeature(feature);
        return countyFips === null ? null : (state.rowsByCounty.get(countyFips) ?? null);
      })
      .find((candidate): candidate is CountyPowerStoryRow => candidate !== null);
    if (typeof row === "undefined" || row === null) {
      updateSelectedCounty(null);
      return;
    }

    updateSelectedCounty(state.selectedCountyFips === row.countyFips ? null : row.countyFips);
  };

  const onMoveEnd = (): void => {
    if (state.destroyed) {
      return;
    }

    applyVisibility();
  };

  const onLoad = (): void => {
    if (state.destroyed) {
      return;
    }

    try {
      ensureStyleArtifacts();
      if (state.rowsByCounty.size > 0) {
        applyFeatureStates(new Map<string, CountyPowerStoryRow>());
      }
      statusState.value =
        statusState.value.state === "error" ? statusState.value : { state: "ready" };
    } catch (error: unknown) {
      const reason =
        error instanceof Error ? error.message : "Failed to initialize county story layers.";
      statusState.value = { state: "error", reason };
      throw error;
    }
  };

  map.on("load", onLoad);
  map.on("moveend", onMoveEnd);
  map.onClick(onClick);

  queueMicrotask(() => {
    const style = map.getStyle();
    const styleLayers =
      typeof style === "object" && style !== null ? Reflect.get(style, "layers") : undefined;

    if (!state.destroyed && Array.isArray(styleLayers) && styleLayers.length > 0) {
      onLoad();
    }
  });

  const rootController: CountyPowerStoryRuntimeController = {
    destroy(): void {
      hoverController.destroy();
    },
    setAnimationEnabled(enabled: boolean): void {
      state.animationEnabled = enabled;
      updateAnimationLoop();
    },
    async setChapterId(chapterId: CountyPowerStoryChapterId): Promise<void> {
      state.chapterId = chapterId;
      applyChapterVisibility();
      await ensureChapterDataLoaded();
    },
    async setChapterVisible(visible: boolean): Promise<void> {
      state.chapterVisible = visible;
      applyChapterVisibility();
      if (!visible) {
        return;
      }

      await ensureChapterDataLoaded();
    },
    setSelectedCounty(countyFips: string | null): void {
      updateSelectedCounty(countyFips, false);
    },
    setSeamHazeEnabled(enabled: boolean): void {
      state.seamHazeEnabled = enabled;
      applyChapterVisibility();
      if (enabled) {
        refreshSeamHazeSource();
      }
    },
    async setStoryId(storyId: CountyPowerStoryId): Promise<void> {
      const previousStoryId = state.storyId;
      const shouldTransferVisibility =
        previousStoryId !== storyId && isStoryRequestedVisible(previousStoryId);

      state.storyId = storyId;
      if (shouldTransferVisibility) {
        setStoryRequestedVisible(storyId, true);
      }

      applyExtrusionPaint();
      applyVisibility();

      if (!isStoryRequestedVisible(storyId)) {
        return;
      }

      await loadSnapshot({
        storyId,
        window: state.window,
      });
      await ensureChapterDataLoaded();
    },
    setThreeDimensionalEnabled(enabled: boolean): void {
      state.threeDimensional = enabled;
      applyVisibility();
    },
    async setVisible(visible: boolean): Promise<void> {
      setStoryRequestedVisible(state.storyId, visible);
      applyVisibility();

      if (!visible) {
        return;
      }

      await loadSnapshot({
        storyId: state.storyId,
        window: state.window,
      });
      await ensureChapterDataLoaded();
    },
    async setWindow(window: CountyPowerStoryWindow): Promise<void> {
      if (state.window === window && state.rowsByCounty.size > 0) {
        return;
      }

      state.window = window;
      if (!isStoryRequestedVisible(state.storyId)) {
        applyVisibility();
        return;
      }

      await loadSnapshot({
        storyId: state.storyId,
        window,
      });
      await ensureChapterDataLoaded();
    },
  };

  function createSubController(
    layerId: CountyPowerStoryCatalogLayerId
  ): CountyPowerStoryLayerVisibilityController {
    return {
      destroy(): void {
        return;
      },
      layerId,
      setVisible(visible: boolean): void {
        if (layerId === "models.county-power-3d") {
          state.layerVisibility[layerId] = visible;
          applyVisibility();
          return;
        }

        const storyId = storyIdFromCatalogLayerId(layerId);
        if (storyId === null) {
          return;
        }

        if (visible) {
          state.storyId = storyId;
          setStoryRequestedVisible(storyId, true);
          applyExtrusionPaint();
          applyVisibility();
          loadSnapshot({
            storyId,
            window: state.window,
          }).catch((error: unknown) => {
            console.error("[county-power-story] snapshot load failed", error);
          });
          return;
        }

        state.layerVisibility[layerId] = false;
        if (state.storyId === storyId) {
          state.storyId = readRequestedVisibleStoryId() ?? storyId;
          applyExtrusionPaint();
        }
        applyVisibility();
      },
    };
  }

  const controllers: Readonly<
    Record<CountyPowerStoryCatalogLayerId, CountyPowerStoryLayerVisibilityController>
  > = {
    "models.county-power-grid-stress": createSubController("models.county-power-grid-stress"),
    "models.county-power-queue-pressure": createSubController("models.county-power-queue-pressure"),
    "models.county-power-market-structure": createSubController(
      "models.county-power-market-structure"
    ),
    "models.county-power-policy-watch": createSubController("models.county-power-policy-watch"),
    "models.county-power-3d": createSubController("models.county-power-3d"),
  };

  function removeLayerIfPresent(layerId: string): void {
    if (map.hasLayer(layerId)) {
      map.removeLayer(layerId);
    }
  }

  function removeSourceIfPresent(sourceId: string): void {
    if (map.hasSource(sourceId)) {
      map.removeSource(sourceId);
    }
  }

  function removeStoryLayers(): void {
    for (const layerId of STORY_LAYER_IDS) {
      const storyId = storyIdFromCatalogLayerId(layerId);
      if (storyId === null) {
        continue;
      }

      const styleLayerIds = countyPowerStoryStyleLayerIds(storyId);
      removeLayerIfPresent(styleLayerIds.outlineLayerId);
      removeLayerIfPresent(styleLayerIds.fillLayerId);
    }

    removeLayerIfPresent(countyPowerStoryExtrusionLayerId());
  }

  function removeChapterLayers(): void {
    for (const layerId of ALL_CHAPTER_LAYER_IDS) {
      removeLayerIfPresent(layerId);
    }
  }

  function removeCountyPowerSources(): void {
    removeSourceIfPresent(COUNTY_POWER_STORY_SOURCE_ID);

    for (const sourceId of [
      COUNTY_POWER_STORY_HEARTBEAT_SOURCE_ID,
      COUNTY_POWER_STORY_SUBREGION_SOURCE_ID,
      COUNTY_POWER_STORY_TRANSFER_BASE_SOURCE_ID,
      COUNTY_POWER_STORY_TRANSFER_FLOW_SOURCE_ID,
      COUNTY_POWER_STORY_QUEUE_SOURCE_ID,
      COUNTY_POWER_STORY_QUEUE_HOTSPOT_SOURCE_ID,
      COUNTY_POWER_STORY_POLICY_SOURCE_ID,
      COUNTY_POWER_STORY_SEAM_HAZE_SOURCE_ID,
      COUNTY_POWER_STORY_TRANSMISSION_FLOW_SOURCE_ID,
      COUNTY_POWER_STORY_TRANSMISSION_SOURCE_ID,
    ]) {
      removeSourceIfPresent(sourceId);
    }
  }

  return {
    get status(): LayerStatus {
      return statusState.value;
    },
    controller: rootController,
    controllers,
    destroy(): void {
      state.destroyed = true;
      updateStatusPolling();
      stopMorphAnimation();

      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }

      hoverController.destroy();
      map.off("load", onLoad);
      map.off("moveend", onMoveEnd);
      map.offClick(onClick);
      removeStoryLayers();
      removeChapterLayers();
      removeCountyPowerSources();
    },
  };
}
