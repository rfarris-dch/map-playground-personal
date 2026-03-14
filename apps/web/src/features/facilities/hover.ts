import {
  type FacilityPerspective,
  parseCommissionedSemantic,
  parseFacilityPerspective,
  parseLeaseOrOwn,
} from "@map-migration/geo-kernel";
import type { IMap, MapPointerEvent, MapRenderedFeature } from "@map-migration/map-engine";
import { isFeatureId } from "@/features/facilities/facilities.service";
import { createFacilityClusterSummary } from "@/features/facilities/facilities-cluster.service";
import type { FacilityClusterSummary } from "@/features/facilities/facilities-cluster.types";
import type {
  ClusterProviderSummary,
  FacilitiesHoverController,
  FacilitiesHoverOptions,
  FacilityClusterHoverState,
  FacilityHoverState,
} from "@/features/facilities/hover.types";
import type { HoverTarget } from "./hover.types";

function pointLayerIdForPerspective(perspective: FacilityPerspective): string {
  return `facilities.${perspective}.points`;
}

function clusterLayerIdForPerspective(perspective: FacilityPerspective): string {
  return `facilities.${perspective}.clusters`;
}

function sourceIdForPerspective(perspective: FacilityPerspective): string {
  return `facilities.${perspective}`;
}

function perspectiveForClusterLayerId(
  layerId: string,
  perspectives: readonly FacilityPerspective[]
): FacilityPerspective | null {
  for (const perspective of perspectives) {
    if (layerId === clusterLayerIdForPerspective(perspective)) {
      return perspective;
    }
  }
  return null;
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
  if (value.length === 0) {
    return null;
  }

  return value;
}

