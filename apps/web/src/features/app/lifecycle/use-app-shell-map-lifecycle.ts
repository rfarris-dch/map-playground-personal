import { onBeforeUnmount, onMounted, watch } from "vue";
import { setBoundarySelectedRegionIds as applyBoundarySelectedRegionIds } from "@/features/app/boundary/app-shell-boundary-runtime.service";
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

  watch(options.filters.parcelFilter, (filter) => {
    const controller = options.layers.parcelsController.value;
    if (controller !== null) {
      controller.setFilter(filter ?? null);
    }
  });

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
