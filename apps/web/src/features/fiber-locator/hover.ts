import type { FeatureStateTarget, IMap, MapPointerEvent } from "@map-migration/map-engine";
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
import { createFeatureHoverController } from "@/lib/map-feature-hover.service";
import {
  isFeatureId,
  readFeatureSource,
  readFeatureSourceLayerName,
  readFirstAvailableString,
} from "@/lib/map-feature-readers";

function normalizeSourceLayerName(value: string): string {
  return value.trim().toLowerCase();
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

  const sourceLayerName = readFeatureSourceLayerName(feature, {
    normalize: normalizeSourceLayerName,
  });
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
}): FeatureStateTarget | null {
  if (!isFeatureId(feature.id)) {
    return null;
  }

  const sourceId = readFeatureSource(feature);
  if (sourceId === null) {
    return null;
  }

  const sourceLayerName = readFeatureSourceLayerName(feature, {
    normalize: normalizeSourceLayerName,
  });
  if (sourceLayerName === null) {
    return null;
  }

  return {
    source: sourceId,
    sourceLayer: sourceLayerName,
    id: feature.id,
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
  nextTarget: FeatureStateTarget;
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
  return createFeatureHoverController(map, {
    isInteractionEnabled: options.isInteractionEnabled,
    onHoverChange: options.onHoverChange,
    resolveHoverCandidate(event: MapPointerEvent) {
      const { queryLayerIds, lineIdBySourceId } = buildHoverQueryContext(map, options);
      if (queryLayerIds.length === 0) {
        return null;
      }

      const features = map.queryRenderedFeatures(event.point, {
        layers: [...queryLayerIds],
      });
      const screenPoint: readonly [number, number] = [event.point[0], event.point[1]];
      return resolveHoverCandidate(features, screenPoint, lineIdBySourceId, options);
    },
  });
}
