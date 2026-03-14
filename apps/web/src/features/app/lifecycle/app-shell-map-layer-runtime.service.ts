import { initializeEnvironmentalStressRuntime } from "@/features/app/lifecycle/app-shell-environmental-runtime.service";
import {
  destroyFacilitiesRuntime,
  initializeFacilitiesRuntime,
} from "@/features/app/lifecycle/app-shell-facilities-runtime.service";
import {
  destroyFloodRuntime,
  initializeFloodRuntime,
} from "@/features/app/lifecycle/app-shell-flood-runtime.service";
import {
  destroyGasPipelineRuntime,
  initializeGasPipelineRuntime,
} from "@/features/app/lifecycle/app-shell-gas-pipeline-runtime.service";
import {
  destroyHydroBasinsRuntime,
  initializeHydroBasinsRuntime,
} from "@/features/app/lifecycle/app-shell-hydro-basins-runtime.service";
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
  initializeFloodRuntime(options);
  initializeHydroBasinsRuntime(options);
  initializeMeasureRuntime(options);

  try {
    options.fiber.initialize(currentMap);
  } catch (error: unknown) {
    console.error("Fiber runtime initialization failed", error);
  }

  initializePowerRuntime(options);
  initializeGasPipelineRuntime(options);
  initializeWaterRuntime(options);
  options.layers.environmentalStressController.value =
    initializeEnvironmentalStressRuntime(options);
}

export function destroyMapLayerRuntime(options: UseAppShellMapLifecycleOptions): void {
  options.layers.environmentalStressController.value?.destroy();
  options.layers.environmentalStressController.value = null;
  destroyMeasureRuntime(options);
  destroyWaterRuntime(options);
  destroyGasPipelineRuntime(options);
  destroyPowerRuntime(options);
  const currentMap = options.runtime.map.value;
  options.fiber.destroy(currentMap);
  destroyParcelsRuntime(options);
  destroyFacilitiesRuntime(options);
  destroyHydroBasinsRuntime(options);
  destroyFloodRuntime(options);
}
