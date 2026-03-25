import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import { DEFAULT_LAYER_CATALOG } from "@map-migration/map-layer-catalog";
import { facilitiesLayerId } from "@/features/app/core/app-shell.constants";
import { isSamePerspective } from "@/features/app/core/app-shell.defaults";
import type {
  MountPerspectiveLayerArgs,
  UseAppShellMapLifecycleOptions,
} from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { preloadFacilitiesDatasetManifest } from "@/features/facilities/api";
import { mountFacilitiesLayer } from "@/features/facilities/facilities.layer";
import type { FacilitiesStatus } from "@/features/facilities/facilities.types";
import { mountHyperscaleLeasedLayer } from "@/features/facilities/facilities-leased.layer";
import { mountFacilitiesHover } from "@/features/facilities/hover";

const ALL_FACILITY_PERSPECTIVES: readonly FacilityPerspective[] = [
  "colocation",
  "hyperscale",
  "hyperscale-leased",
  "enterprise",
];
const EAGER_FACILITY_PERSPECTIVES: readonly FacilityPerspective[] = ["colocation", "hyperscale"];
const FACILITIES_LAYER_MIN_ZOOM = DEFAULT_LAYER_CATALOG["facilities.colocation"].zoomMin;
const FACILITIES_LIMIT_BY_PERSPECTIVE: Record<string, number> = {
  colocation: 2500,
  hyperscale: 12_000,
  "hyperscale-leased": 7500,
  enterprise: 5000,
};
const FACILITIES_LAYER_DEBOUNCE_MS = 350;
const FACILITIES_MAX_VIEWPORT_WIDTH_KM_BY_PERSPECTIVE: Readonly<
  Record<FacilityPerspective, number>
> = {
  colocation: Number.POSITIVE_INFINITY,
  hyperscale: Number.POSITIVE_INFINITY,
  "hyperscale-leased": Number.POSITIVE_INFINITY,
  enterprise: Number.POSITIVE_INFINITY,
};
const FACILITIES_MAX_VIEWPORT_FEATURE_BUDGET_BY_PERSPECTIVE: Readonly<
  Record<FacilityPerspective, number>
> = {
  colocation: 700,
  hyperscale: 2000,
  "hyperscale-leased": 2500,
  enterprise: 800,
};
const FACILITIES_ICON_MIN_ZOOM_BY_PERSPECTIVE: Readonly<Record<FacilityPerspective, number>> = {
  colocation: 0,
  hyperscale: 0,
  "hyperscale-leased": 0,
  enterprise: 0,
};
const FACILITIES_ICON_MAX_VIEWPORT_FEATURES_BY_PERSPECTIVE: Readonly<
  Record<FacilityPerspective, number>
> = {
  colocation: Number.POSITIVE_INFINITY,
  hyperscale: Number.POSITIVE_INFINITY,
  "hyperscale-leased": Number.POSITIVE_INFINITY,
  enterprise: Number.POSITIVE_INFINITY,
};

function setPerspectiveStatus(
  options: UseAppShellMapLifecycleOptions,
  perspective: FacilityPerspective,
  status: FacilitiesStatus
): void {
  options.state.facilitiesStatus.value = {
    ...options.state.facilitiesStatus.value,
    [perspective]: status,
  };
}

function setViewportFacilities(
  options: UseAppShellMapLifecycleOptions,
  perspective: FacilityPerspective,
  features: FacilitiesFeatureCollection["features"]
): void {
  if (perspective === "colocation") {
    options.state.colocationViewportFeatures.value = features;
    return;
  }

  options.state.hyperscaleViewportFeatures.value = features;
}

function isPerspectiveMounted(
  options: UseAppShellMapLifecycleOptions,
  perspective: FacilityPerspective
): boolean {
  return options.layers.facilitiesControllers.value.some(
    (controller) => controller.perspective === perspective
  );
}

