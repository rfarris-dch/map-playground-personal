import { onBeforeUnmount, onMounted, watch } from "vue";
import { setBoundarySelectedRegionIds as applyBoundarySelectedRegionIds } from "@/features/app/boundary/app-shell-boundary-runtime.service";
import {
  destroyMapLifecycleRuntime,
  initializeMapLifecycleRuntime,
  resetMapLifecycleInteractions,
  restoreSuppressedGlyphWarnings,
} from "@/features/app/lifecycle/app-shell-map-lifecycle.service";
import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";

export function useAppShellMapLifecycle(options: UseAppShellMapLifecycleOptions) {
  function setBoundarySelectedRegionIds(
    boundaryId: "country" | "county" | "state",
    selectedRegionIds: readonly string[] | null
  ): void {
    applyBoundarySelectedRegionIds(options, boundaryId, selectedRegionIds);
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

  onMounted(() => {
    try {
      options.runtime.restoreConsoleWarn.value = restoreSuppressedGlyphWarnings();
      initializeMapLifecycleRuntime(options);
    } catch (error: unknown) {
      console.error("Map initialization failed", error);
    }
  });

  onBeforeUnmount(() => {
    destroyMapLifecycleRuntime(options);
  });

  return {
    setBoundarySelectedRegionIds,
  };
}
