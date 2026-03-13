import {
  type FacilityPerspective,
  parseCommissionedSemantic,
  parseFacilityPerspective,
  parseLeaseOrOwn,
} from "@map-migration/contracts";
import type { IMap, MapPointerEvent } from "@map-migration/map-engine";
import { isFeatureId } from "@/features/facilities/facilities.service";
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

  return {
    perspective,
    facilityId,
    facilityName,
    providerId,
    providerName,
    commissionedPowerMw,
    commissionedSemantic,
    leaseOrOwn,
    screenPoint,
  };
}

function aggregateClusterLeaves(
  leaves: readonly { properties: unknown }[],
  perspective: FacilityPerspective,
  clusterId: number,
  screenPoint: readonly [number, number]
): FacilityClusterHoverState {
  let commissionedPowerMw = 0;
  let underConstructionPowerMw = 0;
  let plannedPowerMw = 0;

  const providerPowerMap = new Map<string, number>();

  for (const leaf of leaves) {
    const commissioned = readNullableNumberProperty(leaf.properties, "commissionedPowerMw") ?? 0;
    const uc = readNullableNumberProperty(leaf.properties, "underConstructionPowerMw") ?? 0;
    const planned = readNullableNumberProperty(leaf.properties, "plannedPowerMw") ?? 0;

    commissionedPowerMw += commissioned;
    underConstructionPowerMw += uc;
    plannedPowerMw += planned;

    const providerName = readStringProperty(leaf.properties, "providerName") ?? "Unknown";
    const facilityTotal = commissioned + uc + planned;
    providerPowerMap.set(providerName, (providerPowerMap.get(providerName) ?? 0) + facilityTotal);
  }

  const topProviders: ClusterProviderSummary[] = Array.from(providerPowerMap.entries())
    .map(([name, totalPowerMw]) => ({ name, totalPowerMw }))
    .sort((a, b) => b.totalPowerMw - a.totalPowerMw)
    .slice(0, 3);

  const totalPowerMw = commissionedPowerMw + underConstructionPowerMw + plannedPowerMw;

  return {
    perspective,
    facilityCount: leaves.length,
    commissionedPowerMw,
    underConstructionPowerMw,
    plannedPowerMw,
    totalPowerMw,
    topProviders,
    clusterId,
    screenPoint,
  };
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

  const onPointerMove = (event: MapPointerEvent): void => {
    if (!(options.isInteractionEnabled?.() ?? true)) {
      clear();
      return;
    }

    if (event.buttons > 0) {
      clear();
      return;
    }

    const screenPoint: readonly [number, number] = [event.point[0], event.point[1]];

    // Check cluster layers first
    const clusterLayers = queryableClusterLayerIds();
    if (clusterLayers.length > 0) {
      const clusterFeatures = map.queryRenderedFeatures(event.point, {
        layers: clusterLayers,
      });

      if (clusterFeatures.length > 0) {
        const clusterFeature = clusterFeatures[0];
        const clusterId = readNullableNumberProperty(clusterFeature.properties, "cluster_id");
        const pointCount = readNullableNumberProperty(clusterFeature.properties, "point_count");
        const layerId = clusterFeature.layer?.id ?? "";

        if (clusterId !== null && pointCount !== null) {
          // Clear point hover if active
          if (hoverTarget !== null) {
            clearPointHover();
          }

          // If already hovering this cluster, just update screen point
          if (hoveredClusterId === clusterId) {
            return;
          }

          hoveredClusterId = clusterId;
          clusterFetchSequence += 1;
          const currentSequence = clusterFetchSequence;

          const perspective = perspectiveForClusterLayerId(layerId, options.perspectives);
          if (perspective === null) {
            return;
          }

          const sourceId = sourceIdForPerspective(perspective);
          const leafLimit = Math.min(pointCount, 100);

          map
            .getClusterLeaves(sourceId, clusterId, leafLimit)
            .then((leaves) => {
              if (clusterFetchSequence !== currentSequence) {
                return;
              }

              const clusterState = aggregateClusterLeaves(
                leaves,
                perspective,
                clusterId,
                screenPoint
              );
              options.onClusterHoverChange?.(clusterState);
            })
            .catch(() => {
              // Silently ignore fetch failures
            });

          return;
        }
      }
    }

    // Clear cluster hover if we moved off a cluster
    if (hoveredClusterId !== null) {
      clearClusterHover();
    }

    // Check point layers
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

      const nextSourceId = sourceIdForPerspective(nextHover.perspective);
      const nextTarget: HoverTarget = {
        sourceId: nextSourceId,
        featureId: feature.id,
      };

      if (
        hoverTarget !== null &&
        hoverTarget.sourceId === nextTarget.sourceId &&
        hoverTarget.featureId === nextTarget.featureId
      ) {
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
      return;
    }

    clearPointHover();
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
