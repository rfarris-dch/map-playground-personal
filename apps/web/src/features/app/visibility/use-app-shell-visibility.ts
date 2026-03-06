import type { FacilityPerspective } from "@map-migration/contracts";
import { shallowRef } from "vue";
import {
  facilitiesLayerId,
  PARCELS_LAYER_ID,
  powerLayerId,
  WATER_FEATURES_LAYER_ID,
} from "@/features/app/core/app-shell.constants";
import type {
  BoundaryVisibilityState,
  PerspectiveVisibilityState,
} from "@/features/app/core/app-shell.types";
import {
  buildInitialBoundaryVisibilityState,
  buildInitialParcelsVisible,
  buildInitialPerspectiveVisibilityState,
  buildInitialPowerVisibilityState,
  buildInitialWaterVisible,
  syncBoundaryVisibilityState,
  syncParcelsVisible,
  syncPerspectiveVisibilityState,
  syncPowerVisibilityState,
  syncWaterVisible,
  withBoundaryVisibility,
  withPerspectiveVisibility,
  withPowerVisibility,
} from "@/features/app/visibility/app-shell-visibility.service";
import type { UseAppShellVisibilityOptions } from "@/features/app/visibility/use-app-shell-visibility.types";
import {
  basemapLayerIds,
  buildInitialBasemapVisibilityState,
  isBasemapLayerVisible,
  withBasemapLayerVisibility,
} from "@/features/basemap/basemap.service";
import type { BasemapLayerId, BasemapVisibilityState } from "@/features/basemap/basemap.types";
import type { BoundaryLayerId } from "@/features/boundaries/boundaries.types";
import type { PowerLayerId, PowerVisibilityState } from "@/features/power/power.types";

export function useAppShellVisibility(options: UseAppShellVisibilityOptions) {
  const basemapVisibility = shallowRef<BasemapVisibilityState>(
    buildInitialBasemapVisibilityState()
  );
  const boundaryVisibility = shallowRef<BoundaryVisibilityState>(
    buildInitialBoundaryVisibilityState()
  );
  const visiblePerspectives = shallowRef<PerspectiveVisibilityState>(
    buildInitialPerspectiveVisibilityState()
  );
  const parcelsVisible = shallowRef<boolean>(buildInitialParcelsVisible());
  const powerVisibility = shallowRef<PowerVisibilityState>(buildInitialPowerVisibilityState());
  const waterVisible = shallowRef<boolean>(buildInitialWaterVisible());

  function applyBasemapVisibility(): void {
    const controller = options.basemapLayerController.value;
    if (controller === null) {
      return;
    }

    for (const layerId of basemapLayerIds()) {
      controller.setVisible(layerId, isBasemapLayerVisible(basemapVisibility.value, layerId));
    }
  }

  function syncRuntimeVisibility(): void {
    const runtime = options.layerRuntime.value;

    visiblePerspectives.value = syncPerspectiveVisibilityState({
      runtime,
      fallback: visiblePerspectives.value,
    });
    boundaryVisibility.value = syncBoundaryVisibilityState({
      runtime,
      fallback: boundaryVisibility.value,
    });
    parcelsVisible.value = syncParcelsVisible({
      runtime,
      fallback: parcelsVisible.value,
    });
    powerVisibility.value = syncPowerVisibilityState({
      runtime,
      fallback: powerVisibility.value,
    });
    waterVisible.value = syncWaterVisible({
      runtime,
      fallback: waterVisible.value,
    });
  }

  function setPerspectiveVisibility(perspective: FacilityPerspective, visible: boolean): void {
    visiblePerspectives.value = withPerspectiveVisibility({
      perspective,
      visible,
      state: visiblePerspectives.value,
    });
    options.layerRuntime.value?.setUserVisible(facilitiesLayerId(perspective), visible);

    if (!visible) {
      options.setViewportFacilities(perspective, []);
    }
  }

  function setParcelsVisible(visible: boolean): void {
    parcelsVisible.value = visible;
    options.layerRuntime.value?.setUserVisible(PARCELS_LAYER_ID, visible);

    if (!visible) {
      options.clearSelectedParcel();
    }
  }

  function setBasemapLayerVisible(layerId: BasemapLayerId, visible: boolean): void {
    basemapVisibility.value = withBasemapLayerVisibility(basemapVisibility.value, layerId, visible);
    options.basemapLayerController.value?.setVisible(layerId, visible);
  }

  function setWaterVisible(visible: boolean): void {
    waterVisible.value = visible;
    options.layerRuntime.value?.setUserVisible(WATER_FEATURES_LAYER_ID, visible);
  }

  function setPowerLayerVisible(layerId: PowerLayerId, visible: boolean): void {
    powerVisibility.value = withPowerVisibility({
      layerId,
      visible,
      state: powerVisibility.value,
    });
    options.layerRuntime.value?.setUserVisible(powerLayerId(layerId), visible);
    options.clearPowerHover();
  }

  function setBoundaryVisible(boundaryId: BoundaryLayerId, visible: boolean): void {
    boundaryVisibility.value = withBoundaryVisibility({
      boundaryId,
      visible,
      state: boundaryVisibility.value,
    });

    if (visible) {
      options.boundaryFacetSelection.value = {
        ...options.boundaryFacetSelection.value,
        [boundaryId]: null,
      };
      options.boundaryControllers.value[boundaryId]?.setIncludedRegionIds(null);
    }

    options.layerRuntime.value?.setUserVisible(boundaryId, visible);
  }

  return {
    basemapVisibility,
    boundaryVisibility,
    visiblePerspectives,
    parcelsVisible,
    powerVisibility,
    waterVisible,
    applyBasemapVisibility,
    syncRuntimeVisibility,
    setPerspectiveVisibility,
    setParcelsVisible,
    setBasemapLayerVisible,
    setPowerLayerVisible,
    setWaterVisible,
    setBoundaryVisible,
  };
}
