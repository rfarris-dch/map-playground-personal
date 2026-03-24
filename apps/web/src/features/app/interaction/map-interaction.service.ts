import type { BBox } from "@map-migration/geo-kernel/geometry";
import type { IMap } from "@map-migration/map-engine";
import { openAppPerformanceLongTaskWindow } from "@/features/app/diagnostics/app-performance.service";
import type {
  MapInteractionCoordinator,
  MapInteractionEventType,
  MapInteractionListener,
  MapInteractionSnapshot,
  MapInteractionSubscribeOptions,
  MapInteractionTaskPriority,
  MapInteractionType,
} from "@/features/app/interaction/map-interaction.types";
import { shouldRefreshViewportData } from "@/features/app/interaction/map-interaction-policy.service";

const BBOX_DECIMALS = 2;
const ZOOM_BUCKET_SCALE = 2;
const ROTATION_DECIMALS = 1;
const ZOOM_DELTA_EPSILON = 0.01;
const ROTATION_DELTA_EPSILON = 0.5;
const BACKGROUND_TASK_DELAY_MS = 0;
const IDLE_TASK_TIMEOUT_MS = 200;
const LONG_TASK_WINDOW_MS = 2000;

interface ScheduledListenerEntry {
  idleCallbackId: number | null;
  idleTimeoutId: ReturnType<typeof setTimeout> | null;
  readonly listener: MapInteractionListener;
  readonly priority: MapInteractionTaskPriority;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

function hasIdleCallbackSupport(currentWindow: Window): currentWindow is Window & {
  cancelIdleCallback: (handle: number) => void;
  requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
} {
  return (
    typeof currentWindow.requestIdleCallback === "function" &&
    typeof currentWindow.cancelIdleCallback === "function"
  );
}

function cancelScheduledDelivery(entry: ScheduledListenerEntry): void {
  if (entry.timeoutId !== null) {
    globalThis.clearTimeout(entry.timeoutId);
    entry.timeoutId = null;
  }

  if (entry.idleTimeoutId !== null) {
    globalThis.clearTimeout(entry.idleTimeoutId);
    entry.idleTimeoutId = null;
  }

  if (entry.idleCallbackId === null || typeof window === "undefined") {
    entry.idleCallbackId = null;
    return;
  }

  if (hasIdleCallbackSupport(window)) {
    window.cancelIdleCallback(entry.idleCallbackId);
  }
  entry.idleCallbackId = null;
}

function scheduleListenerDelivery(
  entry: ScheduledListenerEntry,
  snapshot: MapInteractionSnapshot,
  isActive: () => boolean
): void {
  cancelScheduledDelivery(entry);

  const deliver = (): void => {
    entry.timeoutId = null;
    entry.idleTimeoutId = null;
    entry.idleCallbackId = null;

    if (!isActive()) {
      return;
    }

    entry.listener(snapshot);
  };

  if (entry.priority === "critical") {
    deliver();
    return;
  }

  if (entry.priority === "background") {
    entry.timeoutId = globalThis.setTimeout(deliver, BACKGROUND_TASK_DELAY_MS);
    return;
  }

  if (typeof window !== "undefined" && hasIdleCallbackSupport(window)) {
    entry.idleCallbackId = window.requestIdleCallback(
      () => {
        deliver();
      },
      { timeout: IDLE_TASK_TIMEOUT_MS }
    );
    return;
  }

  entry.idleTimeoutId = globalThis.setTimeout(deliver, IDLE_TASK_TIMEOUT_MS);
}

function quantizeValue(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function quantizeBbox(bounds: BBox): BBox {
  return {
    east: quantizeValue(bounds.east, BBOX_DECIMALS),
    north: quantizeValue(bounds.north, BBOX_DECIMALS),
    south: quantizeValue(bounds.south, BBOX_DECIMALS),
    west: quantizeValue(bounds.west, BBOX_DECIMALS),
  };
}

function buildCanonicalViewportKey(args: {
  readonly bearing: number;
  readonly bbox: BBox;
  readonly pitch: number;
  readonly zoomBucket: number;
}): string {
  return [
    args.bbox.west,
    args.bbox.south,
    args.bbox.east,
    args.bbox.north,
    args.zoomBucket,
    args.bearing,
    args.pitch,
  ].join(",");
}

function classifyInteractionType(args: {
  readonly previous: MapInteractionSnapshot | null;
  readonly quantizedBbox: BBox;
  readonly zoom: number;
  readonly bearing: number;
  readonly pitch: number;
}): MapInteractionType {
  if (args.previous === null) {
    return "initial";
  }

  const zoomDelta = Math.abs(args.zoom - args.previous.zoom);
  if (zoomDelta >= ZOOM_DELTA_EPSILON) {
    return "zoom";
  }

  const bboxChanged =
    args.quantizedBbox.west !== args.previous.quantizedBbox.west ||
    args.quantizedBbox.south !== args.previous.quantizedBbox.south ||
    args.quantizedBbox.east !== args.previous.quantizedBbox.east ||
    args.quantizedBbox.north !== args.previous.quantizedBbox.north;

  const bearingDelta = Math.abs(args.bearing - args.previous.bearing);
  const pitchDelta = Math.abs(args.pitch - args.previous.pitch);
  if (
    !bboxChanged &&
    (bearingDelta >= ROTATION_DELTA_EPSILON || pitchDelta >= ROTATION_DELTA_EPSILON)
  ) {
    return "rotate-only";
  }

  return "pan";
}

function createSnapshot(
  map: IMap,
  eventType: MapInteractionEventType,
  previous: MapInteractionSnapshot | null
): MapInteractionSnapshot {
  const quantizedBounds = quantizeBbox(map.getBounds());
  const zoom = map.getZoom();
  const zoomBucket = Math.round(zoom * ZOOM_BUCKET_SCALE) / ZOOM_BUCKET_SCALE;
  const bearing = quantizeValue(map.getBearing(), ROTATION_DECIMALS);
  const pitch = quantizeValue(map.getPitch(), ROTATION_DECIMALS);

  return {
    bearing,
    bearingDelta: previous === null ? 0 : bearing - previous.bearing,
    canonicalViewportKey: buildCanonicalViewportKey({
      bearing,
      bbox: quantizedBounds,
      pitch,
      zoomBucket,
    }),
    eventType,
    interactionType: classifyInteractionType({
      previous,
      quantizedBbox: quantizedBounds,
      zoom,
      bearing,
      pitch,
    }),
    pitch,
    pitchDelta: previous === null ? 0 : pitch - previous.pitch,
    quantizedBbox: quantizedBounds,
    zoom,
    zoomBucket,
    zoomDelta: previous === null ? 0 : zoom - previous.zoom,
  };
}

function isDuplicateMoveEndSnapshot(
  previous: MapInteractionSnapshot | null,
  next: MapInteractionSnapshot
): boolean {
  if (previous === null || next.eventType !== "moveend") {
    return false;
  }

  return next.canonicalViewportKey === previous.canonicalViewportKey;
}

export function createMapInteractionCoordinator(map: IMap): MapInteractionCoordinator {
  const listeners = new Set<ScheduledListenerEntry>();
  let destroyed = false;
  let lastSnapshot: MapInteractionSnapshot | null = null;

  const emitSnapshot = (eventType: MapInteractionEventType): void => {
    if (destroyed) {
      return;
    }

    const nextSnapshot = createSnapshot(map, eventType, lastSnapshot);
    if (isDuplicateMoveEndSnapshot(lastSnapshot, nextSnapshot)) {
      return;
    }

    lastSnapshot = nextSnapshot;

    if (shouldRefreshViewportData(nextSnapshot)) {
      openAppPerformanceLongTaskWindow(
        {
          interactionType: nextSnapshot.interactionType,
          viewportKey: nextSnapshot.canonicalViewportKey,
          zoomBucket: nextSnapshot.zoomBucket,
        },
        LONG_TASK_WINDOW_MS
      );
    }

    for (const entry of listeners) {
      scheduleListenerDelivery(entry, nextSnapshot, () => !destroyed && listeners.has(entry));
    }
  };

  const onLoad = (): void => {
    emitSnapshot("load");
  };

  const onMoveEnd = (): void => {
    emitSnapshot("moveend");
  };

  map.on("load", onLoad);
  map.on("moveend", onMoveEnd);

  return {
    destroy(): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      for (const entry of listeners) {
        cancelScheduledDelivery(entry);
      }
      listeners.clear();
      map.off("load", onLoad);
      map.off("moveend", onMoveEnd);
    },
    getLastSnapshot(): MapInteractionSnapshot | null {
      return lastSnapshot;
    },
    subscribe(
      listener: MapInteractionListener,
      options: MapInteractionSubscribeOptions = {}
    ): () => void {
      if (destroyed) {
        return () => undefined;
      }

      const entry: ScheduledListenerEntry = {
        listener,
        priority: options.priority ?? "critical",
        idleCallbackId: null,
        idleTimeoutId: null,
        timeoutId: null,
      };

      listeners.add(entry);
      if (options.emitCurrent && lastSnapshot !== null) {
        scheduleListenerDelivery(entry, lastSnapshot, () => !destroyed && listeners.has(entry));
      }

      return () => {
        cancelScheduledDelivery(entry);
        listeners.delete(entry);
      };
    },
  };
}
