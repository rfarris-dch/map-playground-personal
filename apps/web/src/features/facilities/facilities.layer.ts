import { getApiErrorMessage, getApiErrorReason } from "@map-migration/core-runtime/api";
import { runEffectPromise } from "@map-migration/core-runtime/effect";
import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { BBox } from "@map-migration/geo-kernel/geometry";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type {
  IMap,
  IMapMarker,
  LngLatBounds,
  MapClickEvent,
  MapRenderedFeature,
} from "@map-migration/map-engine";
import { getFacilitiesStyleLayerIds } from "@map-migration/map-style";
import { Effect, Either } from "effect";
import {
  createAppPerformanceTimer,
  recordAppPerformanceCounter,
  recordAppPerformanceMeasurement,
} from "@/features/app/diagnostics/app-performance.service";
import type {
  MapInteractionSnapshot,
  MapInteractionType,
} from "@/features/app/interaction/map-interaction.types";
import { shouldRefreshViewportData } from "@/features/app/interaction/map-interaction-policy.service";
import { fetchFacilitiesByBboxEffect } from "@/features/facilities/api";
import {
  applyFacilitiesFilter,
  bboxContains,
  emptyFacilitiesSourceData,
  evaluateFacilitiesGuardrails,
  expandBbox,
  filterFacilitiesFeaturesToBbox,
  filterFacilitiesFeaturesToViewport,
  findFacilitiesBboxCacheEntry,
  hasFeatureId,
  isFeatureId,
  quantizeBbox,
  toFacilityId,
  upsertFacilitiesBboxCacheEntry,
} from "@/features/facilities/facilities.service";
import type {
  FacilitiesLayerController,
  FacilitiesLayerOptions,
  FacilitiesLayerState,
  FacilitiesStatus,
  FacilitiesViewMode,
  FacilitiesViewportRequestContext,
  SelectedFacilityRef,
} from "@/features/facilities/facilities.types";
import {
  buildFacilitiesClusterProperties,
  buildFacilityClusterMarkerModel,
  createFacilityClusterMarkerElement,
  createFacilityClusterMarkerSignature,
  reconcileFacilityClusterMarkers,
} from "@/features/facilities/facilities-cluster.service";
import type { FacilityClusterMarkerModel } from "@/features/facilities/facilities-cluster.types";
import providerLogoMap from "@/features/facilities/provider-logo-map.json";
import { createStressGovernor } from "@/features/parcels/parcels.service";

function defaultPerspective(): FacilityPerspective {
  return "colocation";
}

const providerNameTokenPattern = /[^A-Za-z0-9]+/;
const textEncoder = new TextEncoder();
const FACILITIES_BBOX_CACHE_MAX_ENTRIES = 4;
const TRAILING_SLASHES_RE = /\/+$/;

function measureResponseBodyBytes(rawBody: unknown): number {
  if (typeof rawBody === "string") {
    return textEncoder.encode(rawBody).length;
  }

  if (ArrayBuffer.isView(rawBody)) {
    return rawBody.byteLength;
  }

  if (rawBody instanceof ArrayBuffer) {
    return rawBody.byteLength;
  }

  if (typeof Blob !== "undefined" && rawBody instanceof Blob) {
    return rawBody.size;
  }

  return 0;
}

function toFacilitiesCatalogLayerId(
  perspective: FacilityPerspective
): "facilities.colocation" | "facilities.hyperscale" | "facilities.enterprise" {
  if (perspective === "hyperscale") {
    return "facilities.hyperscale";
  }

  if (perspective === "enterprise") {
    return "facilities.enterprise";
  }

  return "facilities.colocation";
}

