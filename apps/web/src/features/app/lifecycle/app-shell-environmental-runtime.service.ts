import { FLOOD_500_LAYER_ID } from "@/features/app/core/app-shell.constants";
import type {
  EnvironmentalStressController,
  UseAppShellMapLifecycleOptions,
} from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { createStressGovernor } from "@/features/parcels/parcels.service";

export function initializeEnvironmentalStressRuntime(
  options: UseAppShellMapLifecycleOptions
): EnvironmentalStressController {
  const stressGovernor = createStressGovernor({
    onChange: (blocked) => {
      options.runtime.layerRuntime.value?.setStressBlocked(FLOOD_500_LAYER_ID, blocked);
      options.layers.hydroBasinsController.value?.setStressMode(blocked ? "degraded" : "normal");
    },
  });

  stressGovernor.setEnabled(true);

  return {
    destroy(): void {
      options.runtime.layerRuntime.value?.setStressBlocked(FLOOD_500_LAYER_ID, false);
      options.layers.hydroBasinsController.value?.setStressMode("normal");
      stressGovernor.destroy();
    },
  };
}
