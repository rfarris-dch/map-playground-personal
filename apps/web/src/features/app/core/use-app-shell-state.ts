import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type { IMap } from "@map-migration/map-engine";
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
import type { EnvironmentalStressController } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import type { BasemapLayerVisibilityController } from "@/features/basemap/basemap.types";
import type { BoundaryHoverState } from "@/features/boundaries/boundaries.types";
import type { FacilitiesLayerController } from "@/features/facilities/facilities.types";
import type {
  FacilitiesHoverController,
  FacilityClusterHoverState,
  FacilityHoverState,
} from "@/features/facilities/hover.types";
import type { FloodLayerMountResult } from "@/features/flood/flood-layer.types";
import type { GasPipelineLayerController } from "@/features/gas-pipelines/gas-pipelines.types";
import type { HydroBasinsVisibilityController } from "@/features/hydro-basins/hydro-basins.types";
import type {
  LayerRuntimeController,
  LayerRuntimeSnapshot,
} from "@/features/layers/layer-runtime.types";
import type { ParcelsLayerController, ParcelsStatus } from "@/features/parcels/parcels.types";
import type { PowerLayerMountResult } from "@/features/power/power.layer.types";
import type { PowerHoverController, PowerHoverState } from "@/features/power/power-hover.types";
import { cloneSelectionRing } from "@/features/selection/selection-analysis-request.service";
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
  const hoveredFacilityCluster = shallowRef<FacilityClusterHoverState | null>(null);
  const hoveredBoundary = shallowRef<BoundaryHoverState | null>(null);
  const boundaryHoverByLayer = shallowRef<BoundaryHoverByLayerState>(
    initialBoundaryHoverByLayerState()
  );
  const hoveredPower = shallowRef<PowerHoverState | null>(null);
  const boundaryControllers = shallowRef<BoundaryControllerState>(initialBoundaryControllerState());
  const facilitiesControllers = shallowRef<readonly FacilitiesLayerController[]>([]);
  const floodLayersController = shallowRef<FloodLayerMountResult | null>(null);
  const gasPipelineController = shallowRef<GasPipelineLayerController | null>(null);
  const hydroBasinsController = shallowRef<HydroBasinsVisibilityController | null>(null);
  const powerLayersController = shallowRef<PowerLayerMountResult | null>(null);
  const parcelsController = shallowRef<ParcelsLayerController | null>(null);
  const layerRuntime = shallowRef<LayerRuntimeController | null>(null);
  const layerRuntimeSnapshot = shallowRef<LayerRuntimeSnapshot | null>(null);
  const environmentalStressController = shallowRef<EnvironmentalStressController | null>(null);
  const facilitiesHoverController = shallowRef<FacilitiesHoverController | null>(null);
  const powerHoverController = shallowRef<PowerHoverController | null>(null);
  const sketchMeasureController = shallowRef<SketchMeasureLayerController | null>(null);
  const basemapLayerController = shallowRef<BasemapLayerVisibilityController | null>(null);
  const waterController = shallowRef<WaterLayerVisibilityController | null>(null);
  const disposeMapRuntime = shallowRef<(() => Promise<void>) | null>(null);
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

  function resetSketchMeasureState(mode: SketchMeasureMode): void {
    const initialState = initialSketchMeasureState();
    sketchMeasureState.value = {
      ...initialState,
      areaShape: sketchMeasureState.value.areaShape,
      mode,
    };
  }

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
    resetSketchMeasureState(mode);
    sketchMeasureController.value?.setMode(mode);
  }

  function setSketchMeasureAreaShape(shape: SketchMeasureAreaShape): void {
    sketchMeasureState.value = {
      ...sketchMeasureState.value,
      areaShape: shape,
    };
    sketchMeasureController.value?.setAreaShape(shape);
  }

  function finishSketchMeasureArea(): void {
    sketchMeasureController.value?.finishArea();
  }

  function clearSketchMeasure(): void {
    sketchMeasureState.value = initialSketchMeasureState();
    sketchMeasureController.value?.clear();
  }

  function useCompletedSketchAsSelection(): void {
    const completedGeometry = sketchMeasureState.value.completedAreaGeometry;
    if (completedGeometry === null) {
      return;
    }

    selectionGeometry.value = {
      areaShape: completedGeometry.areaShape,
      areaSqKm: completedGeometry.areaSqKm,
      distanceKm: completedGeometry.distanceKm,
      ring: cloneSelectionRing(completedGeometry.ring),
    };
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
    hoveredFacilityCluster,
    hoveredBoundary,
    boundaryHoverByLayer,
    hoveredPower,
    boundaryControllers,
    facilitiesControllers,
    floodLayersController,
    gasPipelineController,
    hydroBasinsController,
    powerLayersController,
    parcelsController,
    layerRuntime,
    layerRuntimeSnapshot,
    facilitiesHoverController,
    powerHoverController,
    sketchMeasureController,
    basemapLayerController,
    waterController,
    disposeMapRuntime,
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
    environmentalStressController,
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
