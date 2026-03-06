import type { FacilitiesFeatureCollection, FacilityPerspective } from "@map-migration/contracts";
import type { IMap, MapControl } from "@map-migration/map-engine";
import { shallowRef, useTemplateRef } from "vue";
import {
  initialBoundaryControllerState,
  initialBoundaryHoverByLayerState,
} from "@/features/app/boundary/app-shell-boundary.service";
import type {
  BoundaryControllerState,
  BoundaryHoverByLayerState,
} from "@/features/app/boundary/app-shell-boundary.types";
import {
  initialBoundaryFacetOptionsState,
  initialBoundaryFacetSelectionState,
  initialMeasureState,
  initialParcelsStatus,
  initialPerspectiveStatusState,
} from "@/features/app/core/app-shell.defaults";
import type {
  BoundaryFacetOptionsState,
  BoundaryFacetSelectionState,
  PerspectiveStatusState,
} from "@/features/app/core/app-shell.types";
import type { BasemapLayerVisibilityController } from "@/features/basemap/basemap.types";
import type { BoundaryHoverState } from "@/features/boundaries/boundaries.types";
import type { FacilitiesLayerController } from "@/features/facilities/facilities.types";
import type {
  FacilitiesHoverController,
  FacilityHoverState,
} from "@/features/facilities/hover.types";
import type { LayerRuntimeController } from "@/features/layers/layer-runtime.types";
import type {
  MeasureAreaShape,
  MeasureLayerController,
  MeasureMode,
  MeasureState,
} from "@/features/measure/measure.types";
import type { ParcelsLayerController, ParcelsStatus } from "@/features/parcels/parcels.types";
import type { PowerLayerVisibilityController } from "@/features/power/power.types";
import type { PowerHoverController, PowerHoverState } from "@/features/power/power-hover.types";
import type { UseAppShellStateResult } from "./use-app-shell-state.types";

export function useAppShellState(): UseAppShellStateResult {
  const mapContainer = useTemplateRef<HTMLDivElement>("map-container");
  const map = shallowRef<IMap | null>(null);
  const hoveredFacility = shallowRef<FacilityHoverState | null>(null);
  const hoveredBoundary = shallowRef<BoundaryHoverState | null>(null);
  const boundaryHoverByLayer = shallowRef<BoundaryHoverByLayerState>(
    initialBoundaryHoverByLayerState()
  );
  const hoveredPower = shallowRef<PowerHoverState | null>(null);
  const boundaryControllers = shallowRef<BoundaryControllerState>(initialBoundaryControllerState());
  const facilitiesControllers = shallowRef<readonly FacilitiesLayerController[]>([]);
  const powerControllers = shallowRef<readonly PowerLayerVisibilityController[]>([]);
  const parcelsController = shallowRef<ParcelsLayerController | null>(null);
  const layerRuntime = shallowRef<LayerRuntimeController | null>(null);
  const facilitiesHoverController = shallowRef<FacilitiesHoverController | null>(null);
  const powerHoverController = shallowRef<PowerHoverController | null>(null);
  const measureController = shallowRef<MeasureLayerController | null>(null);
  const basemapLayerController = shallowRef<BasemapLayerVisibilityController | null>(null);
  const disposePmtilesProtocol = shallowRef<(() => void) | null>(null);
  const restoreConsoleWarn = shallowRef<(() => void) | null>(null);
  const mapControls = shallowRef<readonly MapControl[]>([]);
  const facilitiesStatus = shallowRef<PerspectiveStatusState>(initialPerspectiveStatusState());
  const parcelsStatus = shallowRef<ParcelsStatus>(initialParcelsStatus());
  const boundaryFacetOptions = shallowRef<BoundaryFacetOptionsState>(
    initialBoundaryFacetOptionsState()
  );
  const boundaryFacetSelection = shallowRef<BoundaryFacetSelectionState>(
    initialBoundaryFacetSelectionState()
  );
  const measureState = shallowRef<MeasureState>(initialMeasureState());
  const colocationViewportFeatures = shallowRef<FacilitiesFeatureCollection["features"]>([]);
  const hyperscaleViewportFeatures = shallowRef<FacilitiesFeatureCollection["features"]>([]);
  const isLayerPanelOpen = shallowRef<boolean>(true);
  const isMeasurePanelOpen = shallowRef<boolean>(true);

  function setViewportFacilities(
    perspective: FacilityPerspective,
    features: FacilitiesFeatureCollection["features"]
  ): void {
    if (perspective === "colocation") {
      colocationViewportFeatures.value = features;
      return;
    }

    hyperscaleViewportFeatures.value = features;
  }

  function setMeasureMode(mode: MeasureMode): void {
    measureController.value?.setMode(mode);
  }

  function setMeasureAreaShape(shape: MeasureAreaShape): void {
    measureController.value?.setAreaShape(shape);
  }

  function finishMeasureSelection(): void {
    measureController.value?.finishSelection();
  }

  function clearMeasure(): void {
    measureController.value?.clear();
  }

  function toggleLayerPanel(): void {
    isLayerPanelOpen.value = !isLayerPanelOpen.value;
  }

  function toggleMeasurePanel(): void {
    isMeasurePanelOpen.value = !isMeasurePanelOpen.value;
  }

  return {
    mapContainer,
    map,
    hoveredFacility,
    hoveredBoundary,
    boundaryHoverByLayer,
    hoveredPower,
    boundaryControllers,
    facilitiesControllers,
    powerControllers,
    parcelsController,
    layerRuntime,
    facilitiesHoverController,
    powerHoverController,
    measureController,
    basemapLayerController,
    disposePmtilesProtocol,
    restoreConsoleWarn,
    mapControls,
    facilitiesStatus,
    parcelsStatus,
    boundaryFacetOptions,
    boundaryFacetSelection,
    measureState,
    colocationViewportFeatures,
    hyperscaleViewportFeatures,
    isLayerPanelOpen,
    isMeasurePanelOpen,
    setViewportFacilities,
    setMeasureMode,
    setMeasureAreaShape,
    finishMeasureSelection,
    clearMeasure,
    toggleLayerPanel,
    toggleMeasurePanel,
  };
}
