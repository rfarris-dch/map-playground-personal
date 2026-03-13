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
    readonly description: string;
    readonly dotClass: string;
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
    props.embedded
      ? "w-full font-sans text-muted-foreground"
      : "w-full rounded-sm border border-border bg-card p-3 shadow-md font-sans text-muted-foreground"
  );

  const controls = computed<readonly BasemapControlOption[]>(() => {
    return [
      {
        layerId: "color",
        label: "Color Basemap",
        description: "Colored vector basemap style, not satellite imagery",
        dotClass: "bg-green-600",
      },
      {
        layerId: "globe",
        label: "Globe Projection",
        description: "Spherical map view you can use with any basemap color mode",
        dotClass: "bg-violet-600",
      },
      {
        layerId: "satellite",
        label: "Satellite",
        description: "Imagery raster base below roads and labels",
        dotClass: "bg-sky-700",
      },
      {
        layerId: "landmarks",
        label: "Landmarks",
        description: "POI and mountain peak labels from vector tiles",
        dotClass: "bg-teal-700",
      },
      {
        layerId: "labels",
        label: "Place Labels",
        description: "City, state, country, and road labels",
        dotClass: "bg-slate-700",
      },
      {
        layerId: "roads",
        label: "Road Network",
        description: "Transportation geometry layers",
        dotClass: "bg-yellow-700",
      },
      {
        layerId: "boundaries",
        label: "Basemap Boundaries",
        description: "Country and boundary lines from basemap",
        dotClass: "bg-orange-900",
      },
      {
        layerId: "buildings3d",
        label: "3D Buildings",
        description: "Extruded building footprints (zoom 15+)",
        dotClass: "bg-stone-600",
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

  function rowClass(visible: boolean): string {
    if (visible) {
      return "border-border bg-background shadow-sm";
    }

    return "border-transparent bg-card hover:border-border hover:bg-background";
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Basemap layers">
    <header v-if="!props.embedded" class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-xs font-semibold tracking-wide text-muted-foreground">Basemap</h2>
      <span class="text-xs text-muted-foreground">Style and projection</span>
    </header>

    <div class="grid gap-2" role="group" aria-label="Basemap layer toggles">
      <label
        v-for="control in controls"
        :key="control.layerId"
        class="group flex min-h-[44px] cursor-pointer items-start gap-2 rounded-sm border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-primary/40 focus-within:outline-none"
        :class="rowClass(visibleForLayer(control.layerId))"
      >
        <input
          class="h-4 w-4 shrink-0 rounded-sm border border-border accent-muted-foreground"
          type="checkbox"
          :checked="visibleForLayer(control.layerId)"
          @change="onToggle(control.layerId, $event)"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full" :class="control.dotClass" aria-hidden="true" />
            <span
              class="text-xs font-semibold transition-colors"
              :class="visibleForLayer(control.layerId) ? 'text-foreground/70' : 'text-muted-foreground'"
              >{{ control.label }}</span
            >
          </div>
          <p
            class="mt-1 break-words text-xs transition-colors"
            :class="visibleForLayer(control.layerId) ? 'text-foreground/70' : 'text-muted-foreground'"
          >
            {{ control.description }}
          </p>
        </div>
      </label>
    </div>
  </aside>
</template>
