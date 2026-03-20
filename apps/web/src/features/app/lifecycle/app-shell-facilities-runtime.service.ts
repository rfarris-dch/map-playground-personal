import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import { facilitiesLayerId } from "@/features/app/core/app-shell.constants";
import { isSamePerspective } from "@/features/app/core/app-shell.defaults";
import type {
  MountPerspectiveLayerArgs,
  UseAppShellMapLifecycleOptions,
} from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { mountFacilitiesLayer } from "@/features/facilities/facilities.layer";
import type { FacilitiesStatus } from "@/features/facilities/facilities.types";
import { mountHyperscaleLeasedLayer } from "@/features/facilities/facilities-leased.layer";
import { mountFacilitiesHover } from "@/features/facilities/hover";

const FACILITIES_LAYER_MIN_ZOOM = 2.5;
const FACILITIES_LIMIT_BY_PERSPECTIVE: Record<string, number> = {
  colocation: 15_000,
  hyperscale: 50_000,
  "hyperscale-leased": 10_000,
  enterprise: 10_000,
};
const FACILITIES_LAYER_DEBOUNCE_MS = 350;

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

function mountPerspectiveLayer({
  map,
  nextControllers,
  options,
  perspective,
}: MountPerspectiveLayerArgs): void {
  if (perspective === "hyperscale-leased") {
    const leasedController = mountHyperscaleLeasedLayer(map, {
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
    initialViewMode: options.state.perspectiveViewModes.value[perspective],
    limit: FACILITIES_LIMIT_BY_PERSPECTIVE[perspective] ?? 15_000,
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
        }
        return;
      }

      options.actions.setSelectedFacility(facility);
      nextControllers.reduce((_, existingController) => {
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

export function initializeFacilitiesRuntime(options: UseAppShellMapLifecycleOptions): void {
  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  const nextFacilitiesControllers: MountPerspectiveLayerArgs["nextControllers"] = [];
  const allPerspectives: readonly FacilityPerspective[] = [
    "colocation",
    "hyperscale",
    "hyperscale-leased",
    "enterprise",
  ];
  for (const perspective of allPerspectives) {
    mountPerspectiveLayer({
      map: currentMap,
      nextControllers: nextFacilitiesControllers,
      perspective,
      options,
    });
  }
  options.layers.facilitiesControllers.value = nextFacilitiesControllers;

  options.layers.facilitiesHoverController.value = mountFacilitiesHover(currentMap, {
    perspectives: allPerspectives,
    isInteractionEnabled: () => options.areFacilityInteractionsEnabled.value,
    onHoverChange: (nextHover) => {
      options.state.hoveredFacility.value = nextHover;
    },
    onClusterHoverChange: (nextHover) => {
      options.state.hoveredFacilityCluster.value = nextHover;
    },
    resolveFeatureProperties: (featureId) => {
      for (const controller of nextFacilitiesControllers) {
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
  for (const perspective of [
    "colocation",
    "hyperscale",
    "hyperscale-leased",
    "enterprise",
  ] as const) {
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
