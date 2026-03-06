import type { FacilitiesFeatureCollection, FacilityPerspective } from "@map-migration/contracts";
import { facilitiesLayerId } from "@/features/app/core/app-shell.constants";
import { isSamePerspective } from "@/features/app/core/app-shell.defaults";
import type {
  MountPerspectiveLayerArgs,
  UseAppShellMapLifecycleOptions,
} from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { mountFacilitiesLayer } from "@/features/facilities/facilities.layer";
import type { FacilitiesStatus } from "@/features/facilities/facilities.types";
import { mountFacilitiesHover } from "@/features/facilities/hover";

const FACILITIES_LAYER_MIN_ZOOM = 2.5;
const FACILITIES_LAYER_LIMIT = 1000;
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
  const controller = mountFacilitiesLayer(map, {
    debounceMs: FACILITIES_LAYER_DEBOUNCE_MS,
    limit: FACILITIES_LAYER_LIMIT,
    minZoom: FACILITIES_LAYER_MIN_ZOOM,
    perspective,
    isInteractionEnabled: () => options.areFacilityInteractionsEnabled.value,
    onStatus: (status) => {
      setPerspectiveStatus(options, perspective, status);
    },
    onViewportUpdate: (snapshot) => {
      setViewportFacilities(options, perspective, snapshot.features);
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
  mountPerspectiveLayer({
    map: currentMap,
    nextControllers: nextFacilitiesControllers,
    perspective: "colocation",
    options,
  });
  mountPerspectiveLayer({
    map: currentMap,
    nextControllers: nextFacilitiesControllers,
    perspective: "hyperscale",
    options,
  });
  options.layers.facilitiesControllers.value = nextFacilitiesControllers;

  options.layers.facilitiesHoverController.value = mountFacilitiesHover(currentMap, {
    perspectives: ["colocation", "hyperscale"],
    isInteractionEnabled: () => options.areFacilityInteractionsEnabled.value,
    onHoverChange: (nextHover) => {
      options.state.hoveredFacility.value = nextHover;
    },
  });
}

export function destroyFacilitiesRuntime(options: UseAppShellMapLifecycleOptions): void {
  options.layers.facilitiesHoverController.value?.destroy();
  options.layers.facilitiesHoverController.value = null;
  options.state.hoveredFacility.value = null;

  options.layers.facilitiesControllers.value.reduce((_, controller) => {
    controller.destroy();
    return 0;
  }, 0);
  options.layers.facilitiesControllers.value = [];
}
