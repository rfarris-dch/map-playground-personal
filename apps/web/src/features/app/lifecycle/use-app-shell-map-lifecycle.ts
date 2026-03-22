import { onBeforeUnmount, onMounted, watch } from "vue";
import { setBoundarySelectedRegionIds as applyBoundarySelectedRegionIds } from "@/features/app/boundary/app-shell-boundary-runtime.service";
import { facilitiesLayerId } from "@/features/app/core/app-shell.constants";
import { ensureFacilitiesPerspectiveMounted } from "@/features/app/lifecycle/app-shell-facilities-runtime.service";
import {
  destroyMapLifecycleRuntime,
  initializeMapLifecycleRuntime,
  resetMapLifecycleInteractions,
} from "@/features/app/lifecycle/app-shell-map-lifecycle.service";
import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";

export function useAppShellMapLifecycle(options: UseAppShellMapLifecycleOptions) {
  function setBoundarySelectedRegionIds(
    boundaryId: "country" | "county" | "state",
    selectedRegionIds: readonly string[] | null
  ): void {
    applyBoundarySelectedRegionIds(options, boundaryId, selectedRegionIds);
  }

  async function retryMapInitialization(): Promise<void> {
    const currentStatus = options.runtime.mapInitStatus.value;
    if (currentStatus.phase !== "error") {
      return;
    }

    await destroyMapLifecycleRuntime(options);
    await initializeMapLifecycleRuntime(options);
  }

  watch(
    () => options.state.sketchMeasureState.value.mode,
    (mode) => {
      if (mode === "off") {
        return;
      }

      resetMapLifecycleInteractions(options);
    }
  );

  watch(options.filters.facilitiesPredicate, () => {
    for (const controller of options.layers.facilitiesControllers.value) {
      controller.applyFilter();
    }
  });

  watch(options.filters.transmissionFilter, (filter) => {
    options.layers.powerLayersController.value?.controllers.transmission.setFilter(filter ?? null);
  });

  watch(options.filters.gasFilter, (filter) => {
    options.layers.gasPipelineController.value?.setFilter(filter ?? null);
  });

  watch(options.filters.parcelFilter, (filter) => {
    const controller = options.layers.parcelsController.value;
    if (controller !== null) {
      controller.setFilter(filter ?? null);
    }
  });

  watch(
    () => options.state.layerRuntimeSnapshot.value,
    () => {
      for (const perspective of ["hyperscale-leased", "enterprise"] as const) {
        if (
          options.runtime.layerRuntime.value?.getUserVisible(facilitiesLayerId(perspective)) !==
          true
        ) {
          continue;
        }

        ensureFacilitiesPerspectiveMounted(options, perspective);
      }
    }
  );

  onMounted(() => {
    initializeMapLifecycleRuntime(options).catch((error: unknown) => {
      console.error("[map] lifecycle initialization failed unexpectedly", error);
    });
  });

  onBeforeUnmount(() => {
    destroyMapLifecycleRuntime(options).catch((error: unknown) => {
      console.error("[map] lifecycle teardown failed", error);
    });
  });

  return {
    retryMapInitialization,
    setBoundarySelectedRegionIds,
  };
}
