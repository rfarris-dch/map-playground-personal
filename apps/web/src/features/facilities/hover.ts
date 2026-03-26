import {
  parseCommissionedSemantic,
  parseLeaseOrOwn,
} from "@map-migration/geo-kernel/commissioned-semantic";
import {
  type FacilityPerspective,
  parseFacilityPerspective,
} from "@map-migration/geo-kernel/facility-perspective";
import type { IMap, MapPointerEvent, MapRenderedFeature } from "@map-migration/map-engine";
import { createFacilityClusterSummary } from "@/features/facilities/facilities-cluster.service";
import type { FacilityClusterSummary } from "@/features/facilities/facilities-cluster.types";
import type {
  ClusterFacilityRow,
  ClusterProviderSummary,
  FacilitiesHoverController,
  FacilitiesHoverOptions,
  FacilityClusterHoverState,
  FacilityHoverState,
} from "@/features/facilities/hover.types";
import { createFeatureHoverController } from "@/lib/map-feature-hover.service";
import {
  isFeatureId,
  readNullableNumberProperty,
  readPointCenter,
  readStringProperty,
} from "@/lib/map-feature-readers";

function pointLayerIdForPerspective(perspective: FacilityPerspective): string {
  return `facilities.${perspective}.points`;
}

function iconFallbackLayerIdForPerspective(perspective: FacilityPerspective): string {
  return `facilities.${perspective}.icon-fallback`;
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

function toFacilityHoverState(
  feature: {
    id: unknown;
    geometry?: { type: string; coordinates: unknown };
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
  const facilityCode = readStringProperty(feature.properties, "facilityCode");
  const address = readStringProperty(feature.properties, "address");
  const city = readStringProperty(feature.properties, "city");
  const stateAbbrev = readStringProperty(feature.properties, "stateAbbrev");
  const marketName = readStringProperty(feature.properties, "marketName");

  const coordinates: readonly [number, number] | null =
    feature.geometry?.type === "Point" ? readPointCenter(feature.geometry.coordinates) : null;

  return {
    address,
    availablePowerMw,
    city,
    coordinates,
    facilityCode,
    perspective,
    facilityId,
    facilityName,
    marketName,
    providerId,
    providerName,
    commissionedPowerMw,
    commissionedSemantic,
    leaseOrOwn,
    plannedPowerMw,
    screenPoint,
    stateAbbrev,
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
  const facilities: ClusterFacilityRow[] = [];

  for (const leaf of leaves) {
    const commissioned = readNullableNumberProperty(leaf.properties, "commissionedPowerMw") ?? 0;
    const uc = readNullableNumberProperty(leaf.properties, "underConstructionPowerMw") ?? 0;
    const planned = readNullableNumberProperty(leaf.properties, "plannedPowerMw") ?? 0;

    const providerName = readStringProperty(leaf.properties, "providerName") ?? "Unknown";
    const facilityName = readStringProperty(leaf.properties, "facilityName") ?? "Unknown facility";
    const statusLabel = readStringProperty(leaf.properties, "statusLabel");
    const facilityTotal = commissioned + uc + planned;
    providerPowerMap.set(providerName, (providerPowerMap.get(providerName) ?? 0) + facilityTotal);

    facilities.push({
      facilityName,
      providerName,
      commissionedPowerMw: commissioned,
      underConstructionPowerMw: uc,
      plannedPowerMw: planned,
      statusLabel,
    });
  }

  facilities.sort(
    (a, b) =>
      b.commissionedPowerMw +
      b.underConstructionPowerMw +
      b.plannedPowerMw -
      (a.commissionedPowerMw + a.underConstructionPowerMw + a.plannedPowerMw)
  );

  const topProviders: ClusterProviderSummary[] = Array.from(providerPowerMap.entries())
    .map(([name, totalPowerMw]) => ({ name, totalPowerMw }))
    .sort((a, b) => b.totalPowerMw - a.totalPowerMw)
    .slice(0, 3);

  return {
    ...clusterSummary,
    facilities,
    topProviders,
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
  const iconFallbackLayerIds = options.perspectives.map((perspective) => {
    return iconFallbackLayerIdForPerspective(perspective);
  });
  const clusterLayerIds = options.perspectives.map((perspective) => {
    return clusterLayerIdForPerspective(perspective);
  });
  let hoveredClusterId: number | null = null;
  let clusterFetchSequence = 0;

  const VORONOI_FILL_LAYER_ID = "hyperscale-leased-voronoi.fill";

  const queryablePointLayerIds = (): string[] => {
    const layers = pointLayerIds.filter((layerId) => map.hasLayer(layerId));
    for (const fallbackId of iconFallbackLayerIds) {
      if (map.hasLayer(fallbackId)) {
        layers.push(fallbackId);
      }
    }
    if (map.hasLayer(VORONOI_FILL_LAYER_ID)) {
      layers.push(VORONOI_FILL_LAYER_ID);
    }
    return layers;
  };

  const queryableClusterLayerIds = (): string[] => {
    return clusterLayerIds.filter((layerId) => map.hasLayer(layerId));
  };

  const clearClusterHover = (): void => {
    hoveredClusterId = null;
    clusterFetchSequence += 1;
    options.onClusterHoverChange?.(null);
  };

  const toScreenPoint = (event: MapPointerEvent): readonly [number, number] => {
    return [event.point[0], event.point[1]];
  };
  const pointHoverController = createFeatureHoverController(map, {
    autoBind: false,
    isInteractionEnabled: options.isInteractionEnabled,
    onHoverChange: options.onHoverChange,
    resolveHoverCandidate(event) {
      const layers = queryablePointLayerIds();
      if (layers.length === 0) {
        return null;
      }

      const features = map.queryRenderedFeatures(event.point, {
        layers,
      });
      const screenPoint = toScreenPoint(event);

      for (const feature of features) {
        if (!isFeatureId(feature.id)) {
          continue;
        }
        const cachedProperties = options.resolveFeatureProperties?.(feature.id) ?? null;
        const properties = cachedProperties ?? feature.properties;
        const geom = feature.geometry;
        const hoverFeature =
          geom.type === "GeometryCollection"
            ? { id: feature.id, properties }
            : {
                id: feature.id,
                geometry: { type: geom.type, coordinates: geom.coordinates },
                properties,
              };
        const nextHover = toFacilityHoverState(hoverFeature, screenPoint);
        if (nextHover === null) {
          continue;
        }

        return {
          nextHover,
          nextTarget: {
            source: sourceIdForPerspective(nextHover.perspective),
            id: feature.id,
          },
        };
      }

      return null;
    },
  });

  const clearPointHover = (): void => {
    pointHoverController.clear();
  };

  const clear = (): void => {
    clearPointHover();
    clearClusterHover();
  };

  const onPointerLeave = (): void => {
    pointHoverController.handlePointerLeave();
    clearClusterHover();
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
      .catch((_) => {
        _;
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

    pointHoverController.clear();

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

    pointHoverController.handlePointerMove(event);
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
