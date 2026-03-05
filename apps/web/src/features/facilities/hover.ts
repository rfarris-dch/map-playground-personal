import type {
  CommissionedSemantic,
  FacilityPerspective,
  LeaseOrOwn,
} from "@map-migration/contracts";
import type { IMap, MapPointerEvent } from "@map-migration/map-engine";
import { isFeatureId } from "./facilities.service";
import type {
  FacilitiesHoverController,
  FacilitiesHoverOptions,
  FacilityHoverState,
} from "./hover.types";

interface HoverTarget {
  readonly featureId: number | string;
  readonly sourceId: string;
}

function pointLayerIdForPerspective(perspective: FacilityPerspective): string {
  return `facilities.${perspective}.points`;
}

function sourceIdForPerspective(perspective: FacilityPerspective): string {
  return `facilities.${perspective}`;
}

function isFacilityPerspective(value: unknown): value is FacilityPerspective {
  return value === "colocation" || value === "hyperscale";
}

function isLeaseOrOwn(value: unknown): value is LeaseOrOwn {
  return value === "lease" || value === "own" || value === "unknown";
}

function isCommissionedSemantic(value: unknown): value is CommissionedSemantic {
  return (
    value === "leased" ||
    value === "operational" ||
    value === "under_construction" ||
    value === "planned" ||
    value === "unknown"
  );
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

  const perspectiveValue = readStringProperty(feature.properties, "perspective");
  if (!isFacilityPerspective(perspectiveValue)) {
    return null;
  }

  const semanticValue = readStringProperty(feature.properties, "commissionedSemantic");
  if (!isCommissionedSemantic(semanticValue)) {
    return null;
  }

  const providerId = readStringProperty(feature.properties, "providerId") ?? "unknown-provider";
  const facilityId = readStringProperty(feature.properties, "facilityId") ?? String(feature.id);
  const leaseOrOwnValue = readStringProperty(feature.properties, "leaseOrOwn");
  const leaseOrOwn = isLeaseOrOwn(leaseOrOwnValue) ? leaseOrOwnValue : null;
  const commissionedPowerMw = readNullableNumberProperty(feature.properties, "commissionedPowerMw");

  return {
    perspective: perspectiveValue,
    facilityId,
    providerId,
    commissionedPowerMw,
    commissionedSemantic: semanticValue,
    leaseOrOwn,
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
  let hoverTarget: HoverTarget | null = null;

  const queryablePointLayerIds = (): string[] => {
    return pointLayerIds.filter((layerId) => map.hasLayer(layerId));
  };

  const clear = (): void => {
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

  const onPointerLeave = (): void => {
    clear();
  };

  const onPointerMove = (event: MapPointerEvent): void => {
    if (!(options.isInteractionEnabled?.() ?? true)) {
      clear();
      return;
    }

    const layers = queryablePointLayerIds();
    if (layers.length === 0) {
      clear();
      return;
    }

    const features = map.queryRenderedFeatures(event.point, {
      layers,
    });

    const screenPoint: readonly [number, number] = [event.point[0], event.point[1]];
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

      clear();
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

    clear();
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
