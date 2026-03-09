<script setup lang="ts">
  import { computed } from "vue";
  import type { BasemapLayerId } from "@/features/basemap/basemap.types";

  interface BasemapControlsProps {
    readonly boundariesVisible: boolean;
    readonly buildings3dVisible: boolean;
    readonly colorVisible: boolean;
    readonly embedded?: boolean;
    readonly globeVisible: boolean;
    readonly labelsVisible: boolean;
    readonly landmarksVisible: boolean;
    readonly roadsVisible: boolean;
    readonly satelliteVisible: boolean;
  }

  interface BasemapControlOption {
    readonly color: string;
    readonly description: string;
    readonly label: string;
    readonly layerId: BasemapLayerId;
  }

  const props = withDefaults(defineProps<BasemapControlsProps>(), {
    embedded: false,
  });

  const emit = defineEmits<{
    "update:boundariesVisible": [value: boolean];
    "update:buildings3dVisible": [value: boolean];
    "update:colorVisible": [value: boolean];
    "update:globeVisible": [value: boolean];
    "update:labelsVisible": [value: boolean];
    "update:landmarksVisible": [value: boolean];
    "update:roadsVisible": [value: boolean];
    "update:satelliteVisible": [value: boolean];
  }>();

  const containerClass = computed(() =>
    props.embedded ? "w-full" : "map-glass-panel w-full rounded-lg p-3"
  );

  const controls = computed<readonly BasemapControlOption[]>(() => {
    return [
      {
        layerId: "color",
        label: "Color Basemap",
        description: "Colored vector basemap style, not satellite imagery",
        color: "#16a34a",
      },
      {
        layerId: "globe",
        label: "Globe Projection",
        description: "Spherical map view you can use with any basemap color mode",
        color: "#7c3aed",
      },
      {
        layerId: "satellite",
        label: "Satellite",
        description: "Imagery raster base below roads and labels",
        color: "#0369a1",
      },
      {
        layerId: "landmarks",
        label: "Landmarks",
        description: "POI and mountain peak labels from vector tiles",
        color: "#0f766e",
      },
      {
        layerId: "labels",
        label: "Place Labels",
        description: "City, state, country, and road labels",
        color: "#334155",
      },
      {
        layerId: "roads",
        label: "Road Network",
        description: "Transportation geometry layers",
        color: "#a16207",
      },
      {
        layerId: "boundaries",
        label: "Basemap Boundaries",
        description: "Country and boundary lines from basemap",
        color: "#7c2d12",
      },
      {
        layerId: "buildings3d",
        label: "3D Buildings",
        description: "Extruded building footprints (zoom 15+)",
        color: "#57534e",
      },
    ];
  });

  function visibleForLayer(layerId: BasemapLayerId): boolean {
    if (layerId === "boundaries") {
      return props.boundariesVisible;
    }

    if (layerId === "buildings3d") {
      return props.buildings3dVisible;
    }

    if (layerId === "color") {
      return props.colorVisible;
    }

    if (layerId === "globe") {
      return props.globeVisible;
    }

    if (layerId === "labels") {
      return props.labelsVisible;
    }

    if (layerId === "landmarks") {
      return props.landmarksVisible;
    }

    if (layerId === "roads") {
      return props.roadsVisible;
    }

    return props.satelliteVisible;
  }

  function emitVisibility(layerId: BasemapLayerId, visible: boolean): void {
    if (layerId === "boundaries") {
      emit("update:boundariesVisible", visible);
      return;
    }

    if (layerId === "buildings3d") {
      emit("update:buildings3dVisible", visible);
      return;
    }

    if (layerId === "color") {
      emit("update:colorVisible", visible);
      return;
    }

    if (layerId === "globe") {
      emit("update:globeVisible", visible);
      return;
    }

    if (layerId === "labels") {
      emit("update:labelsVisible", visible);
      return;
    }

    if (layerId === "landmarks") {
      emit("update:landmarksVisible", visible);
      return;
    }

    if (layerId === "roads") {
      emit("update:roadsVisible", visible);
      return;
    }

    emit("update:satelliteVisible", visible);
  }

  function onToggle(layerId: BasemapLayerId, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    emitVisibility(layerId, target.checked);
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Basemap layers">
    <header v-if="!props.embedded" class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-xs font-semibold tracking-wide">Basemap</h2>
      <span class="text-[11px] text-muted-foreground">MapLibre style layer controls</span>
    </header>

    <div class="grid gap-2">
      <label
        v-for="control in controls"
        :key="control.layerId"
        class="map-glass-card flex cursor-pointer items-start gap-3 rounded-md p-2"
      >
        <input
          class="mt-0.5 h-4 w-4"
          type="checkbox"
          :checked="visibleForLayer(control.layerId)"
          @change="onToggle(control.layerId, $event)"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span
              class="h-2.5 w-2.5 rounded-full"
              :style="{ backgroundColor: control.color }"
              aria-hidden="true"
            />
            <span class="text-xs font-medium">{{ control.label }}</span>
          </div>
          <p class="mt-1 break-words text-[11px] text-muted-foreground">
            {{ control.description }}
          </p>
        </div>
      </label>
    </div>
  </aside>
</template>
