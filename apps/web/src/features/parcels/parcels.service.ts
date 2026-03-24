import type {
  StressGovernorController,
  StressGovernorOptions,
} from "@/features/parcels/parcels.service.types";
import type {
  EvaluateParcelsGuardrailsArgs,
  ParcelsGuardrailResult,
  ParcelsStatus,
} from "@/features/parcels/parcels.types";

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
    const ingestionRunSuffix =
      typeof status.ingestionRunId === "string" ? ` run=${status.ingestionRunId}` : "";
    return `${resolveGuardrailReasonLabel(status.reason)} blocked${ingestionRunSuffix}; width=${status.viewportWidthKm.toFixed(1)}km tiles=${String(status.predictedTileCount)}`;
  }

  const ingestionRunSuffix =
    typeof status.ingestionRunId === "string" ? ` run=${status.ingestionRunId}` : "";
  return `ready v${status.version}${ingestionRunSuffix}; width=${status.viewportWidthKm.toFixed(1)}km tiles=${String(status.predictedTileCount)}`;
}

export function readParcelsStatusIngestionRunId(status: ParcelsStatus): string | null {
  if (
    (status.state === "ready" || status.state === "hidden") &&
    typeof status.ingestionRunId === "string" &&
    status.ingestionRunId.trim().length > 0
  ) {
    return status.ingestionRunId;
  }

  return null;
}

function isDocumentVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

function requestNextAnimationFrame(callback: FrameRequestCallback): number {
  return typeof globalThis.requestAnimationFrame === "function"
    ? globalThis.requestAnimationFrame(callback)
    : 0;
}

function cancelScheduledAnimationFrame(handle: number): void {
  if (handle === 0 || typeof globalThis.cancelAnimationFrame !== "function") {
    return;
  }

  globalThis.cancelAnimationFrame(handle);
}

export function createStressGovernor(
  options: StressGovernorOptions = {}
): StressGovernorController {
  const frameBudgetMs = options.frameBudgetMs ?? 34;
  const sampleSize = options.sampleSize ?? 90;
  const breachRatio = options.breachRatio ?? 0.35;
  const minSampleSize = options.minSampleSize ?? Math.min(sampleSize, 24);
  const samples: number[] = [];
  let sampleTotal = 0;
  let previousFrameTime = performance.now();
  let blocked = false;
  let frameHandle = 0;
  let destroyed = false;
  let enabled = false;

  const cancelScheduledFrame = (): void => {
    if (frameHandle === 0) {
      return;
    }

    cancelScheduledAnimationFrame(frameHandle);
    frameHandle = 0;
  };

  const resetSamples = (): void => {
    samples.length = 0;
    sampleTotal = 0;
  };

  const updateBlockedState = (): void => {
    if (samples.length < minSampleSize) {
      if (blocked) {
        blocked = false;
        options.onChange?.(false);
      }
      return;
    }

    const ratio = sampleTotal / samples.length;
    const nextBlocked = ratio >= breachRatio;
    if (nextBlocked === blocked) {
      return;
    }

    blocked = nextBlocked;
    options.onChange?.(blocked);
  };

  const ensureFrameLoop = (): void => {
    if (!(enabled && frameHandle === 0 && !destroyed)) {
      return;
    }

    frameHandle = requestNextAnimationFrame(onFrame);
  };

  const onFrame = (now: number): void => {
    if (destroyed) {
      return;
    }

    frameHandle = 0;

    if (!enabled) {
      previousFrameTime = now;
      return;
    }

    if (!isDocumentVisible()) {
      resetSamples();
      previousFrameTime = now;
      if (blocked) {
        blocked = false;
        options.onChange?.(false);
      }
      ensureFrameLoop();
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
    ensureFrameLoop();
  };

  return {
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      cancelScheduledFrame();
      if (blocked) {
        blocked = false;
        options.onChange?.(false);
      }
      resetSamples();
    },
    isBlocked(): boolean {
      return blocked;
    },
    setEnabled(nextEnabled: boolean): void {
      if (enabled === nextEnabled) {
        return;
      }

      enabled = nextEnabled;
      resetSamples();
      previousFrameTime = performance.now();
      if (!enabled && blocked) {
        blocked = false;
        options.onChange?.(false);
      }

      if (!enabled) {
        cancelScheduledFrame();
        return;
      }

      ensureFrameLoop();
    },
  };
}