function mountPerspectiveLayer({
  map,
  nextControllers,
  options,
  perspective,
}: MountPerspectiveLayerArgs): void {
  if (perspective === "hyperscale-leased") {
    const leasedController = mountHyperscaleLeasedLayer(map, {
      interactionCoordinator: options.runtime.interactionCoordinator.value,
      perspective,
      limit: FACILITIES_LIMIT_BY_PERSPECTIVE[perspective] ?? 10_000,
      onStatusChange: (status) => {
        setPerspectiveStatus(options, perspective, status);
      },
      onViewportUpdate: (snapshot) => {
        setViewportFacilities(options, perspective, snapshot.features);
      },
    });
    options.runtime.layerRuntime.value?.registerLayerController(
      facilitiesLayerId(perspective),
      leasedController
    );
    nextControllers.push(leasedController);
    return;
  }

  const controller = mountFacilitiesLayer(map, {
    debounceMs: FACILITIES_LAYER_DEBOUNCE_MS,
    filterPredicate: () => options.filters.facilitiesPredicate.value ?? null,
    iconMaxViewportFeatures:
      FACILITIES_ICON_MAX_VIEWPORT_FEATURES_BY_PERSPECTIVE[perspective] ?? 600,
    iconMinZoom: FACILITIES_ICON_MIN_ZOOM_BY_PERSPECTIVE[perspective] ?? 6,
    initialViewMode: options.state.perspectiveViewModes.value[perspective],
    interactionCoordinator: options.runtime.interactionCoordinator.value,
    layerId: facilitiesLayerId(perspective),
    limit: FACILITIES_LIMIT_BY_PERSPECTIVE[perspective] ?? 15_000,
    maxViewportFeatureBudget:
      FACILITIES_MAX_VIEWPORT_FEATURE_BUDGET_BY_PERSPECTIVE[perspective] ?? 2000,
    maxViewportWidthKm:
      FACILITIES_MAX_VIEWPORT_WIDTH_KM_BY_PERSPECTIVE[perspective] ?? Number.POSITIVE_INFINITY,
    minZoom: FACILITIES_LAYER_MIN_ZOOM,
    perspective,
    isInteractionEnabled: () => options.areFacilityInteractionsEnabled.value,
    onStatus: (status) => {
      setPerspectiveStatus(options, perspective, status);
    },
    onCachedFeaturesUpdate: (features) => {
      options.filters.onCachedFeaturesUpdate(features);
    },
    onViewportUpdate: (snapshot) => {
      setViewportFacilities(options, perspective, snapshot.features);
    },
    onClusterClick: () => {
      options.state.clusterClickSignal.value += 1;
    },
    onSelectFacility: (facility) => {
      if (facility === null) {
        if (isSamePerspective(options.state.selectedFacility.value, perspective)) {
          options.actions.setSelectedFacility(null);
          options.state.selectedFacilityHoverState.value = null;
        }
        return;
      }

      options.state.selectedFacilityHoverState.value = options.state.hoveredFacility.value ?? null;
      options.actions.setSelectedFacility(facility);
      options.layers.facilitiesControllers.value.reduce((_, existingController) => {
        if (existingController !== controller) {
          existingController.clearSelection();
        }
        return 0;
      }, 0);
    },
  });

  options.runtime.layerRuntime.value?.registerLayerController(
    facilitiesLayerId(perspective),
    controller
  );
  nextControllers.push(controller);
}

function shouldMountPerspective(
  options: UseAppShellMapLifecycleOptions,
  perspective: FacilityPerspective
): boolean {
  return (
    EAGER_FACILITY_PERSPECTIVES.includes(perspective) ||
    (options.runtime.layerRuntime.value?.getUserVisible(facilitiesLayerId(perspective)) ?? false)
  );
}

export function ensureFacilitiesPerspectiveMounted(
  options: UseAppShellMapLifecycleOptions,
  perspective: FacilityPerspective
): void {
  if (isPerspectiveMounted(options, perspective)) {
    return;
  }

  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  const nextControllers = [...options.layers.facilitiesControllers.value];
  mountPerspectiveLayer({
    map: currentMap,
    nextControllers,
    perspective,
    options,
  });
  options.layers.facilitiesControllers.value = nextControllers;
}

export function initializeFacilitiesRuntime(options: UseAppShellMapLifecycleOptions): void {
  preloadFacilitiesDatasetManifest();

  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  const nextFacilitiesControllers: MountPerspectiveLayerArgs["nextControllers"] = [];
  for (const perspective of ALL_FACILITY_PERSPECTIVES) {
    if (!shouldMountPerspective(options, perspective)) {
      continue;
    }

    mountPerspectiveLayer({
      map: currentMap,
      nextControllers: nextFacilitiesControllers,
      perspective,
      options,
    });
  }
  options.layers.facilitiesControllers.value = nextFacilitiesControllers;

  options.layers.facilitiesHoverController.value = mountFacilitiesHover(currentMap, {
    perspectives: ALL_FACILITY_PERSPECTIVES,
    isInteractionEnabled: () => options.areFacilityInteractionsEnabled.value,
    onHoverChange: (nextHover) => {
      options.state.hoveredFacility.value = nextHover;
    },
    onClusterHoverChange: (nextHover) => {
      options.state.hoveredFacilityCluster.value = nextHover;
    },
    resolveFeatureProperties: (featureId) => {
      for (const controller of options.layers.facilitiesControllers.value) {
        const properties = controller.resolveFeatureProperties(featureId);
        if (properties !== null) {
          return properties;
        }
      }
      return null;
    },
  });
}

export function destroyFacilitiesRuntime(options: UseAppShellMapLifecycleOptions): void {
  for (const perspective of ALL_FACILITY_PERSPECTIVES) {
    options.runtime.layerRuntime.value?.unregisterLayerController(facilitiesLayerId(perspective));
  }

  options.layers.facilitiesHoverController.value?.destroy();
  options.layers.facilitiesHoverController.value = null;
  options.state.hoveredFacility.value = null;
  options.state.hoveredFacilityCluster.value = null;

  options.layers.facilitiesControllers.value.reduce((_, controller) => {
    controller.destroy();
    return 0;
  }, 0);
  options.layers.facilitiesControllers.value = [];
}
