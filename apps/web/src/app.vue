<script setup lang="ts">
  import type { FacilityPerspective } from "@map-migration/contracts";
  import { createMap, createMapLibreAdapter, type IMap } from "@map-migration/map-engine";
  import maplibregl, { type IControl } from "maplibre-gl";
  import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from "vue";
  import {
    defaultBasemapStyleUrl,
    mountBasemap3DBuildings,
  } from "@/features/basemap/basemap.service";
  import FacilitiesControls from "@/features/facilities/components/facilities-controls.vue";
  import FacilityHoverTooltip from "@/features/facilities/components/facility-hover-tooltip.vue";
  import { useFacilityDetailQuery } from "@/features/facilities/facility-detail/detail";
  import FacilityDetailDrawer from "@/features/facilities/facility-detail/components/facility-detail-drawer.vue";
  import { mountFacilitiesHover } from "@/features/facilities/hover";
  import type { FacilitiesHoverController, FacilityHoverState } from "@/features/facilities/hover.types";
  import { mountFacilitiesLayer } from "@/features/facilities/facilities.layer";
  import { formatFacilitiesStatus } from "@/features/facilities/facilities.service";
  import type {
    FacilitiesLayerController,
    FacilitiesStatus,
    SelectedFacilityRef,
  } from "@/features/facilities/facilities.types";
  import MeasureToolbar from "@/features/measure/components/measure-toolbar.vue";
  import { mountMeasureLayer } from "@/features/measure/measure.layer";
  import type {
    MeasureLayerController,
    MeasureMode,
    MeasureState,
  } from "@/features/measure/measure.types";

  interface PerspectiveStatusState {
    readonly colocation: FacilitiesStatus;
    readonly hyperscale: FacilitiesStatus;
  }

  interface PerspectiveVisibilityState {
    readonly colocation: boolean;
    readonly hyperscale: boolean;
  }

  function initialMeasureState(): MeasureState {
    return {
      mode: "off",
      vertexCount: 0,
      distanceKm: null,
      areaSqKm: null,
    };
  }

  function initialPerspectiveStatusState(): PerspectiveStatusState {
    return {
      colocation: { state: "idle" },
      hyperscale: { state: "idle" },
    };
  }

  function initialPerspectiveVisibilityState(): PerspectiveVisibilityState {
    return {
      colocation: true,
      hyperscale: true,
    };
  }

  const mapContainer = useTemplateRef<HTMLDivElement>("map-container");
  const map = shallowRef<IMap | null>(null);
  const selectedFacility = shallowRef<SelectedFacilityRef | null>(null);
  const hoveredFacility = shallowRef<FacilityHoverState | null>(null);
  const facilitiesControllers = shallowRef<readonly FacilitiesLayerController[]>([]);
  const facilitiesHoverController = shallowRef<FacilitiesHoverController | null>(null);
  const measureController = shallowRef<MeasureLayerController | null>(null);
  const disposeBasemapEnhancements = shallowRef<(() => void) | null>(null);
  const mapControls = shallowRef<readonly IControl[]>([]);
  const facilitiesStatus = shallowRef<PerspectiveStatusState>(initialPerspectiveStatusState());
  const visiblePerspectives = shallowRef<PerspectiveVisibilityState>(
    initialPerspectiveVisibilityState()
  );
  const measureState = shallowRef<MeasureState>(initialMeasureState());

  const areFacilityInteractionsEnabled = computed(() => measureState.value.mode === "off");
  const colocationStatusText = computed(() => formatFacilitiesStatus(facilitiesStatus.value.colocation));
  const hyperscaleStatusText = computed(() => formatFacilitiesStatus(facilitiesStatus.value.hyperscale));

  const facilityDetailQuery = useFacilityDetailQuery(selectedFacility);

  function isSamePerspective(
    selected: SelectedFacilityRef | null,
    perspective: FacilityPerspective
  ): boolean {
    if (selected === null) {
      return false;
    }

    return selected.perspective === perspective;
  }

  function setPerspectiveVisibility(perspective: FacilityPerspective, visible: boolean): void {
    visiblePerspectives.value = {
      ...visiblePerspectives.value,
      [perspective]: visible,
    };

    for (const controller of facilitiesControllers.value) {
      if (controller.perspective === perspective) {
        controller.setVisible(visible);
      }
    }
  }

  function setPerspectiveStatus(perspective: FacilityPerspective, status: FacilitiesStatus): void {
    facilitiesStatus.value = {
      ...facilitiesStatus.value,
      [perspective]: status,
    };
  }

  function clearSelectedFacility(): void {
    for (const controller of facilitiesControllers.value) {
      controller.clearSelection();
    }
    selectedFacility.value = null;
  }

  function mountPerspectiveLayer(
    nextMap: IMap,
    nextControllers: FacilitiesLayerController[],
    perspective: FacilityPerspective
  ): void {
    const controller = mountFacilitiesLayer(nextMap, {
      perspective,
      isInteractionEnabled: () => areFacilityInteractionsEnabled.value,
      onStatus: (status) => {
        setPerspectiveStatus(perspective, status);
      },
      onSelectFacility: (facility) => {
        if (facility === null) {
          if (isSamePerspective(selectedFacility.value, perspective)) {
            selectedFacility.value = null;
          }
          return;
        }

        selectedFacility.value = facility;
        for (const existingController of nextControllers) {
          if (existingController !== controller) {
            existingController.clearSelection();
          }
        }
      },
    });

    controller.setVisible(visiblePerspectives.value[perspective]);
    nextControllers.push(controller);
  }

  function mountMapControls(nextMap: IMap): readonly IControl[] {
    const navigationControl = new maplibregl.NavigationControl({
      showCompass: true,
      showZoom: true,
    });
    const scaleControl = new maplibregl.ScaleControl({ maxWidth: 140, unit: "imperial" });
    const fullscreenControl = new maplibregl.FullscreenControl();

    const controls: IControl[] = [navigationControl, scaleControl, fullscreenControl];

    nextMap.addControl(navigationControl, "top-right");
    nextMap.addControl(scaleControl, "bottom-right");
    nextMap.addControl(fullscreenControl, "top-right");

    return controls;
  }

  function setMeasureMode(mode: MeasureMode): void {
    measureController.value?.setMode(mode);
  }

  function clearMeasure(): void {
    measureController.value?.clear();
  }

  function initializeMap(): void {
    const container = mapContainer.value;
    if (!container) {
      return;
    }

    const nextMap = createMap(createMapLibreAdapter(), container, {
      style: defaultBasemapStyleUrl(),
      center: [-98.5795, 39.8283],
      zoom: 4,
    });

    map.value = nextMap;
    disposeBasemapEnhancements.value = mountBasemap3DBuildings(nextMap);
    mapControls.value = mountMapControls(nextMap);

    const nextControllers: FacilitiesLayerController[] = [];
    mountPerspectiveLayer(nextMap, nextControllers, "colocation");
    mountPerspectiveLayer(nextMap, nextControllers, "hyperscale");
    facilitiesControllers.value = nextControllers;

    facilitiesHoverController.value = mountFacilitiesHover(nextMap, {
      perspectives: ["colocation", "hyperscale"],
      isInteractionEnabled: () => areFacilityInteractionsEnabled.value,
      onHoverChange: (nextHover) => {
        hoveredFacility.value = nextHover;
      },
    });

    measureController.value = mountMeasureLayer(nextMap, {
      onStateChange: (nextState) => {
        measureState.value = nextState;
      },
    });
  }

  watch(
    () => measureState.value.mode,
    (mode) => {
      if (mode === "off") {
        return;
      }

      clearSelectedFacility();
      facilitiesHoverController.value?.clear();
      hoveredFacility.value = null;
    }
  );

  onMounted(() => {
    try {
      initializeMap();
    } catch (error: unknown) {
      console.error("Map initialization failed", error);
    }
  });

  onBeforeUnmount(() => {
    disposeBasemapEnhancements.value?.();
    disposeBasemapEnhancements.value = null;

    facilitiesHoverController.value?.destroy();
    facilitiesHoverController.value = null;

    measureController.value?.destroy();
    measureController.value = null;

    for (const controller of facilitiesControllers.value) {
      controller.destroy();
    }
    facilitiesControllers.value = [];

    const currentMap = map.value;
    if (currentMap !== null) {
      for (const control of mapControls.value) {
        currentMap.removeControl(control);
      }
    }
    mapControls.value = [];

    currentMap?.destroy();
    map.value = null;
  });
</script>

<template>
  <main class="h-full w-full">
    <section ref="map-container" class="relative h-full w-full" aria-label="Map preview">
      <FacilitiesControls
        :colocation-visible="visiblePerspectives.colocation"
        :hyperscale-visible="visiblePerspectives.hyperscale"
        :colocation-status="colocationStatusText"
        :hyperscale-status="hyperscaleStatusText"
        @update:colocation-visible="setPerspectiveVisibility('colocation', $event)"
        @update:hyperscale-visible="setPerspectiveVisibility('hyperscale', $event)"
      />

      <MeasureToolbar :state="measureState" @set-mode="setMeasureMode" @clear="clearMeasure" />

      <FacilityHoverTooltip :hover-state="hoveredFacility" />

      <FacilityDetailDrawer
        :selected-facility="selectedFacility"
        :detail="facilityDetailQuery.data.value ?? null"
        :is-loading="facilityDetailQuery.isLoading.value"
        :is-error="facilityDetailQuery.isError.value"
        @close="clearSelectedFacility"
      />
    </section>
  </main>
</template>
