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
      ? "w-full [font-family:Inter,var(--font-sans)] text-[#94A3B8]"
      : "w-full rounded-[4px] border border-[#E2E8F0] bg-white p-3 shadow-[0_4px_8px_rgba(0,0,0,0.06)] [font-family:Inter,var(--font-sans)] text-[#94A3B8]"
  );

  const controls = computed<readonly BasemapControlOption[]>(() => {
    return [
      {
        layerId: "color",
        label: "Color Basemap",
        description: "Colored vector basemap style, not satellite imagery",
        dotClass: "bg-[#16A34A]",
      },
      {
        layerId: "globe",
        label: "Globe Projection",
        description: "Spherical map view you can use with any basemap color mode",
        dotClass: "bg-[#7C3AED]",
      },
      {
        layerId: "satellite",
        label: "Satellite",
        description: "Imagery raster base below roads and labels",
        dotClass: "bg-[#0369A1]",
      },
      {
        layerId: "landmarks",
        label: "Landmarks",
        description: "POI and mountain peak labels from vector tiles",
        dotClass: "bg-[#0F766E]",
      },
      {
        layerId: "labels",
        label: "Place Labels",
        description: "City, state, country, and road labels",
        dotClass: "bg-[#334155]",
      },
      {
        layerId: "roads",
        label: "Road Network",
        description: "Transportation geometry layers",
        dotClass: "bg-[#A16207]",
      },
      {
        layerId: "boundaries",
        label: "Basemap Boundaries",
        description: "Country and boundary lines from basemap",
        dotClass: "bg-[#7C2D12]",
      },
      {
        layerId: "buildings3d",
        label: "3D Buildings",
        description: "Extruded building footprints (zoom 15+)",
        dotClass: "bg-[#57534E]",
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
      return "border-[#CBD5E1] bg-[#F8FAFC] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
    }

    return "border-transparent bg-white hover:border-[#E2E8F0] hover:bg-[#F8FAFC]";
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Basemap layers">
    <header v-if="!props.embedded" class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-[10px] font-semibold tracking-wide text-[#94A3B8]">Basemap</h2>
      <span class="text-[10px] text-[#94A3B8]">MapLibre style layer controls</span>
    </header>

    <div class="grid gap-2">
      <label
        v-for="control in controls"
        :key="control.layerId"
        class="group flex cursor-pointer items-start gap-2 rounded-[4px] border px-3 py-1 transition-colors"
        :class="rowClass(visibleForLayer(control.layerId))"
      >
        <input
          class="mt-[1px] h-[10px] w-[10px] rounded-[2px] border border-[#CBD5E1] accent-[#94A3B8]"
          type="checkbox"
          :checked="visibleForLayer(control.layerId)"
          @change="onToggle(control.layerId, $event)"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full" :class="control.dotClass" aria-hidden="true" />
            <span
              class="text-[10px] font-semibold transition-colors"
              :class="visibleForLayer(control.layerId) ? 'text-[#64748B]' : 'text-[#94A3B8]'"
              >{{ control.label }}</span
            >
          </div>
          <p
            class="mt-1 break-words text-[10px] transition-colors"
            :class="visibleForLayer(control.layerId) ? 'text-[#64748B]' : 'text-[#94A3B8]'"
          >
            {{ control.description }}
          </p>
        </div>
      </label>
    </div>
  </aside>
</template>
