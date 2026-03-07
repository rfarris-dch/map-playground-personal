import type { FacilitiesFeatureCollection, FacilityPerspective } from "@map-migration/contracts";
import type { IMap, MapControl } from "@map-migration/map-engine";
import { computed, shallowRef, useTemplateRef } from "vue";
import {
  initialBoundaryControllerState,
  initialBoundaryHoverByLayerState,
} from "@/features/app/boundary/app-shell-boundary.service";
import type {
  BoundaryControllerState,
  BoundaryHoverByLayerState,
} from "@/features/app/boundary/app-shell-boundary.types";
import {
  initialActiveToolPanel,
  initialBoundaryFacetOptionsState,
  initialBoundaryFacetSelectionState,
  initialParcelsStatus,
  initialPerspectiveStatusState,
  initialSketchMeasureState,
} from "@/features/app/core/app-shell.defaults";
import type {
  AppShellToolPanel,
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
import type { ParcelsLayerController, ParcelsStatus } from "@/features/parcels/parcels.types";
import type { PowerLayerVisibilityController } from "@/features/power/power.types";
import type { PowerHoverController, PowerHoverState } from "@/features/power/power-hover.types";
import type {
  SketchAreaGeometry,
  SketchMeasureAreaShape,
  SketchMeasureLayerController,
  SketchMeasureMode,
  SketchMeasureState,
} from "@/features/sketch-measure/sketch-measure.types";
import type { WaterLayerVisibilityController } from "@/features/water/water.types";
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
  const sketchMeasureController = shallowRef<SketchMeasureLayerController | null>(null);
  const basemapLayerController = shallowRef<BasemapLayerVisibilityController | null>(null);
  const waterController = shallowRef<WaterLayerVisibilityController | null>(null);
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
  const sketchMeasureState = shallowRef<SketchMeasureState>(initialSketchMeasureState());
  const selectionGeometry = shallowRef<SketchAreaGeometry | null>(null);
  const colocationViewportFeatures = shallowRef<FacilitiesFeatureCollection["features"]>([]);
  const hyperscaleViewportFeatures = shallowRef<FacilitiesFeatureCollection["features"]>([]);
  const activeToolPanel = shallowRef<AppShellToolPanel>(initialActiveToolPanel());

  const isLayerPanelOpen = computed(() => activeToolPanel.value === "layers");
  const isSketchMeasurePanelOpen = computed(() => activeToolPanel.value === "sketch-measure");
  const isSelectionPanelOpen = computed(() => activeToolPanel.value === "selection");

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

  function togglePanel(panel: "layers" | "selection" | "sketch-measure"): void {
    activeToolPanel.value = activeToolPanel.value === panel ? null : panel;
  }

  function setSketchMeasureMode(mode: SketchMeasureMode): void {
    sketchMeasureController.value?.setMode(mode);
  }

  function setSketchMeasureAreaShape(shape: SketchMeasureAreaShape): void {
    sketchMeasureController.value?.setAreaShape(shape);
  }

  function finishSketchMeasureArea(): void {
    sketchMeasureController.value?.finishArea();
  }

  function clearSketchMeasure(): void {
    sketchMeasureController.value?.clear();
  }

  function useCompletedSketchAsSelection(): void {
    const completedGeometry = sketchMeasureState.value.completedAreaGeometry;
    if (completedGeometry === null) {
      return;
    }

    selectionGeometry.value = completedGeometry;
    activeToolPanel.value = "selection";
  }

  function clearSelectionGeometry(): void {
    selectionGeometry.value = null;
    if (activeToolPanel.value === "selection") {
      activeToolPanel.value = null;
    }
  }

  function toggleLayerPanel(): void {
    togglePanel("layers");
  }

  function toggleSketchMeasurePanel(): void {
    togglePanel("sketch-measure");
  }

  function toggleSelectionPanel(): void {
    if (selectionGeometry.value === null) {
      return;
    }

    togglePanel("selection");
  }

  return {
    activeToolPanel,
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
    sketchMeasureController,
    basemapLayerController,
    waterController,
    disposePmtilesProtocol,
    restoreConsoleWarn,
    mapControls,
    facilitiesStatus,
    parcelsStatus,
    boundaryFacetOptions,
    boundaryFacetSelection,
    sketchMeasureState,
    selectionGeometry,
    colocationViewportFeatures,
    hyperscaleViewportFeatures,
    isLayerPanelOpen,
    isSketchMeasurePanelOpen,
    isSelectionPanelOpen,
    setViewportFacilities,
    setSketchMeasureMode,
    setSketchMeasureAreaShape,
    finishSketchMeasureArea,
    clearSketchMeasure,
    useCompletedSketchAsSelection,
    clearSelectionGeometry,
    toggleLayerPanel,
    toggleSketchMeasurePanel,
    toggleSelectionPanel,
  };
}