function toAbsoluteAppUrl(path: string): string {
  if (
    typeof window === "undefined" ||
    typeof window.location === "undefined" ||
    typeof window.location.origin !== "string"
  ) {
    return path;
  }

  const normalizedOrigin = window.location.origin.replace(TRAILING_SLASHES_RE, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedOrigin}${normalizedPath}`;
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("[facilities.layer] Failed to create 2d canvas context.");
  }

  return context;
}

interface ClusterMarkerEntry {
  readonly marker: IMapMarker;
  readonly signature: string;
}

interface ViewportFeaturesCache {
  features: FacilitiesFeatureCollection["features"] | null;
  viewportFeatures: FacilitiesFeatureCollection["features"];
  viewportKey: string | null;
}

interface ViewportPresentationCache {
  bboxKey: string | null;
  features: FacilitiesFeatureCollection["features"] | null;
  requestId: string | null;
  truncated: boolean;
  viewMode: FacilitiesViewMode | null;
}

interface ProviderLogoLoadRequest {
  readonly facilityCount: number;
  readonly providerId: string;
  readonly url: string;
}

interface ProviderLogoLoadPlan {
  readonly requestKey: string | null;
  readonly requests: readonly ProviderLogoLoadRequest[];
  readonly viewportKey: string | null;
}

function computePointFeatureBounds(features: readonly MapRenderedFeature[]): LngLatBounds | null {
  let west = 180;
  let east = -180;
  let south = 90;
  let north = -90;

  for (const feature of features) {
    if (feature.geometry.type !== "Point") {
      continue;
    }

    const lng = feature.geometry.coordinates[0] as number;
    const lat = feature.geometry.coordinates[1] as number;
    if (lng < west) {
      west = lng;
    }
    if (lng > east) {
      east = lng;
    }
    if (lat < south) {
      south = lat;
    }
    if (lat > north) {
      north = lat;
    }
  }

  return west <= east ? { west, south, east, north } : null;
}

export function mountFacilitiesLayer(
  map: IMap,
  options: FacilitiesLayerOptions = {}
): FacilitiesLayerController {
  const VIEWPORT_BBOX_DECIMALS = 2;
  const perspective = options.perspective ?? defaultPerspective();
  const sourceId = toFacilitiesCatalogLayerId(perspective);
  const styleLayerIds = getFacilitiesStyleLayerIds(sourceId);
  const clusterLayerId = styleLayerIds.clusterLayerId;
  const pointLayerId = styleLayerIds.pointLayerId;
  const minZoom = options.minZoom ?? 0;
  const limit = options.limit ?? 2000;
  const debounceMs = options.debounceMs ?? 250;
  const iconMaxViewportFeatures = options.iconMaxViewportFeatures ?? Number.POSITIVE_INFINITY;
  const iconMinZoom = options.iconMinZoom ?? 0;
  const maxViewportWidthKm = options.maxViewportWidthKm ?? Number.POSITIVE_INFINITY;
  const maxViewportFeatureBudget = options.maxViewportFeatureBudget ?? Number.POSITIVE_INFINITY;
  const defaultCircleColor = perspective === "hyperscale" ? "#10b981" : "#3b82f6";
  const hoverCircleColor = perspective === "hyperscale" ? "#059669" : "#2563eb";
  const selectedCircleColor = perspective === "hyperscale" ? "#047857" : "#1d4ed8";

  const heatmapLayerId = `${sourceId}.heatmap`;
  const iconFallbackLayerId = `${sourceId}.icon-fallback`;
  const logoBaseUrl = toAbsoluteAppUrl("/api/geo/facilities/provider-logos");
  const loadedLogos = new Set<string>();
  const failedLogos = new Set<string>();
  const inflightLogoLoads = new Map<string, Promise<void>>();
  const providerNamesById = new Map<string, string>();
  const clusterMarkers = new Map<number, ClusterMarkerEntry>();

  const LOGO_SIZE = 128;
  const logoPrefix = "logo-";
  const LOGO_LOAD_DEFER_MS = 180;
  const DEFAULT_LOGO_LOAD_BATCH_SIZE = 24;
  const DEFAULT_LOGO_LOAD_BATCH_YIELD_MS = 16;

  const replacingImages = new Set<string>();
  const viewportFeaturesCache: ViewportFeaturesCache = {
    viewportKey: null,
    features: null,
    viewportFeatures: [],
  };
  const viewportPresentationCache: ViewportPresentationCache = {
    bboxKey: null,
    features: null,
    requestId: null,
    truncated: false,
    viewMode: null,
  };
  let bboxCacheEntries: ReturnType<typeof upsertFacilitiesBboxCacheEntry> = [];
  let appliedSourceFeatures: FacilitiesFeatureCollection["features"] | null = null;
  let logoLoadTimer: ReturnType<typeof setTimeout> | null = null;
  let activeLogoLoadKey: string | null = null;
  let activeLogoViewportKey: string | null = null;
  let lastMoveEndStartedAtMs: number | null = null;
  let scheduledLogoLoadKey: string | null = null;
  let scheduledLogoViewportKey: string | null = null;
  let scheduledRefreshFetchKey: string | null = null;
  let unsubscribeInteractionCoordinator: (() => void) | null = null;
  let lastInteractionSnapshot: MapInteractionSnapshot | null =
    options.interactionCoordinator === null || typeof options.interactionCoordinator === "undefined"
      ? null
      : options.interactionCoordinator.getLastSnapshot();

  const toFallbackLogoText = (providerName: string | null): string => {
    if (providerName === null) {
      return "DC";
    }

    const tokens = providerName
      .trim()
      .split(providerNameTokenPattern)
      .filter((token) => token.length > 0);

    const first = tokens[0];
    const second = tokens[1];
    if (first !== undefined && second !== undefined) {
      return `${first[0] ?? "D"}${second[0] ?? "C"}`.toUpperCase();
    }

    const compactName = providerName.replace(/[^A-Za-z0-9]+/g, "");
    if (compactName.length >= 2) {
      return compactName.slice(0, 2).toUpperCase();
    }

    if (compactName.length === 1) {
      return `${compactName.toUpperCase()}C`;
    }

    return "DC";
  };

  const createFallbackLogoImage = (providerName: string | null): ImageData => {
    const canvas = document.createElement("canvas");
    canvas.width = LOGO_SIZE;
    canvas.height = LOGO_SIZE;
    const context = getCanvasContext(canvas);

    context.clearRect(0, 0, LOGO_SIZE, LOGO_SIZE);
    context.beginPath();
    context.arc(LOGO_SIZE / 2, LOGO_SIZE / 2, LOGO_SIZE / 2, 0, Math.PI * 2);
    context.closePath();
    context.fillStyle = perspective === "hyperscale" ? "#059669" : "#2563eb";
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = "700 44px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(toFallbackLogoText(providerName), LOGO_SIZE / 2, LOGO_SIZE / 2);

    return context.getImageData(0, 0, LOGO_SIZE, LOGO_SIZE);
  };

  const replaceLogoImage = (imageId: string, image: ImageData): void => {
    if (map.hasImage(imageId)) {
      replacingImages.add(imageId);
      try {
        map.replaceImage(imageId, image);
      } finally {
        replacingImages.delete(imageId);
      }
      return;
    }

    map.addImage(imageId, image);
  };

  const installFallbackLogo = (providerId: string): void => {
    const providerName = providerNamesById.get(providerId) ?? null;
    replaceLogoImage(`${logoPrefix}${providerId}`, createFallbackLogoImage(providerName));
    loadedLogos.add(providerId);
  };

  const handleStyleImageMissing = (id: string): void => {
    if (!id.startsWith(logoPrefix) || map.hasImage(id) || replacingImages.has(id)) {
      return;
    }

    map.addImage(id, createFallbackLogoImage(null));
  };

  map.onStyleImageMissing(handleStyleImageMissing);

  const normalizeLogoImage = (source: ImageBitmap | HTMLImageElement | ImageData): ImageData => {
    const canvas = document.createElement("canvas");
    canvas.width = LOGO_SIZE;
    canvas.height = LOGO_SIZE;
    const ctx = getCanvasContext(canvas);
    const sw = source.width;
    const sh = source.height;

    const scale = Math.min(LOGO_SIZE / sw, LOGO_SIZE / sh);
    const dw = Math.round(sw * scale);
    const dh = Math.round(sh * scale);
    const dx = Math.round((LOGO_SIZE - dw) / 2);
    const dy = Math.round((LOGO_SIZE - dh) / 2);

    ctx.beginPath();
    ctx.arc(LOGO_SIZE / 2, LOGO_SIZE / 2, LOGO_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (source instanceof ImageData) {
      const tmp = document.createElement("canvas");
      tmp.width = sw;
      tmp.height = sh;
      getCanvasContext(tmp).putImageData(source, 0, 0);
      ctx.drawImage(tmp, dx, dy, dw, dh);
    } else {
      ctx.drawImage(source, dx, dy, dw, dh);
    }

    return ctx.getImageData(0, 0, LOGO_SIZE, LOGO_SIZE);
  };

  const resolveLogoLoadBatchSize = (requestCount: number): number => {
    if (requestCount >= 480) {
      return 6;
    }
    if (requestCount >= 240) {
      return 8;
    }
    if (requestCount >= 120) {
      return 12;
    }

    return DEFAULT_LOGO_LOAD_BATCH_SIZE;
  };

  const resolveLogoLoadBatchYieldMs = (requestCount: number): number => {
    if (requestCount >= 480) {
      return 28;
    }
    if (requestCount >= 240) {
      return 24;
    }
    if (requestCount >= 120) {
      return 20;
    }

    return DEFAULT_LOGO_LOAD_BATCH_YIELD_MS;
  };

  const yieldLogoLoadBatch = async (delayMs: number): Promise<void> => {
    await new Promise<void>((resolve) => {
      if (typeof globalThis.requestIdleCallback === "function") {
        globalThis.requestIdleCallback(
          () => {
            resolve();
          },
          { timeout: delayMs }
        );
        return;
      }

      setTimeout(resolve, delayMs);
    });
  };

  const loadProviderLogoBatch = async (
    batch: readonly ProviderLogoLoadRequest[]
  ): Promise<void> => {
    const loadProviderLogoImage = async (
      url: string
    ): Promise<ImageBitmap | HTMLImageElement | ImageData> => {
      if (typeof Image !== "function") {
        return await map.loadImage(url);
      }

      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => {
          resolve(image);
        };
        image.onerror = () => {
          reject(new Error(`[facilities.layer] Failed to load provider logo: ${url}`));
        };
        image.src = url;
      });
    };

    const loadProviderLogo = (providerId: string, url: string): Promise<void> => {
      const existingLoad = inflightLogoLoads.get(providerId);
      if (typeof existingLoad !== "undefined") {
        recordAppPerformanceCounter("facilities.logo-load.skipped", {
          perspective,
          reason: "inflight",
        });
        return existingLoad;
      }

      const loadPromise = (async () => {
        try {
          if (loadedLogos.has(providerId) && map.hasImage(`${logoPrefix}${providerId}`)) {
            return;
          }
          const raw = await loadProviderLogoImage(url);
          const normalized = normalizeLogoImage(raw);
          replaceLogoImage(`${logoPrefix}${providerId}`, normalized);
          loadedLogos.add(providerId);
          recordAppPerformanceCounter("facilities.logo-load.success", { perspective });
        } catch {
          failedLogos.add(providerId);
          installFallbackLogo(providerId);
          recordAppPerformanceCounter("facilities.logo-load.failure", { perspective });
        } finally {
          inflightLogoLoads.delete(providerId);
        }
      })();

      inflightLogoLoads.set(providerId, loadPromise);
      return loadPromise;
    };

    await Promise.allSettled(batch.map(({ providerId, url }) => loadProviderLogo(providerId, url)));
  };

  const rememberProviderName = (
    feature: FacilitiesFeatureCollection["features"][number]
  ): string => {
    const providerId = String(feature.properties?.providerId ?? "");
    const providerName = feature.properties?.providerName;
    if (typeof providerName === "string" && providerName.trim().length > 0) {
      providerNamesById.set(providerId, providerName);
    }

    return providerId;
  };

  const installMissingProviderFallbackLogo = (providerId: string): void => {
    failedLogos.add(providerId);
    installFallbackLogo(providerId);
    recordAppPerformanceCounter("facilities.logo-load.fallback", { perspective });
  };

  const seedViewportFallbackLogos = (features: FacilitiesFeatureCollection["features"]): void => {
    const seededProviderIds = new Set<string>();

    for (const feature of features) {
      const providerId = rememberProviderName(feature);
      if (
        !providerId ||
        seededProviderIds.has(providerId) ||
        map.hasImage(`${logoPrefix}${providerId}`)
      ) {
        continue;
      }

      seededProviderIds.add(providerId);
      replaceLogoImage(
        `${logoPrefix}${providerId}`,
        createFallbackLogoImage(providerNamesById.get(providerId) ?? null)
      );
    }
  };

  const buildProviderLogoLoadKey = (
    requests: readonly ProviderLogoLoadRequest[]
  ): string | null => {
    if (requests.length === 0) {
      return null;
    }

    return requests
      .map(({ providerId }) => providerId)
      .sort((left, right) => left.localeCompare(right))
      .join(",");
  };

  const buildProviderLogoViewportKey = (providerIds: readonly string[]): string | null => {
    if (providerIds.length === 0) {
      return null;
    }

    return [...providerIds].sort((left, right) => left.localeCompare(right)).join(",");
  };

  const countViewportProviderFacilities = (
    features: FacilitiesFeatureCollection["features"]
  ): ReadonlyMap<string, number> => {
    const providerFacilityCounts = new Map<string, number>();

    for (const feature of features) {
      const providerId = rememberProviderName(feature);
      if (!providerId) {
        continue;
      }

      providerFacilityCounts.set(providerId, (providerFacilityCounts.get(providerId) ?? 0) + 1);
    }

    return providerFacilityCounts;
  };

  const compareProviderLogoLoadRequests = (
    left: ProviderLogoLoadRequest,
    right: ProviderLogoLoadRequest
  ): number => {
    if (left.facilityCount !== right.facilityCount) {
      return right.facilityCount - left.facilityCount;
    }

    return left.providerId.localeCompare(right.providerId);
  };

  const appendProviderLogoLoadRequest = (args: {
    readonly feature: FacilitiesFeatureCollection["features"][number];
    readonly logoMap: Readonly<Record<string, string>>;
    readonly providerFacilityCounts: ReadonlyMap<string, number>;
    readonly recordInflightSkips: boolean;
    readonly requests: ProviderLogoLoadRequest[];
    readonly seenProviderIds: Set<string>;
    readonly viewportProviderIds: string[];
  }): void => {
    const providerId = rememberProviderName(args.feature);
    if (!providerId || failedLogos.has(providerId) || args.seenProviderIds.has(providerId)) {
      return;
    }

    args.seenProviderIds.add(providerId);
    args.viewportProviderIds.push(providerId);

    if (loadedLogos.has(providerId) && map.hasImage(`${logoPrefix}${providerId}`)) {
      return;
    }

    if (inflightLogoLoads.has(providerId)) {
      if (args.recordInflightSkips) {
        recordAppPerformanceCounter("facilities.logo-load.skipped", {
          perspective,
          reason: "inflight",
        });
      }
      return;
    }

    const filename = args.logoMap[providerId];
    if (!filename) {
      installMissingProviderFallbackLogo(providerId);
      return;
    }

    args.requests.push({
      facilityCount: args.providerFacilityCounts.get(providerId) ?? 1,
      providerId,
      url: `${logoBaseUrl}/${providerId}/${encodeURIComponent(filename)}`,
    });
  };

  const buildProviderLogoLoadPlan = (
    features: FacilitiesFeatureCollection["features"],
    logoMap: Readonly<Record<string, string>>,
    recordInflightSkips: boolean
  ): ProviderLogoLoadPlan => {
    const providerFacilityCounts = countViewportProviderFacilities(features);
    const requests: ProviderLogoLoadRequest[] = [];
    const seenProviderIds = new Set<string>();
    const viewportProviderIds: string[] = [];

    for (const feature of features) {
      appendProviderLogoLoadRequest({
        feature,
        logoMap,
        providerFacilityCounts,
        recordInflightSkips,
        requests,
        seenProviderIds,
        viewportProviderIds,
      });
    }

    requests.sort(compareProviderLogoLoadRequests);

    return {
      requestKey: buildProviderLogoLoadKey(requests),
      viewportKey: buildProviderLogoViewportKey(viewportProviderIds),
      requests,
    };
  };

  const loadProviderLogos = async (plan: ProviderLogoLoadPlan): Promise<void> => {
    const stopLogoLoadTimer = createAppPerformanceTimer("facilities.logo-load.time", {
      perspective,
    });
    const batchSize = resolveLogoLoadBatchSize(plan.requests.length);
    const batchYieldMs = resolveLogoLoadBatchYieldMs(plan.requests.length);
    const isPlanActive = (): boolean => {
      return activeLogoLoadKey === plan.requestKey && activeLogoViewportKey === plan.viewportKey;
    };

    if (plan.requests.length === 0) {
      stopLogoLoadTimer();
      return;
    }

    recordAppPerformanceMeasurement("facilities.logo-load.plan-size", plan.requests.length, {
      perspective,
    });
    recordAppPerformanceMeasurement("facilities.logo-load.batch-size", batchSize, {
      perspective,
    });
    for (let index = 0; index < plan.requests.length; index += batchSize) {
      if (!isPlanActive()) {
        recordAppPerformanceCounter("facilities.logo-load.skipped", {
          perspective,
          reason: "stale-plan",
        });
        break;
      }

      const batch = plan.requests.slice(index, index + batchSize);
      await loadProviderLogoBatch(batch);

      if (index + batchSize < plan.requests.length) {
        if (!isPlanActive()) {
          recordAppPerformanceCounter("facilities.logo-load.skipped", {
            perspective,
            reason: "stale-plan",
          });
          break;
        }
        await yieldLogoLoadBatch(batchYieldMs);
      }
    }
    stopLogoLoadTimer();
  };

  const state: FacilitiesLayerState = {
    cachedFeatures: [],
    ready: false,
    debounceTimer: null,
    fetchedBbox: null,
    lastRequestId: null,
    lastTruncated: false,
    lastFetchKey: null,
    requestSequence: 0,
    lastSelectedFacilityId: null,
    selectedFeatureId: null,
    stressBlocked: false,
    viewMode: options.initialViewMode ?? "icons",
    visible: true,
  };

  let activeRefreshAbortController: AbortController | null = null;
  let activeRefreshFetchKey: string | null = null;
  let pendingInitialCoordinatorRefresh = false;

  const abortActiveRefresh = (): void => {
    activeRefreshAbortController?.abort();
    activeRefreshAbortController = null;
    activeRefreshFetchKey = null;
  };

  const isInteractionEnabled = (): boolean => {
    return options.isInteractionEnabled?.() ?? true;
  };

  const setStatus = (status: FacilitiesStatus): void => {
    options.onStatus?.(status);
  };

  const stressGovernor = createStressGovernor({
    onChange: (blocked) => {
      state.stressBlocked = blocked;
      options.onStressBlockedChange?.(blocked);
      if (!blocked) {
        return;
      }

      if (state.lastRequestId === null || state.cachedFeatures.length === 0) {
        return;
      }

      const filtered = getFilteredCachedFeatures();
      const bbox = quantizeBbox(map.getBounds(), VIEWPORT_BBOX_DECIMALS);
      const viewportFeatures = getViewportFeatures(filtered, bbox);
      setStatus({
        state: "degraded",
        perspective,
        requestId: state.lastRequestId,
        count: viewportFeatures.length,
        truncated: state.lastTruncated,
        reason: "stress",
      });
    },
  });
  stressGovernor.setEnabled(state.visible);

  const emitViewportUpdate = (
    features: FacilitiesFeatureCollection["features"],
    requestId: string,
    truncated: boolean
  ): void => {
    if (lastMoveEndStartedAtMs !== null) {
      recordAppPerformanceMeasurement(
        "facilities.moveend-to-viewport-update.time",
        globalThis.performance.now() - lastMoveEndStartedAtMs,
        { perspective, truncated }
      );
      lastMoveEndStartedAtMs = null;
    }

    recordAppPerformanceMeasurement("facilities.viewport-feature-count", features.length, {
      perspective,
      truncated,
    });
    options.onViewportUpdate?.({
      perspective,
      features,
      requestId,
      truncated,
    });
  };

  const clearCachedViewport = (): void => {
    state.cachedFeatures = [];
    state.fetchedBbox = null;
    state.lastRequestId = null;
    state.lastTruncated = false;
    viewportFeaturesCache.viewportKey = null;
    viewportFeaturesCache.features = null;
    viewportFeaturesCache.viewportFeatures = [];
  };

  const getFilterPredicate = (): ReturnType<
    NonNullable<FacilitiesLayerOptions["filterPredicate"]>
  > => {
    return options.filterPredicate?.() ?? null;
  };

  const getFilteredCachedFeatures = (): FacilitiesFeatureCollection["features"] => {
    return applyFacilitiesFilter(state.cachedFeatures, getFilterPredicate());
  };

  const toBboxKey = (bbox: BBox): string => {
    return `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
  };

  const toViewportKey = (bbox: BBox): string => {
    const canvasSize = map.getCanvasSize();
    return [
      bbox.west,
      bbox.south,
      bbox.east,
      bbox.north,
      map.getZoom(),
      map.getBearing(),
      map.getPitch(),
      canvasSize.width,
      canvasSize.height,
      state.viewMode,
    ].join(",");
  };

  const getViewportFeatures = (
    features: FacilitiesFeatureCollection["features"],
    bbox: BBox
  ): FacilitiesFeatureCollection["features"] => {
    const viewportKey = toViewportKey(bbox);
    if (
      viewportFeaturesCache.features === features &&
      viewportFeaturesCache.viewportKey === viewportKey
    ) {
      return viewportFeaturesCache.viewportFeatures;
    }

    const viewportFeatures =
      state.viewMode === "clusters" || state.viewMode === "heatmap"
        ? filterFacilitiesFeaturesToBbox(features, bbox)
        : filterFacilitiesFeaturesToViewport({
            canvasSize: map.getCanvasSize(),
            features,
            projectPoint: (coordinates) => map.project([coordinates[0], coordinates[1]]),
          });
    viewportFeaturesCache.features = features;
    viewportFeaturesCache.viewportKey = viewportKey;
    viewportFeaturesCache.viewportFeatures = viewportFeatures;
    return viewportFeatures;
  };

  const clearScheduledLogoLoad = (): void => {
    if (logoLoadTimer === null) {
      return;
    }

    clearTimeout(logoLoadTimer);
    logoLoadTimer = null;
    scheduledLogoLoadKey = null;
    scheduledLogoViewportKey = null;
  };

  const clearViewportPresentationCache = (): void => {
    viewportPresentationCache.bboxKey = null;
    viewportPresentationCache.features = null;
    viewportPresentationCache.requestId = null;
    viewportPresentationCache.truncated = false;
    viewportPresentationCache.viewMode = null;
  };

  const clearAppliedSourceFeatures = (): void => {
    appliedSourceFeatures = null;
  };

  const resolveIconRenderBudget = (
    viewportCount: number
  ): {
    readonly degraded: boolean;
    readonly renderSymbols: boolean;
    readonly showFallback: boolean;
  } => {
    if (state.viewMode !== "icons" || viewportCount <= 0) {
      return {
        degraded: false,
        renderSymbols: false,
        showFallback: false,
      };
    }

    const renderSymbols = map.getZoom() >= iconMinZoom && viewportCount <= iconMaxViewportFeatures;

    return {
      degraded: !renderSymbols,
      renderSymbols,
      showFallback: true,
    };
  };

  const applyIconDensityMode = (
    viewportCount: number
  ): {
    readonly degraded: boolean;
    readonly renderSymbols: boolean;
    readonly showFallback: boolean;
  } => {
    const renderBudget = resolveIconRenderBudget(viewportCount);
    if (state.viewMode !== "icons") {
      return renderBudget;
    }

    if (map.hasLayer(pointLayerId)) {
      map.setLayerVisibility(pointLayerId, renderBudget.renderSymbols);
    }

    if (map.hasLayer(iconFallbackLayerId)) {
      map.setLayerVisibility(iconFallbackLayerId, renderBudget.showFallback);
    }

    return renderBudget;
  };

  const applySourceDataIfNeeded = (features: FacilitiesFeatureCollection["features"]): boolean => {
    if (appliedSourceFeatures === features) {
      return false;
    }

    const stopSourceUpdateTimer = createAppPerformanceTimer("facilities.source-update.time", {
      perspective,
    });
    map.setGeoJSONSourceData(sourceId, { type: "FeatureCollection", features });
    stopSourceUpdateTimer();
    appliedSourceFeatures = features;
    syncSelectionForFeatures(features);
    return true;
  };

  const applyViewportPresentation = (args: {
    readonly bbox: BBox;
    readonly features: FacilitiesFeatureCollection["features"];
    readonly requestId: string;
    readonly truncated: boolean;
  }): void => {
    const bboxKey = toBboxKey(args.bbox);
    const shouldPresentViewport =
      viewportPresentationCache.features !== args.features ||
      viewportPresentationCache.bboxKey !== bboxKey ||
      viewportPresentationCache.requestId !== args.requestId ||
      viewportPresentationCache.truncated !== args.truncated ||
      viewportPresentationCache.viewMode !== state.viewMode;

    if (!shouldPresentViewport) {
      return;
    }

    viewportPresentationCache.features = args.features;
    viewportPresentationCache.bboxKey = bboxKey;
    viewportPresentationCache.requestId = args.requestId;
    viewportPresentationCache.truncated = args.truncated;
    viewportPresentationCache.viewMode = state.viewMode;

    emitViewportUpdate(args.features, args.requestId, args.truncated);
    const renderBudget =
      state.viewMode === "icons"
        ? applyIconDensityMode(args.features.length)
        : { degraded: false, renderSymbols: false, showFallback: false };

    applyViewportStatus({
      count: args.features.length,
      displayBudgetDegraded: renderBudget.degraded,
      requestId: args.requestId,
      truncated: args.truncated,
    });

    if (state.viewMode === "icons") {
      scheduleLogoLoad(args.features);
    }
  };

  const scheduleLogoLoad = (features: FacilitiesFeatureCollection["features"]): void => {
    clearScheduledLogoLoad();
    seedViewportFallbackLogos(features);
    const logoPlan = buildProviderLogoLoadPlan(
      features,
      providerLogoMap as Record<string, string>,
      false
    );
    if (logoPlan.requestKey === null) {
      return;
    }

    if (
      activeLogoViewportKey === logoPlan.viewportKey ||
      scheduledLogoViewportKey === logoPlan.viewportKey ||
      activeLogoLoadKey === logoPlan.requestKey ||
      scheduledLogoLoadKey === logoPlan.requestKey
    ) {
      recordAppPerformanceCounter("facilities.logo-load.skipped", {
        perspective,
        reason: "duplicate-plan",
      });
      return;
    }

    scheduledLogoLoadKey = logoPlan.requestKey;
    scheduledLogoViewportKey = logoPlan.viewportKey;
    logoLoadTimer = setTimeout(() => {
      logoLoadTimer = null;
      scheduledLogoLoadKey = null;
      scheduledLogoViewportKey = null;
      const renderBudget = resolveIconRenderBudget(features.length);
      if (!(state.visible && state.viewMode === "icons" && renderBudget.renderSymbols)) {
        return;
      }

      activeLogoLoadKey = logoPlan.requestKey;
      activeLogoViewportKey = logoPlan.viewportKey;
      loadProviderLogos(logoPlan)
        .catch(ignoreBestEffortAsyncError)
        .finally(() => {
          if (activeLogoLoadKey === logoPlan.requestKey) {
            activeLogoLoadKey = null;
          }
          if (activeLogoViewportKey === logoPlan.viewportKey) {
            activeLogoViewportKey = null;
          }
        });
    }, LOGO_LOAD_DEFER_MS);
  };

  const readFacilityIdFromProperties = (properties: unknown): string | null => {
    if (typeof properties !== "object" || properties === null) {
      return null;
    }

    const facilityId = Reflect.get(properties, "facilityId");
    return typeof facilityId === "string" && facilityId.length > 0 ? facilityId : null;
  };

  const resolveSelectedFacilityId = (featureId: number | string): string => {
    const cachedFeature = state.cachedFeatures.find((feature) => feature.id === featureId);
    return readFacilityIdFromProperties(cachedFeature?.properties) ?? toFacilityId(featureId);
  };

  const toSelectedFacilityRef = (
    featureId: number | string,
    properties: unknown
  ): SelectedFacilityRef => {
    return {
      facilityId: readFacilityIdFromProperties(properties) ?? resolveSelectedFacilityId(featureId),
      perspective,
    };
  };

  const emitSelectedFacility = (
    featureId: number | string | null,
    selectedFacilityOverride?: SelectedFacilityRef
  ): void => {
    if (featureId === null && typeof selectedFacilityOverride === "undefined") {
      options.onSelectFacility?.(null);
      return;
    }

    options.onSelectFacility?.(
      selectedFacilityOverride ??
        (featureId === null
          ? null
          : {
              facilityId: resolveSelectedFacilityId(featureId),
              perspective,
            })
    );
  };

  const removeFacilitiesLayers = (): void => {
    clearClusterMarkers();
    clearAppliedSourceFeatures();
    clearViewportPresentationCache();

    for (const layerId of [heatmapLayerId, clusterLayerId, pointLayerId, iconFallbackLayerId]) {
      if (map.hasLayer(layerId)) {
        map.removeLayer(layerId);
      }
    }

    if (map.hasSource(sourceId)) {
      map.removeSource(sourceId);
    }
  };

  const clearClusterMarkers = (): void => {
    for (const entry of clusterMarkers.values()) {
      entry.marker.remove();
    }

    clusterMarkers.clear();
  };

  const createClusterMarkerEntry = (
    markerModel: FacilityClusterMarkerModel
  ): ClusterMarkerEntry => {
    return {
      marker: map.createHtmlMarker(createFacilityClusterMarkerElement(markerModel), [
        markerModel.center[0],
        markerModel.center[1],
      ]),
      signature: createFacilityClusterMarkerSignature(markerModel),
    };
  };

  const canRenderClusterMarkers = (): boolean => {
    return (
      state.ready && state.visible && state.viewMode === "clusters" && map.hasLayer(clusterLayerId)
    );
  };

  const getVisibleClusterMarkerModels = (): FacilityClusterMarkerModel[] => {
    const canvasSize = map.getCanvasSize();
    const clusterFeatures = map.queryRenderedFeatures(
      [
        [0, 0],
        [canvasSize.width, canvasSize.height],
      ],
      {
        layers: [clusterLayerId],
      }
    );
    const markerModels: FacilityClusterMarkerModel[] = [];

    for (const feature of clusterFeatures) {
      const markerModel = buildFacilityClusterMarkerModel(feature, perspective);
      if (markerModel === null) {
        continue;
      }

      markerModels.push(markerModel);
    }

    return markerModels;
  };

  const getCurrentClusterMarkerSignatures = (): ReadonlyMap<number, string> => {
    const currentSignatures = new Map<number, string>();
    for (const [clusterId, entry] of clusterMarkers) {
      currentSignatures.set(clusterId, entry.signature);
    }

    return currentSignatures;
  };

  const removeClusterMarker = (clusterId: number): void => {
    const currentMarker = clusterMarkers.get(clusterId);
    if (typeof currentMarker === "undefined") {
      return;
    }

    currentMarker.marker.remove();
    clusterMarkers.delete(clusterId);
  };

  const moveClusterMarkers = (
    markerModels: ReturnType<typeof reconcileFacilityClusterMarkers>["moves"]
  ): void => {
    for (const markerModel of markerModels) {
      const currentMarker = clusterMarkers.get(markerModel.clusterId);
      if (typeof currentMarker === "undefined") {
        continue;
      }

      currentMarker.marker.setLngLat([markerModel.center[0], markerModel.center[1]]);
    }
  };

  const replaceClusterMarkers = (
    markerModels: ReturnType<typeof reconcileFacilityClusterMarkers>["replacements"]
  ): void => {
    for (const markerModel of markerModels) {
      removeClusterMarker(markerModel.clusterId);
      clusterMarkers.set(markerModel.clusterId, createClusterMarkerEntry(markerModel));
    }
  };

  const addClusterMarkers = (
    markerModels: ReturnType<typeof reconcileFacilityClusterMarkers>["additions"]
  ): void => {
    for (const markerModel of markerModels) {
      clusterMarkers.set(markerModel.clusterId, createClusterMarkerEntry(markerModel));
    }
  };

  const syncClusterMarkers = (): void => {
    const stopClusterSyncTimer = createAppPerformanceTimer("facilities.cluster-sync.time", {
      perspective,
    });
    if (!canRenderClusterMarkers()) {
      clearClusterMarkers();
      stopClusterSyncTimer();
      return;
    }

    const reconciliation = reconcileFacilityClusterMarkers({
      current: getCurrentClusterMarkerSignatures(),
      nextModels: getVisibleClusterMarkerModels(),
    });
    recordAppPerformanceMeasurement(
      "facilities.cluster-sync.reconciled-count",
      reconciliation.removals.length +
        reconciliation.moves.length +
        reconciliation.replacements.length +
        reconciliation.additions.length,
      { perspective }
    );

    for (const clusterId of reconciliation.removals) {
      removeClusterMarker(clusterId);
    }

    moveClusterMarkers(reconciliation.moves);
    replaceClusterMarkers(reconciliation.replacements);
    addClusterMarkers(reconciliation.additions);
    stopClusterSyncTimer();
  };

  const addSourceForMode = (mode: FacilitiesViewMode): void => {
    const useClustering = mode === "clusters";
    map.addSource(sourceId, {
      type: "geojson",
      data: emptyFacilitiesSourceData(),
      ...(useClustering
        ? {
            cluster: true,
            clusterMaxZoom: 12,
            clusterProperties: buildFacilitiesClusterProperties(),
            clusterRadius: 55,
          }
        : {}),
    });
  };

  const addClusterLayers = (): void => {
    map.addLayer({
      id: clusterLayerId,
      type: "circle",
      source: sourceId,
      minzoom: minZoom,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": defaultCircleColor,
        "circle-opacity": 0.001,
        "circle-stroke-opacity": 0.001,
        "circle-stroke-color": "#111827",
        "circle-stroke-width": 1,
        "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 25, 28, 50, 36, 100, 44],
      },
    });
    map.addLayer({
      id: pointLayerId,
      type: "circle",
      source: sourceId,
      minzoom: minZoom,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          7,
          ["boolean", ["feature-state", "hover"], false],
          6,
          4,
        ],
        "circle-stroke-width": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          2,
          ["boolean", ["feature-state", "hover"], false],
          2,
          1,
        ],
        "circle-stroke-color": "#111827",
        "circle-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          selectedCircleColor,
          ["boolean", ["feature-state", "hover"], false],
          hoverCircleColor,
          defaultCircleColor,
        ],
      },
    });
  };

  const addHeatmapLayer = (): void => {
    map.addLayer({
      id: heatmapLayerId,
      type: "heatmap",
      source: sourceId,
      minzoom: minZoom,
      paint: {
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 12, 3],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 6, 12, 20],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 1, 14, 0.6],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(0,0,0,0)",
          0.2,
          perspective === "hyperscale" ? "#d1fae5" : "#bfdbfe",
          0.4,
          perspective === "hyperscale" ? "#6ee7b7" : "#93c5fd",
          0.6,
          perspective === "hyperscale" ? "#34d399" : "#60a5fa",
          0.8,
          perspective === "hyperscale" ? "#10b981" : "#3b82f6",
          1,
          perspective === "hyperscale" ? "#047857" : "#1d4ed8",
        ],
      },
    } as unknown as Parameters<typeof map.addLayer>[0]);
  };

  const addDotLayer = (): void => {
    map.addLayer({
      id: pointLayerId,
      type: "circle",
      source: sourceId,
      minzoom: minZoom,
      paint: {
        "circle-radius": 3,
        "circle-stroke-width": 0.5,
        "circle-stroke-color": "#111827",
        "circle-color": defaultCircleColor,
      },
    });
  };

  const addBubbleLayer = (): void => {
    map.addLayer({
      id: pointLayerId,
      type: "circle",
      source: sourceId,
      minzoom: minZoom,
      paint: {
        "circle-radius": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          14,
          ["boolean", ["feature-state", "hover"], false],
          12,
          [
            "interpolate",
            ["linear"],
            ["to-number", ["coalesce", ["get", "powerMW"], 0]],
            0,
            4,
            50,
            10,
            200,
            18,
            500,
            26,
          ],
        ],
        "circle-stroke-width": 1,
        "circle-stroke-color": "#111827",
        "circle-opacity": 0.7,
        "circle-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          selectedCircleColor,
          ["boolean", ["feature-state", "hover"], false],
          hoverCircleColor,
          defaultCircleColor,
        ],
      },
    });
  };

  const addIconLayers = (): void => {
    map.addLayer({
      id: iconFallbackLayerId,
      type: "circle",
      source: sourceId,
      minzoom: minZoom,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 6, 7, 10, 10, 14, 13, 18, 16, 24],
        "circle-stroke-width": 2,
        "circle-stroke-color": defaultCircleColor,
        "circle-color": "#ffffff",
      },
    });
    map.addLayer({
      id: pointLayerId,
      type: "symbol",
      source: sourceId,
      minzoom: minZoom,
      layout: {
        "icon-image": ["concat", "logo-", ["to-string", ["get", "providerId"]]],
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          0.06,
          7,
          0.12,
          10,
          0.19,
          13,
          0.25,
          16,
          0.34,
        ],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-padding": 2,
      },
    } as unknown as Parameters<typeof map.addLayer>[0]);
  };

  const addLayersForMode = (mode: FacilitiesViewMode): void => {
    switch (mode) {
      case "clusters":
        addClusterLayers();
        return;
      case "heatmap":
        addHeatmapLayer();
        return;
      case "dots":
        addDotLayer();
        return;
      case "bubbles":
        addBubbleLayer();
        return;
      case "icons":
        addIconLayers();
        return;
      default:
        return;
    }
  };

  const ensureFacilitiesLayers = (): boolean => {
    try {
      if (!map.hasSource(sourceId)) {
        addSourceForMode(state.viewMode);
      }

      const needsClusterLayers = state.viewMode === "clusters";
      const needsPointLayer = state.viewMode !== "heatmap";
      const needsHeatmapLayer = state.viewMode === "heatmap";

      if (needsClusterLayers && !map.hasLayer(clusterLayerId)) {
        addLayersForMode(state.viewMode);
      } else if (needsHeatmapLayer && !map.hasLayer(heatmapLayerId)) {
        addLayersForMode(state.viewMode);
      } else if (needsPointLayer && !map.hasLayer(pointLayerId)) {
        addLayersForMode(state.viewMode);
      }

      return true;
    } catch {
      return false;
    }
  };

  const setSelectedFeatureId = (
    nextFeatureId: number | string | null,
    selectedFacilityOverride?: SelectedFacilityRef
  ): void => {
    const previousFeatureId = state.selectedFeatureId;
    if (previousFeatureId === nextFeatureId) {
      if (
        typeof selectedFacilityOverride !== "undefined" &&
        selectedFacilityOverride !== null &&
        selectedFacilityOverride.facilityId !== state.lastSelectedFacilityId
      ) {
        state.lastSelectedFacilityId = selectedFacilityOverride.facilityId;
        emitSelectedFacility(nextFeatureId, selectedFacilityOverride);
      }
      return;
    }

    if (previousFeatureId !== null) {
      map.setFeatureState(
        {
          source: sourceId,
          id: previousFeatureId,
        },
        { selected: false }
      );
    }

    state.selectedFeatureId = nextFeatureId;
    state.lastSelectedFacilityId = selectedFacilityOverride?.facilityId ?? null;

    if (nextFeatureId !== null) {
      map.setFeatureState(
        {
          source: sourceId,
          id: nextFeatureId,
        },
        { selected: true }
      );
    }

    emitSelectedFacility(nextFeatureId, selectedFacilityOverride);
  };

  const clearSelection = (): void => {
    state.lastSelectedFacilityId = null;
    if (!state.ready) {
      state.selectedFeatureId = null;
      emitSelectedFacility(null);
      return;
    }

    setSelectedFeatureId(null);
  };

  const syncSelectionForFeatures = (features: FacilitiesFeatureCollection["features"]): void => {
    const selectedFeatureId = state.selectedFeatureId;
    if (selectedFeatureId === null) {
      return;
    }

    if (!hasFeatureId(features, selectedFeatureId)) {
      setSelectedFeatureId(null);
      return;
    }

    map.setFeatureState(
      {
        source: sourceId,
        id: selectedFeatureId,
      },
      { selected: true }
    );
  };

  const onLoad = (): void => {
    if (state.ready) {
      return;
    }

    state.ready = true;
    if (!ensureFacilitiesLayers()) {
      clearClusterMarkers();
      return;
    }

    if (!state.visible) {
      map.setGeoJSONSourceData(sourceId, emptyFacilitiesSourceData());
      clearClusterMarkers();
      emitViewportUpdate([], "n/a", false);
      setStatus({ state: "idle" });
      return;
    }

    if (
      options.interactionCoordinator !== null &&
      typeof options.interactionCoordinator !== "undefined"
    ) {
      if (pendingInitialCoordinatorRefresh || lastInteractionSnapshot !== null) {
        pendingInitialCoordinatorRefresh = false;
        scheduleRefresh();
      }
      return;
    }

    scheduleRefresh();
  };

  const onMoveEnd = (interactionType: MapInteractionType = "pan"): void => {
    recordAppPerformanceCounter("map.moveend", {
      feature: "facilities",
      perspective,
    });
    if (!(state.ready && state.visible)) {
      recordAppPerformanceCounter("facilities.refresh.skipped", {
        perspective,
        reason: state.ready ? "not-visible" : "not-ready",
      });
      clearClusterMarkers();
      return;
    }

    syncClusterMarkers();
    if (interactionType === "rotate-only") {
      if (state.lastRequestId !== null) {
        const filtered = getFilteredCachedFeatures();
        const bbox = quantizeBbox(map.getBounds(), VIEWPORT_BBOX_DECIMALS);
        const viewportFeatures = getViewportFeatures(filtered, bbox);
        applyViewportPresentation({
          bbox,
          features: viewportFeatures,
          requestId: state.lastRequestId,
          truncated: state.lastTruncated,
        });
      }
      return;
    }

    lastMoveEndStartedAtMs = globalThis.performance.now();
    scheduleRefresh();
  };

  const ignoreBestEffortAsyncError = (_: unknown): void => {
    _;
  };

  const zoomToCluster = (clusterId: number, _center: [number, number]): void => {
    map
      .getClusterLeaves(sourceId, clusterId, 200)
      .then((leaves) => {
        const bounds = computePointFeatureBounds(leaves);
        if (bounds === null) {
          return;
        }

        map.setViewport({
          type: "bounds",
          bounds,
          padding: 80,
          animate: true,
        });
      })
      .catch(ignoreBestEffortAsyncError);
  };

  const tryHandleClusterClick = (event: MapClickEvent): boolean => {
    if (!(state.viewMode === "clusters" && map.hasLayer(clusterLayerId))) {
      return false;
    }

    const cluster = map.queryRenderedFeatures(event.point, {
      layers: [clusterLayerId],
    })[0];
    const clusterId = cluster?.properties?.cluster_id;
    if (typeof clusterId !== "number") {
      return false;
    }

    options.onClusterClick?.();
    return true;
  };

  const querySelectableLayerIds = (): string[] => {
    if (state.viewMode === "icons" && map.hasLayer(iconFallbackLayerId)) {
      return [iconFallbackLayerId, pointLayerId];
    }

    return [pointLayerId];
  };

  const readPointCenter = (coordinates: unknown): readonly [number, number] | null => {
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return null;
    }

    const longitude = coordinates[0];
    const latitude = coordinates[1];
    if (
      typeof longitude !== "number" ||
      !Number.isFinite(longitude) ||
      typeof latitude !== "number" ||
      !Number.isFinite(latitude)
    ) {
      return null;
    }

    return [longitude, latitude];
  };

  const focusSelectedFeature = (feature: MapRenderedFeature): void => {
    const geom = feature.geometry;
    if (geom.type !== "Point") {
      return;
    }

    const center = readPointCenter(geom.coordinates);
    if (center === null) {
      return;
    }

    const currentZoom = map.getZoom();
    const targetZoom = Math.max(currentZoom + 2, 16);

    map.setViewport({
      type: "center",
      center: [center[0], center[1]],
      zoom: targetZoom,
      animate: true,
    });
  };

  const nudgeToFeature = (feature: MapRenderedFeature): void => {
    const geom = feature.geometry;
    if (geom.type !== "Point") {
      return;
    }

    const center = readPointCenter(geom.coordinates);
    if (center === null) {
      return;
    }

    map.setViewport({
      type: "center",
      center: [center[0], center[1]],
      zoom: map.getZoom(),
      animate: true,
    });
  };

  let pendingClick: {
    featureId: number | string;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  const DOUBLE_CLICK_MS = 300;

  const onClick = (event: MapClickEvent): void => {
    if (!(state.ready && state.visible && isInteractionEnabled())) {
      return;
    }

    if (tryHandleClusterClick(event)) {
      return;
    }

    if (!map.hasLayer(pointLayerId)) {
      return;
    }

    const features = map.queryRenderedFeatures(event.point, {
      layers: querySelectableLayerIds(),
    });

    const selectedFeature = features[0];
    if (!(selectedFeature && isFeatureId(selectedFeature.id))) {
      if (pendingClick !== null) {
        clearTimeout(pendingClick.timer);
        pendingClick = null;
      }
      setSelectedFeatureId(null);
      return;
    }

    const selectedFacility = toSelectedFacilityRef(selectedFeature.id, selectedFeature.properties);

    if (pendingClick !== null && pendingClick.featureId === selectedFeature.id) {
      clearTimeout(pendingClick.timer);
      pendingClick = null;
      emitSelectedFacility(selectedFeature.id, selectedFacility);
      focusSelectedFeature(selectedFeature);
      return;
    }

    if (pendingClick !== null) {
      clearTimeout(pendingClick.timer);
      pendingClick = null;
    }

    setSelectedFeatureId(selectedFeature.id, selectedFacility);

    pendingClick = {
      featureId: selectedFeature.id,
      timer: setTimeout(() => {
        nudgeToFeature(selectedFeature);
        pendingClick = null;
      }, DOUBLE_CLICK_MS),
    };
  };

  const resetVisibleFacilitiesData = (): void => {
    clearScheduledLogoLoad();
    map.setGeoJSONSourceData(sourceId, emptyFacilitiesSourceData());
    clearAppliedSourceFeatures();
    clearViewportPresentationCache();
    clearClusterMarkers();
  };

  const clearRefreshState = (): void => {
    clearCachedViewport();
    clearViewportPresentationCache();
    clearSelection();
    state.lastFetchKey = null;
  };

  const handleRefreshFailure = (args: {
    readonly requestId: string;
    readonly reason: string;
  }): void => {
    state.lastFetchKey = null;
    clearScheduledLogoLoad();

    if (state.cachedFeatures.length === 0) {
      resetVisibleFacilitiesData();
      clearRefreshState();
      emitViewportUpdate([], args.requestId, false);
    } else {
      const filtered = getFilteredCachedFeatures();
      const bbox = quantizeBbox(map.getBounds(), VIEWPORT_BBOX_DECIMALS);
      const viewportFeatures = getViewportFeatures(filtered, bbox);
      applyViewportPresentation({
        bbox,
        features: viewportFeatures,
        requestId: state.lastRequestId ?? args.requestId,
        truncated: state.lastTruncated,
      });
    }

    setStatus({
      state: "error",
      perspective,
      requestId: args.requestId,
      reason: args.reason,
    });
  };

  const getFetchKey = (bbox: BBox): string => {
    return `${perspective}:${bbox.west},${bbox.south},${bbox.east},${bbox.north}:${limit}`;
  };

  const applyViewportStatus = (args: {
    readonly count: number;
    readonly displayBudgetDegraded: boolean;
    readonly requestId: string;
    readonly truncated: boolean;
  }): void => {
    if (args.truncated || args.count > maxViewportFeatureBudget) {
      setStatus({
        state: "degraded",
        perspective,
        requestId: args.requestId,
        count: args.count,
        truncated: args.truncated,
        reason: "feature-budget",
      });
      return;
    }

    if (args.displayBudgetDegraded) {
      setStatus({
        state: "degraded",
        perspective,
        requestId: args.requestId,
        count: args.count,
        truncated: args.truncated,
        reason: "display-budget",
      });
      return;
    }

    setStatus({
      state: "ok",
      perspective,
      requestId: args.requestId,
      count: args.count,
      truncated: args.truncated,
    });
  };

  const emitCoveredViewportStatus = (bbox: BBox): void => {
    recordAppPerformanceCounter("facilities.refresh.skipped", {
      perspective,
      reason: "covered-viewport",
    });
    const filtered = getFilteredCachedFeatures();
    const viewportFeatures = getViewportFeatures(filtered, bbox);
    applyViewportPresentation({
      bbox,
      features: viewportFeatures,
      requestId: state.lastRequestId ?? "n/a",
      truncated: state.lastTruncated,
    });
  };

  const applyRefreshResult = (args: {
    readonly bbox: BBox;
    readonly fetchBbox: BBox;
    readonly features: FacilitiesFeatureCollection["features"];
    readonly requestId: string;
    readonly truncated: boolean;
  }): void => {
    const previousFetchedBboxKey = state.fetchedBbox === null ? null : toBboxKey(state.fetchedBbox);
    const nextFetchedBboxKey = toBboxKey(args.fetchBbox);
    const shouldUpdateSourceData =
      state.cachedFeatures !== args.features || previousFetchedBboxKey !== nextFetchedBboxKey;

    state.cachedFeatures = args.features;
    state.fetchedBbox = args.fetchBbox;
    state.lastRequestId = args.requestId;
    state.lastTruncated = args.truncated;
    const filtered = getFilteredCachedFeatures();

    if (shouldUpdateSourceData) {
      options.onCachedFeaturesUpdate?.(state.cachedFeatures);
      applySourceDataIfNeeded(filtered);
    }

    syncClusterMarkers();
    const viewportFeatures = getViewportFeatures(filtered, args.bbox);
    applyViewportPresentation({
      bbox: args.bbox,
      features: viewportFeatures,
      requestId: args.requestId,
      truncated: args.truncated,
    });
  };

  const applyCachedRefreshResult = (args: {
    readonly bbox: BBox;
    readonly entry: NonNullable<ReturnType<typeof findFacilitiesBboxCacheEntry>>;
  }): void => {
    applyRefreshResult({
      bbox: args.bbox,
      fetchBbox: args.entry.bbox,
      features: args.entry.features,
      requestId: args.entry.requestId,
      truncated: args.entry.truncated,
    });
  };

  const scheduleRefresh = (): void => {
    if (!state.visible) {
      recordAppPerformanceCounter("facilities.refresh.skipped", {
        perspective,
        reason: "not-visible",
      });
      return;
    }

    const bbox = quantizeBbox(map.getBounds(), VIEWPORT_BBOX_DECIMALS);
    const fetchKey = getFetchKey(expandBbox(bbox, 0.3));

    if (state.debounceTimer !== null && scheduledRefreshFetchKey === fetchKey) {
      recordAppPerformanceCounter("facilities.refresh.skipped", {
        perspective,
        reason: "scheduled-fetch-key",
      });
      return;
    }

    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }
    scheduledRefreshFetchKey = fetchKey;

    state.debounceTimer = setTimeout(() => {
      scheduledRefreshFetchKey = null;
      refresh().catch(() => {
        handleRefreshFailure({
          requestId: "n/a",
          reason: "refresh failed",
        });
      });
    }, debounceMs);
  };

  const applySuccessfulRefresh = (args: {
    readonly bbox: BBox;
    readonly fetchBbox: BBox;
    readonly result: {
      readonly data: FacilitiesFeatureCollection;
      readonly rawBody: unknown;
      readonly requestId: string;
    };
  }): void => {
    recordAppPerformanceCounter("facilities.request.succeeded", { perspective });
    recordAppPerformanceMeasurement(
      "facilities.response.feature-count",
      args.result.data.features.length,
      { perspective, truncated: args.result.data.meta.truncated }
    );
    recordAppPerformanceMeasurement(
      "facilities.response.bytes",
      measureResponseBodyBytes(args.result.rawBody),
      {
        perspective,
        truncated: args.result.data.meta.truncated,
      }
    );

    applyRefreshResult({
      bbox: args.bbox,
      fetchBbox: args.fetchBbox,
      features: args.result.data.features,
      requestId: args.result.requestId,
      truncated: args.result.data.meta.truncated,
    });
    bboxCacheEntries = upsertFacilitiesBboxCacheEntry(
      bboxCacheEntries,
      {
        bbox: args.fetchBbox,
        features: args.result.data.features,
        requestId: args.result.requestId,
        truncated: args.result.data.meta.truncated,
      },
      FACILITIES_BBOX_CACHE_MAX_ENTRIES
    );
  };

  const handleFailedRefreshResult = (error: {
    readonly requestId: string;
    readonly reason: string;
  }): void => {
    recordAppPerformanceCounter("facilities.request.failed", { perspective });
    handleRefreshFailure(error);
  };

  const getRefreshViewportContext = (): {
    readonly bbox: BBox;
    readonly fetchBbox: BBox;
    readonly fetchKey: string;
  } | null => {
    const bbox = quantizeBbox(map.getBounds(), VIEWPORT_BBOX_DECIMALS);
    const currentZoom = map.getZoom();
    if (currentZoom < minZoom) {
      recordAppPerformanceCounter("facilities.refresh.skipped", {
        perspective,
        reason: "zoom",
      });
      state.requestSequence += 1;
      clearCachedViewport();
      resetVisibleFacilitiesData();
      clearSelection();
      state.lastFetchKey = null;
      emitViewportUpdate([], "n/a", false);
      setStatus({
        state: "hidden",
        perspective,
        reason: "zoom",
        zoom: currentZoom,
        minZoom,
      });
      return null;
    }

    const guardrailResult = evaluateFacilitiesGuardrails({
      bounds: bbox,
      isStressBlocked: false,
      maxViewportWidthKm,
    });
    if (guardrailResult.blocked) {
      recordAppPerformanceCounter("facilities.refresh.skipped", {
        perspective,
        reason: guardrailResult.reason ?? "viewport-span",
      });
      state.requestSequence += 1;
      clearCachedViewport();
      resetVisibleFacilitiesData();
      clearSelection();
      state.lastFetchKey = null;
      emitViewportUpdate([], "n/a", false);
      setStatus({
        state: "hidden",
        perspective,
        reason: guardrailResult.reason ?? "viewport-span",
        viewportWidthKm: guardrailResult.viewportWidthKm,
        maxViewportWidthKm,
      });
      return null;
    }

    if (state.fetchedBbox !== null && bboxContains(state.fetchedBbox, bbox)) {
      recordAppPerformanceCounter("facilities.covered-viewport", { perspective });
      emitCoveredViewportStatus(bbox);
      return null;
    }

    const fetchBbox = expandBbox(bbox, 0.3);
    const fetchKey = getFetchKey(fetchBbox);
    const cachedEntry = findFacilitiesBboxCacheEntry(bboxCacheEntries, fetchBbox);
    if (cachedEntry !== null) {
      recordAppPerformanceCounter("facilities.bbox-cache.hit", { perspective });
      state.lastFetchKey = fetchKey;
      applyCachedRefreshResult({
        bbox,
        entry: cachedEntry,
      });
      return null;
    }

    recordAppPerformanceCounter("facilities.bbox-cache.miss", { perspective });
    return {
      bbox,
      fetchBbox,
      fetchKey,
    };
  };

  interface ActiveRefreshRequest {
    readonly abortController: AbortController;
    readonly fetchKey: string;
    readonly sequence: number;
    readonly stopRequestTimer: () => void;
  }

  const beginRefreshRequest = (fetchKey: string): ActiveRefreshRequest | null => {
    if (state.lastFetchKey === fetchKey) {
      recordAppPerformanceCounter("facilities.refresh.skipped", {
        perspective,
        reason: "duplicate-fetch-key",
      });
      return null;
    }

    if (activeRefreshFetchKey === fetchKey) {
      recordAppPerformanceCounter("facilities.refresh.skipped", {
        perspective,
        reason: "inflight-fetch-key",
      });
      return null;
    }

    state.lastFetchKey = fetchKey;
    state.requestSequence += 1;

    abortActiveRefresh();
    const abortController = new AbortController();
    activeRefreshAbortController = abortController;
    activeRefreshFetchKey = fetchKey;

    setStatus({
      state: "loading",
      perspective,
    });
    recordAppPerformanceCounter("facilities.request.started", { perspective });

    return {
      abortController,
      fetchKey,
      sequence: state.requestSequence,
      stopRequestTimer: createAppPerformanceTimer("facilities.request.time", {
        perspective,
      }),
    };
  };

  const finishRefreshRequest = (request: ActiveRefreshRequest): void => {
    if (activeRefreshAbortController === request.abortController) {
      activeRefreshAbortController = null;
    }

    if (activeRefreshFetchKey === request.fetchKey) {
      activeRefreshFetchKey = null;
    }

    request.stopRequestTimer();
  };

  const getViewportRequestContext = (): FacilitiesViewportRequestContext | undefined => {
    if (lastInteractionSnapshot === null) {
      return undefined;
    }

    return {
      activeViewMode: state.viewMode,
      interactionType: lastInteractionSnapshot.interactionType,
      viewportKey: lastInteractionSnapshot.canonicalViewportKey,
      zoomBucket: lastInteractionSnapshot.zoomBucket,
    };
  };

  const refresh = async (): Promise<void> => {
    if (!state.visible) {
      recordAppPerformanceCounter("facilities.refresh.skipped", {
        perspective,
        reason: "not-visible",
      });
      return;
    }

    if (!ensureFacilitiesLayers()) {
      recordAppPerformanceCounter("facilities.refresh.skipped", {
        perspective,
        reason: "layers-unavailable",
      });
      state.lastFetchKey = null;
      return;
    }

    const viewportContext = getRefreshViewportContext();
    if (viewportContext === null) {
      return;
    }
    const { bbox, fetchBbox } = viewportContext;
    const request = beginRefreshRequest(viewportContext.fetchKey);
    if (request === null) {
      return;
    }
    const requestContext = getViewportRequestContext();

    const result = await runEffectPromise(
      Effect.either(
        fetchFacilitiesByBboxEffect(
          {
            bbox: fetchBbox,
            limit,
            perspective,
            ...(typeof requestContext === "undefined" ? {} : { requestContext }),
          },
          request.abortController.signal
        )
      )
    );

    finishRefreshRequest(request);

    if (request.sequence !== state.requestSequence) {
      return;
    }

    if (Either.isLeft(result)) {
      if (getApiErrorReason(result.left) === "aborted") {
        recordAppPerformanceCounter("facilities.request.aborted", { perspective });
        return;
      }

      handleFailedRefreshResult({
        requestId: result.left.requestId,
        reason: getApiErrorMessage(result.left, "refresh failed"),
      });
      return;
    }

    applySuccessfulRefresh({
      bbox,
      fetchBbox,
      result: result.right,
    });
  };

  const setVisible = (visible: boolean): void => {
    if (state.visible === visible) {
      return;
    }

    state.visible = visible;
    state.requestSequence += 1;
    stressGovernor.setEnabled(visible);
    clearCachedViewport();
    state.lastFetchKey = null;
    clearScheduledLogoLoad();

    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }
    state.debounceTimer = null;
    scheduledRefreshFetchKey = null;
    abortActiveRefresh();

    if (!state.ready) {
      if (!visible) {
        state.selectedFeatureId = null;
        clearCachedViewport();
        emitSelectedFacility(null);
      }
      return;
    }

    if (!ensureFacilitiesLayers()) {
      return;
    }

    if (!visible) {
      map.setGeoJSONSourceData(sourceId, emptyFacilitiesSourceData());
      clearClusterMarkers();
      clearCachedViewport();
      clearSelection();
      emitViewportUpdate([], "n/a", false);
      setStatus({ state: "idle" });
      return;
    }

    scheduleRefresh();
  };

  map.on("load", onLoad);
  if (
    options.interactionCoordinator === null ||
    typeof options.interactionCoordinator === "undefined"
  ) {
    map.on("moveend", onMoveEnd);
  } else {
    unsubscribeInteractionCoordinator = options.interactionCoordinator.subscribe(
      (snapshot) => {
        lastInteractionSnapshot = snapshot;

        if (!shouldRefreshViewportData(snapshot)) {
          return;
        }

        if (!state.ready) {
          if (snapshot.eventType === "load") {
            pendingInitialCoordinatorRefresh = true;
          }
          return;
        }

        onMoveEnd(snapshot.interactionType);
      },
      { emitCurrent: true, priority: "critical" }
    );

    if (lastInteractionSnapshot !== null) {
      queueMicrotask(onLoad);
    }
  }
  map.onClick(onClick);

  const setViewMode = (mode: FacilitiesViewMode): void => {
    if (state.viewMode === mode) {
      return;
    }

    state.viewMode = mode;

    if (!state.ready) {
      return;
    }

    try {
      removeFacilitiesLayers();
      addSourceForMode(mode);
      addLayersForMode(mode);

      if (state.visible && state.cachedFeatures.length > 0) {
        const filtered = getFilteredCachedFeatures();
        applySourceDataIfNeeded(filtered);
        syncClusterMarkers();

        if (mode === "icons") {
          const bbox = quantizeBbox(map.getBounds(), VIEWPORT_BBOX_DECIMALS);
          const viewportFeatures = getViewportFeatures(filtered, bbox);
          applyViewportPresentation({
            bbox,
            features: viewportFeatures,
            requestId: state.lastRequestId ?? "n/a",
            truncated: state.lastTruncated,
          });
        }
      } else {
        clearClusterMarkers();
      }
    } catch {
      clearClusterMarkers();
      ensureFacilitiesLayers();
    }
  };

  const applyFilter = (): void => {
    if (!(state.ready && state.visible)) {
      return;
    }

    if (!ensureFacilitiesLayers()) {
      return;
    }

    const filtered = getFilteredCachedFeatures();
    applySourceDataIfNeeded(filtered);
    syncClusterMarkers();

    const bbox = quantizeBbox(map.getBounds(), VIEWPORT_BBOX_DECIMALS);
    const viewportFeatures = getViewportFeatures(filtered, bbox);
    applyViewportPresentation({
      bbox,
      features: viewportFeatures,
      requestId: state.lastRequestId ?? "n/a",
      truncated: state.lastTruncated,
    });
  };

  return {
    applyFilter,
    clearSelection,
    perspective,
    resolveFeatureProperties(featureId: number | string): unknown | null {
      const target = String(featureId);
      const feature = state.cachedFeatures.find((f) => String(f.id) === target);
      return feature?.properties ?? null;
    },
    setViewMode,
    setVisible,
    zoomToCluster,
    destroy(): void {
      state.requestSequence += 1;
      bboxCacheEntries = [];
      clearClusterMarkers();
      clearSelection();

      if (state.debounceTimer) {
        clearTimeout(state.debounceTimer);
      }
      state.debounceTimer = null;
      scheduledRefreshFetchKey = null;
      abortActiveRefresh();
      clearScheduledLogoLoad();
      stressGovernor.destroy();

      if (pendingClick !== null) {
        clearTimeout(pendingClick.timer);
        pendingClick = null;
      }

      map.off("load", onLoad);
      unsubscribeInteractionCoordinator?.();
      unsubscribeInteractionCoordinator = null;
      if (
        options.interactionCoordinator === null ||
        typeof options.interactionCoordinator === "undefined"
      ) {
        map.off("moveend", onMoveEnd);
      }
      map.offClick(onClick);
      map.offStyleImageMissing(handleStyleImageMissing);
    },
  };
}
