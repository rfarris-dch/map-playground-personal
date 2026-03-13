import type { IMap, MapPointerEvent } from "@map-migration/map-engine";
import { fiberLocatorLineLabel } from "@/features/fiber-locator/fiber-locator.service";
import type {
  FiberLocatorLineId,
  FiberLocatorSourceLayerOption,
} from "@/features/fiber-locator/fiber-locator.types";
import type {
  FiberLocatorHoverController,
  FiberLocatorHoverOptions,
  FiberLocatorHoverState,
} from "@/features/fiber-locator/hover.types";
import type { HoverTarget } from "./hover.types";

function isFeatureId(value: unknown): value is number | string {
  return typeof value === "number" || typeof value === "string";
}

function readProperty(properties: unknown, key: string): unknown {
  if (typeof properties !== "object" || properties === null) {
    return null;
  }

  return Reflect.get(properties, key);
}

function readStringProperty(properties: unknown, key: string): string | null {
  const value = readProperty(properties, key);
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function readFeatureSource(feature: { source?: unknown }): string | null {
  if (typeof feature.source !== "string") {
    return null;
  }

  const normalized = feature.source.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function normalizeSourceLayerName(value: string): string {
  return value.trim().toLowerCase();
}

function readFeatureSourceLayerName(feature: {
  properties?: unknown;
  sourceLayer?: unknown;
}): string | null {
  if (typeof feature.sourceLayer === "string") {
    const normalized = normalizeSourceLayerName(feature.sourceLayer);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  const layerNameFromProperties = readStringProperty(feature.properties, "layer_name");
  if (layerNameFromProperties !== null) {
    const normalized = normalizeSourceLayerName(layerNameFromProperties);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return null;
}

function readFirstAvailableString(properties: unknown, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = readStringProperty(properties, key);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function resolveSourceLayerLabel(
  sourceLayerName: string,
  sourceLayerOptions: readonly FiberLocatorSourceLayerOption[]
): string {
  const normalizedSourceLayerName = normalizeSourceLayerName(sourceLayerName);
  for (const sourceLayerOption of sourceLayerOptions) {
    if (normalizeSourceLayerName(sourceLayerOption.layerName) === normalizedSourceLayerName) {
      return sourceLayerOption.label;
    }
  }

  return sourceLayerName;
}

function toHoverState(
  feature: {
    id: unknown;
    properties?: unknown;
    source?: unknown;
    sourceLayer?: unknown;
  },
  screenPoint: readonly [number, number],
  lineIdBySourceId: ReadonlyMap<string, FiberLocatorLineId>,
  options: FiberLocatorHoverOptions
): FiberLocatorHoverState | null {
  if (!isFeatureId(feature.id)) {
    return null;
  }

  const sourceId = readFeatureSource(feature);
  if (sourceId === null) {
    return null;
  }

  const lineId = lineIdBySourceId.get(sourceId);
  if (typeof lineId === "undefined") {
    return null;
  }

  const sourceLayerName = readFeatureSourceLayerName(feature);
  if (sourceLayerName === null) {
    return null;
  }

  const sourceLayerLabel = resolveSourceLayerLabel(
    sourceLayerName,
    options.getSourceLayerOptions(lineId)
  );

  const segmentName = readFirstAvailableString(feature.properties, [
    "line_name",
    "segment_name",
    "segment",
    "name",
    "common_name",
  ]);
  const operatorName = readFirstAvailableString(feature.properties, [
    "owner",
    "operator",
    "provider",
    "carrier",
    "network_operator",
  ]);
  const status = readFirstAvailableString(feature.properties, [
    "status",
    "state",
    "operational_status",
  ]);

  return {
    featureId: feature.id,
    lineId,
    lineLabel: fiberLocatorLineLabel(lineId),
    operatorName,
    screenPoint,
    segmentName,
    sourceLayerLabel,
    sourceLayerName,
    status,
  };
}

function toFeatureStateTarget(target: HoverTarget): {
  id: number | string;
  source: string;
  sourceLayer: string;
} {
  return {
    source: target.sourceId,
    sourceLayer: target.sourceLayerName,
    id: target.featureId,
  };
}

function isSameHoverTarget(left: HoverTarget | null, right: HoverTarget): boolean {
  if (left === null) {
    return false;
  }

  return (
    left.sourceId === right.sourceId &&
    left.sourceLayerName === right.sourceLayerName &&
    left.featureId === right.featureId
  );
}

function buildHoverQueryContext(
  map: IMap,
  options: FiberLocatorHoverOptions
): {
  lineIdBySourceId: ReadonlyMap<string, FiberLocatorLineId>;
  queryLayerIds: readonly string[];
} {
  const queryLayerIds = new Set<string>();
  const lineIdBySourceId = new Map<string, FiberLocatorLineId>();

  for (const controller of options.getControllers()) {
    lineIdBySourceId.set(controller.getSourceId(), controller.lineId);
    for (const layerId of controller.getLayerIds()) {
      if (map.hasLayer(layerId)) {
        queryLayerIds.add(layerId);
      }
    }
  }

  return {
    lineIdBySourceId,
    queryLayerIds: [...queryLayerIds],
  };
}

function toHoverTarget(feature: {
  id: unknown;
  source?: unknown;
  sourceLayer?: unknown;
  properties?: unknown;
}): HoverTarget | null {
  if (!isFeatureId(feature.id)) {
    return null;
  }

  const sourceId = readFeatureSource(feature);
  if (sourceId === null) {
    return null;
  }

  const sourceLayerName = readFeatureSourceLayerName(feature);
  if (sourceLayerName === null) {
    return null;
  }

  return {
    sourceId,
    sourceLayerName,
    featureId: feature.id,
  };
}

function resolveHoverCandidate(
  features: readonly {
    id: unknown;
    properties?: unknown;
    source?: unknown;
    sourceLayer?: unknown;
  }[],
  screenPoint: readonly [number, number],
  lineIdBySourceId: ReadonlyMap<string, FiberLocatorLineId>,
  options: FiberLocatorHoverOptions
): {
  nextHover: FiberLocatorHoverState;
  nextTarget: HoverTarget;
} | null {
  for (const feature of features) {
    const nextHover = toHoverState(feature, screenPoint, lineIdBySourceId, options);
    if (nextHover === null) {
      continue;
    }

    const nextTarget = toHoverTarget(feature);
    if (nextTarget === null) {
      continue;
    }

    return {
      nextHover,
      nextTarget,
    };
  }

  return null;
}

export function mountFiberLocatorHover(
  map: IMap,
  options: FiberLocatorHoverOptions
): FiberLocatorHoverController {
  let hoverTarget: HoverTarget | null = null;

  const clear = (): void => {
    if (hoverTarget !== null) {
      map.setFeatureState(toFeatureStateTarget(hoverTarget), { hover: false });
      hoverTarget = null;
    }

    options.onHoverChange?.(null);
  };

  const onPointerLeave = (): void => {
    clear();
  };

  const onPointerMove = (event: MapPointerEvent): void => {
    if (!(options.isInteractionEnabled?.() ?? true)) {
      clear();
      return;
    }

    if (event.buttons > 0) {
      clear();
      return;
    }

    const { queryLayerIds, lineIdBySourceId } = buildHoverQueryContext(map, options);

    if (queryLayerIds.length === 0) {
      clear();
      return;
    }

    const features = map.queryRenderedFeatures(event.point, {
      layers: [...queryLayerIds],
    });

    const screenPoint: readonly [number, number] = [event.point[0], event.point[1]];
    const candidate = resolveHoverCandidate(features, screenPoint, lineIdBySourceId, options);
    if (candidate === null) {
      clear();
      return;
    }

    if (isSameHoverTarget(hoverTarget, candidate.nextTarget)) {
      options.onHoverChange?.(candidate.nextHover);
      return;
    }

    clear();
    map.setFeatureState(toFeatureStateTarget(candidate.nextTarget), { hover: true });
    hoverTarget = candidate.nextTarget;
    options.onHoverChange?.(candidate.nextHover);
  };

  map.onPointerMove(onPointerMove);
  map.onPointerLeave(onPointerLeave);

  return {
    clear,
    destroy(): void {
      clear();
      map.offPointerMove(onPointerMove);
      map.offPointerLeave(onPointerLeave);
    },
  };
}
