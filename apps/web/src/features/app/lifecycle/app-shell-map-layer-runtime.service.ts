import {
  destroyFacilitiesRuntime,
  initializeFacilitiesRuntime,
} from "@/features/app/lifecycle/app-shell-facilities-runtime.service";
import {
  destroyMeasureRuntime,
  initializeMeasureRuntime,
} from "@/features/app/lifecycle/app-shell-measure-runtime.service";
import {
  destroyParcelsRuntime,
  initializeParcelsRuntime,
} from "@/features/app/lifecycle/app-shell-parcels-runtime.service";
import {
  destroyPowerRuntime,
  initializePowerRuntime,
} from "@/features/app/lifecycle/app-shell-power-runtime.service";
import {
  destroyWaterRuntime,
  initializeWaterRuntime,
} from "@/features/app/lifecycle/app-shell-water-runtime.service";
import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";

export function initializeMapLayerRuntime(options: UseAppShellMapLifecycleOptions): void {
  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  initializeFacilitiesRuntime(options);
  initializeParcelsRuntime(options);
  options.fiber.initialize(currentMap);
  initializePowerRuntime(options);
  initializeWaterRuntime(options);
  initializeMeasureRuntime(options);
}

export function destroyMapLayerRuntime(options: UseAppShellMapLifecycleOptions): void {
  destroyMeasureRuntime(options);
  destroyWaterRuntime(options);
  destroyPowerRuntime(options);
  const currentMap = options.runtime.map.value;
  options.fiber.destroy(currentMap);
  destroyParcelsRuntime(options);
  destroyFacilitiesRuntime(options);
}
