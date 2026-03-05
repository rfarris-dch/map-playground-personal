import { parseTilePublishManifest } from "@map-migration/geo-tiles";
import type {
  EvaluateParcelsGuardrailsArgs,
  LoadParcelsManifestArgs,
  ParcelsGuardrailResult,
  ParcelsStatus,
  TilePublishManifest,
} from "@/features/parcels/parcels.types";
import type { StressGovernorController, StressGovernorOptions } from "./parcels.service.types";

function normalizeManifestPath(manifestPath: string): string {
  if (manifestPath.startsWith("http://") || manifestPath.startsWith("https://")) {
    return manifestPath;
  }

  if (manifestPath.startsWith("/")) {
    return manifestPath;
  }

  return `/${manifestPath}`;
}

function normalizePmtilesAssetUrl(assetUrl: string): string {
  if (assetUrl.startsWith("http://") || assetUrl.startsWith("https://")) {
    return assetUrl;
  }

  const normalizedPath = assetUrl.startsWith("/") ? assetUrl : `/${assetUrl}`;
  return `${window.location.origin}${normalizedPath}`;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(latA: number, lonA: number, latB: number, lonB: number): number {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(latB - latA);
  const deltaLon = toRadians(lonB - lonA);
  const latARadians = toRadians(latA);
  const latBRadians = toRadians(latB);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const a = sinLat * sinLat + Math.cos(latARadians) * Math.cos(latBRadians) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }

  return value;
}

function longitudeToTileX(longitude: number, zoom: number): number {
  const tileCount = 2 ** zoom;
  return ((longitude + 180) / 360) * tileCount;
}

function latitudeToTileY(latitude: number, zoom: number): number {
  const tileCount = 2 ** zoom;
  const radians = toRadians(clamp(latitude, -85.051_128_78, 85.051_128_78));
  const n = Math.log(Math.tan(Math.PI / 4 + radians / 2));
  return ((1 - n / Math.PI) / 2) * tileCount;
}

function normalizeEastLongitude(west: number, east: number): number {
  if (east >= west) {
    return east;
  }

  return east + 360;
}

export async function loadParcelsManifest(
  args: LoadParcelsManifestArgs
): Promise<TilePublishManifest> {
  const manifestPath = normalizeManifestPath(args.manifestPath);
  const requestInit: RequestInit = {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  };
  if (args.signal) {
    requestInit.signal = args.signal;
  }

  const response = await fetch(manifestPath, requestInit);

  if (!response.ok) {
    throw new Error(`Failed to load parcels manifest (${response.status} ${response.statusText})`);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Failed to parse parcels manifest JSON");
  }

  return parseTilePublishManifest(payload);
}

export function createPmtilesSourceUrl(manifest: TilePublishManifest): string {
  const absoluteAssetUrl = normalizePmtilesAssetUrl(manifest.current.url);
  return `pmtiles://${absoluteAssetUrl}`;
}

function estimateViewportWidthKm(bounds: {
  readonly east: number;
  readonly north: number;
  readonly south: number;
  readonly west: number;
}): number {
  const midpointLatitude = (bounds.north + bounds.south) / 2;
  const eastLongitude = normalizeEastLongitude(bounds.west, bounds.east);
  return haversineDistanceKm(midpointLatitude, bounds.west, midpointLatitude, eastLongitude);
}

function predictTileCount(
  bounds: {
    readonly east: number;
    readonly north: number;
    readonly south: number;
    readonly west: number;
  },
  zoom: number,
  maxTilePredictionZoom: number
): number {
  const tileZoom = clamp(Math.floor(zoom), 0, Math.max(0, Math.floor(maxTilePredictionZoom)));
  const tileCount = 2 ** tileZoom;

  const eastLongitude = normalizeEastLongitude(bounds.west, bounds.east);
  const rawMinX = longitudeToTileX(bounds.west, tileZoom);
  const rawMaxX = longitudeToTileX(eastLongitude, tileZoom);
  const rawMinY = latitudeToTileY(bounds.north, tileZoom);
  const rawMaxY = latitudeToTileY(bounds.south, tileZoom);

  const minX = Math.floor(clamp(Math.min(rawMinX, rawMaxX), 0, tileCount - 1));
  const maxX = Math.floor(clamp(Math.max(rawMinX, rawMaxX), 0, tileCount - 1));
  const minY = Math.floor(clamp(Math.min(rawMinY, rawMaxY), 0, tileCount - 1));
  const maxY = Math.floor(clamp(Math.max(rawMinY, rawMaxY), 0, tileCount - 1));

  const xTiles = Math.max(1, maxX - minX + 1);
  const yTiles = Math.max(1, maxY - minY + 1);
  return xTiles * yTiles;
}