function readNullableNumberProperty(properties: unknown, key: string): number | null {
  const value = readProperty(properties, key);
  if (value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function toHoverState(
  feature: {
    id: unknown;
    properties: unknown;
  },
  screenPoint: readonly [number, number]
): FacilityHoverState | null {
  if (!isFeatureId(feature.id)) {
    return null;
  }

  const perspective = parseFacilityPerspective(
    readStringProperty(feature.properties, "perspective")
  );
  if (perspective === null) {
    return null;
  }

  const commissionedSemantic = parseCommissionedSemantic(
    readStringProperty(feature.properties, "commissionedSemantic")
  );
  if (commissionedSemantic === null) {
    return null;
  }

  const facilityId = readStringProperty(feature.properties, "facilityId") ?? String(feature.id);
  const facilityName = readStringProperty(feature.properties, "facilityName") ?? "Unknown facility";
  const providerId = readStringProperty(feature.properties, "providerId") ?? "unknown-provider";
  const providerName = readStringProperty(feature.properties, "providerName") ?? "Unknown provider";
  const leaseOrOwn = parseLeaseOrOwn(readStringProperty(feature.properties, "leaseOrOwn"));
  const commissionedPowerMw = readNullableNumberProperty(feature.properties, "commissionedPowerMw");
  const underConstructionPowerMw = readNullableNumberProperty(
    feature.properties,
    "underConstructionPowerMw"
  );
  const plannedPowerMw = readNullableNumberProperty(feature.properties, "plannedPowerMw");
  const availablePowerMw = readNullableNumberProperty(feature.properties, "availablePowerMw");
  const statusLabel = readStringProperty(feature.properties, "statusLabel");

  return {
    availablePowerMw,
    perspective,
    facilityId,
    facilityName,
    providerId,
    providerName,
    commissionedPowerMw,
    commissionedSemantic,
    leaseOrOwn,
    plannedPowerMw,
    screenPoint,
    statusLabel,
    underConstructionPowerMw,
  };
}

function aggregateClusterLeaves(
  leaves: readonly { properties: unknown }[],
  clusterSummary: FacilityClusterSummary,
  screenPoint: readonly [number, number]
): FacilityClusterHoverState {
  const providerPowerMap = new Map<string, number>();

  for (const leaf of leaves) {
    const commissioned = readNullableNumberProperty(leaf.properties, "commissionedPowerMw") ?? 0;
    const uc = readNullableNumberProperty(leaf.properties, "underConstructionPowerMw") ?? 0;
    const planned = readNullableNumberProperty(leaf.properties, "plannedPowerMw") ?? 0;

    const providerName = readStringProperty(leaf.properties, "providerName") ?? "Unknown";
    const facilityTotal = commissioned + uc + planned;
    providerPowerMap.set(providerName, (providerPowerMap.get(providerName) ?? 0) + facilityTotal);
  }

  const topProviders: ClusterProviderSummary[] = Array.from(providerPowerMap.entries())
    .map(([name, totalPowerMw]) => ({ name, totalPowerMw }))
    .sort((a, b) => b.totalPowerMw - a.totalPowerMw)
    .slice(0, 3);

  return {
    ...clusterSummary,
    topProviders,
    screenPoint,
  };
}

function readPointCenter(coordinates: unknown): readonly [number, number] | null {
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
}

export function mountFacilitiesHover(
  map: IMap,
  options: FacilitiesHoverOptions
): FacilitiesHoverController {
  const pointLayerIds = options.perspectives.map((perspective) => {
    return pointLayerIdForPerspective(perspective);
  });
  const clusterLayerIds = options.perspectives.map((perspective) => {
    return clusterLayerIdForPerspective(perspective);
  });
  let hoverTarget: HoverTarget | null = null;
  let hoveredClusterId: number | null = null;
  let clusterFetchSequence = 0;

  const queryablePointLayerIds = (): string[] => {
    return pointLayerIds.filter((layerId) => map.hasLayer(layerId));
  };

  const queryableClusterLayerIds = (): string[] => {
    return clusterLayerIds.filter((layerId) => map.hasLayer(layerId));
  };

  const clearPointHover = (): void => {
    if (hoverTarget !== null) {
      map.setFeatureState(
        {
          source: hoverTarget.sourceId,
          id: hoverTarget.featureId,
        },
        { hover: false }
      );
      hoverTarget = null;
    }

    options.onHoverChange?.(null);
  };

  const clearClusterHover = (): void => {
    hoveredClusterId = null;
    clusterFetchSequence += 1;
    options.onClusterHoverChange?.(null);
  };

  const clear = (): void => {
    clearPointHover();
    clearClusterHover();
  };

  const onPointerLeave = (): void => {
    clear();
  };

  const toScreenPoint = (event: MapPointerEvent): readonly [number, number] => {
    return [event.point[0], event.point[1]];
  };

  const isSameHoverTarget = (nextTarget: HoverTarget): boolean => {
    return (
      hoverTarget !== null &&
      hoverTarget.sourceId === nextTarget.sourceId &&
      hoverTarget.featureId === nextTarget.featureId
    );
  };

  const setPointHover = (nextTarget: HoverTarget, nextHover: FacilityHoverState): void => {
    if (isSameHoverTarget(nextTarget)) {
      options.onHoverChange?.(nextHover);
      return;
    }

    clearPointHover();
    map.setFeatureState(
      {
        source: nextTarget.sourceId,
        id: nextTarget.featureId,
      },
      { hover: true }
    );
    hoverTarget = nextTarget;
    options.onHoverChange?.(nextHover);
  };

  const handlePointPointerMove = (
    event: MapPointerEvent,
    screenPoint: readonly [number, number]
  ): void => {
    const layers = queryablePointLayerIds();
    if (layers.length === 0) {
      clearPointHover();
      return;
    }

    const features = map.queryRenderedFeatures(event.point, {
      layers,
    });

    for (const feature of features) {
      const nextHover = toHoverState(feature, screenPoint);
      if (nextHover === null || !isFeatureId(feature.id)) {
        continue;
      }

      const nextTarget: HoverTarget = {
        sourceId: sourceIdForPerspective(nextHover.perspective),
        featureId: feature.id,
      };

      setPointHover(nextTarget, nextHover);
      return;
    }

    clearPointHover();
  };

  const readClusterCenter = (
    event: MapPointerEvent,
    clusterFeature: Pick<MapRenderedFeature, "geometry">
  ): readonly [number, number] => {
    if (clusterFeature.geometry.type === "Point") {
      const center = readPointCenter(clusterFeature.geometry.coordinates);
      if (center !== null) {
        return center;
      }
    }

    return [event.lngLat.lng, event.lngLat.lat];
  };

  const emitClusterHover = (args: {
    readonly clusterFeature: Pick<MapRenderedFeature, "geometry" | "layer" | "properties">;
    readonly clusterId: number;
    readonly pointCount: number;
    readonly screenPoint: readonly [number, number];
    readonly event: MapPointerEvent;
  }): boolean => {
    const layerId = args.clusterFeature.layer?.id ?? "";
    const perspective = perspectiveForClusterLayerId(layerId, options.perspectives);
    if (perspective === null) {
      return false;
    }

    hoveredClusterId = args.clusterId;
    clusterFetchSequence += 1;
    const currentSequence = clusterFetchSequence;
    const sourceId = sourceIdForPerspective(perspective);
    const clusterCenter = readClusterCenter(args.event, args.clusterFeature);
    const clusterSummary = createFacilityClusterSummary({
      center: clusterCenter,
      clusterId: args.clusterId,
      facilityCount: args.pointCount,
      perspective,
      properties: args.clusterFeature.properties,
    });

    map
      .getClusterLeaves(sourceId, args.clusterId, args.pointCount)
      .then((leaves) => {
        if (clusterFetchSequence !== currentSequence) {
          return;
        }

        options.onClusterHoverChange?.(
          aggregateClusterLeaves(leaves, clusterSummary, args.screenPoint)
        );
      })
      .catch(() => {
        // Ignore transient cluster leaf fetch failures.
      });

    return true;
  };

  const handleClusterPointerMove = (
    event: MapPointerEvent,
    screenPoint: readonly [number, number]
  ): boolean => {
    const clusterLayers = queryableClusterLayerIds();
    if (clusterLayers.length === 0) {
      return false;
    }

    const clusterFeature = map.queryRenderedFeatures(event.point, {
      layers: clusterLayers,
    })[0];
    if (typeof clusterFeature === "undefined") {
      return false;
    }

    const clusterId = readNullableNumberProperty(clusterFeature.properties, "cluster_id");
    const pointCount = readNullableNumberProperty(clusterFeature.properties, "point_count");
    if (clusterId === null || pointCount === null) {
      return false;
    }

    if (hoverTarget !== null) {
      clearPointHover();
    }

    if (hoveredClusterId === clusterId) {
      return true;
    }

    return emitClusterHover({
      clusterFeature,
      clusterId,
      pointCount,
      screenPoint,
      event,
    });
  };

  const onPointerMove = (event: MapPointerEvent): void => {
    if (!(options.isInteractionEnabled?.() ?? true) || event.buttons > 0) {
      clear();
      return;
    }

    const screenPoint = toScreenPoint(event);
    if (handleClusterPointerMove(event, screenPoint)) {
      return;
    }

    if (hoveredClusterId !== null) {
      clearClusterHover();
    }

    handlePointPointerMove(event, screenPoint);
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