export function evaluateParcelsGuardrails(
  args: EvaluateParcelsGuardrailsArgs
): ParcelsGuardrailResult {
  const viewportWidthKm = estimateViewportWidthKm(args.bounds);
  const predictedTileCount = predictTileCount(args.bounds, args.zoom, args.maxTilePredictionZoom);

  if (args.isStressBlocked) {
    return {
      blocked: true,
      reason: "stress",
      viewportWidthKm,
      predictedTileCount,
    };
  }

  if (viewportWidthKm > args.maxViewportWidthKm) {
    return {
      blocked: true,
      reason: "viewport-span",
      viewportWidthKm,
      predictedTileCount,
    };
  }

  if (predictedTileCount > args.maxPredictedTiles) {
    return {
      blocked: true,
      reason: "tile-cap",
      viewportWidthKm,
      predictedTileCount,
    };
  }

  return {
    blocked: false,
    reason: null,
    viewportWidthKm,
    predictedTileCount,
  };
}

function resolveGuardrailReasonLabel(reason: ParcelsGuardrailResult["reason"]): string {
  if (reason === "stress") {
    return "stress governor";
  }
  if (reason === "tile-cap") {
    return "tile cap";
  }
  if (reason === "viewport-span") {
    return "viewport span";
  }

  return "unknown";
}

export function formatParcelsStatus(status: ParcelsStatus): string {
  if (status.state === "idle") {
    return "idle";
  }
  if (status.state === "loading-manifest") {
    return "loading manifest";
  }
  if (status.state === "error") {
    return `error: ${status.reason}`;
  }
  if (status.state === "hidden") {
    return `${resolveGuardrailReasonLabel(status.reason)} blocked; width=${status.viewportWidthKm.toFixed(1)}km tiles=${String(status.predictedTileCount)}`;
  }

  const ingestionRunSuffix =
    typeof status.ingestionRunId === "string" ? ` run=${status.ingestionRunId}` : "";
  return `ready v${status.version}${ingestionRunSuffix}; width=${status.viewportWidthKm.toFixed(1)}km tiles=${String(status.predictedTileCount)}`;
}

export function createStressGovernor(
  options: StressGovernorOptions = {}
): StressGovernorController {
  const frameBudgetMs = options.frameBudgetMs ?? 34;
  const sampleSize = options.sampleSize ?? 90;
  const breachRatio = options.breachRatio ?? 0.35;
  const samples: number[] = [];
  let sampleTotal = 0;
  let previousFrameTime = performance.now();
  let blocked = false;
  let frameHandle = 0;
  let destroyed = false;

  const updateBlockedState = (): void => {
    const ratio = samples.length === 0 ? 0 : sampleTotal / samples.length;
    const nextBlocked = ratio >= breachRatio;
    if (nextBlocked === blocked) {
      return;
    }

    blocked = nextBlocked;
    options.onChange?.(blocked);
  };

  const onFrame = (now: number): void => {
    if (destroyed) {
      return;
    }

    if (document.visibilityState !== "visible") {
      samples.length = 0;
      sampleTotal = 0;
      previousFrameTime = now;
      if (blocked) {
        blocked = false;
        options.onChange?.(false);
      }
      frameHandle = window.requestAnimationFrame(onFrame);
      return;
    }

    const delta = now - previousFrameTime;
    previousFrameTime = now;
    const sample = delta > frameBudgetMs ? 1 : 0;
    samples.push(sample);
    sampleTotal += sample;
    if (samples.length > sampleSize) {
      const removed = samples.shift();
      if (typeof removed === "number") {
        sampleTotal -= removed;
      }
    }

    updateBlockedState();
    frameHandle = window.requestAnimationFrame(onFrame);
  };

  frameHandle = window.requestAnimationFrame(onFrame);

  return {
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      window.cancelAnimationFrame(frameHandle);
      if (blocked) {
        blocked = false;
        options.onChange?.(false);
      }
      samples.length = 0;
      sampleTotal = 0;
    },
    isBlocked(): boolean {
      return blocked;
    },
  };
}
