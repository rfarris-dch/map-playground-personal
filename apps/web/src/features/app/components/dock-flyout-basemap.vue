<script setup lang="ts">
  import Switch from "@/components/ui/switch/switch.vue";
  import type { BoundaryVisibilityState } from "@/features/app/core/app-shell.types";
  import type { BasemapLayerId, BasemapVisibilityState } from "@/features/basemap/basemap.types";
  import type { BoundaryLayerId } from "@/features/boundaries/boundaries.types";

  interface DockFlyoutBasemapProps {
    readonly basemapVisibility: BasemapVisibilityState;
    readonly boundaryHeatEnabled: Record<BoundaryLayerId, boolean>;
    readonly boundaryVisibility: BoundaryVisibilityState;
  }

  interface DockFlyoutBasemapEmits {
    "update:basemap-layer-color": [targetLayer: string, color: string];
    "update:basemap-layer-visible": [layerId: BasemapLayerId, visible: boolean];
    "update:boundary-heat": [boundaryId: BoundaryLayerId, enabled: boolean];
    "update:boundary-visible": [boundaryId: BoundaryLayerId, visible: boolean];
  }

  const props = defineProps<DockFlyoutBasemapProps>();
  const emit = defineEmits<DockFlyoutBasemapEmits>();

  const basemapLayers: readonly { id: BasemapLayerId; label: string }[] = [
    { id: "color", label: "Color Map" },
    { id: "globe", label: "Globe" },
    { id: "satellite", label: "Satellite" },
    { id: "terrain", label: "Terrain" },
    { id: "buildings3d", label: "3D Buildings" },
    { id: "labels", label: "Labels" },
    { id: "roads", label: "Roads" },
    { id: "landmarks", label: "Landmarks" },
  ];

  const boundaryLayers: readonly { id: BoundaryLayerId; label: string }[] = [
    { id: "state", label: "State Lines" },
    { id: "county", label: "County Lines" },
  ];

  const colorTargets = [
    {
      id: "water",
      label: "Water",
      colors: [
        "#d4e6f1",
        "#aed6f1",
        "#85c1e9",
        "#5dade2",
        "#3498db",
        "#2e86c1",
        "#2471a3",
        "#1a5276",
      ],
    },
    {
      id: "road",
      label: "Roads",
      colors: [
        "#f5f5f5",
        "#e8e8e8",
        "#d5d8dc",
        "#b2babb",
        "#f5e6cc",
        "#edbb99",
        "#d4ac6e",
        "#808b96",
      ],
    },
    {
      id: "land",
      label: "Land",
      colors: [
        "#fdfefe",
        "#f9f3ee",
        "#f5ecd7",
        "#e8e0d0",
        "#e8f8f5",
        "#d5f5e3",
        "#d4e6f1",
        "#d7dbdd",
      ],
    },
  ] as const;

  function toggleLayer(id: BasemapLayerId): void {
    emit("update:basemap-layer-visible", id, !props.basemapVisibility[id]);
  }
</script>

<template>
  <div class="flex flex-col gap-3">
    <div data-flyout-section class="grid grid-cols-3 gap-1">
      <span
        v-for="layer in basemapLayers"
        :key="layer.id"
        role="button"
        tabindex="0"
        class="flex h-8 cursor-pointer items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors select-none"
        :class="props.basemapVisibility[layer.id]
          ? 'border-primary/60 bg-primary/12 text-foreground/90 font-semibold'
          : 'border-border bg-transparent text-foreground/55 hover:bg-black/[0.05]'"
        @click="toggleLayer(layer.id)"
        @keydown.enter="toggleLayer(layer.id)"
      >
        {{ layer.label }}
      </span>
    </div>

    <div class="h-px bg-border/40" />

    <div data-flyout-section>
      <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50"
        >Boundaries</span
      >
      <div v-for="boundary in boundaryLayers" :key="boundary.id" class="mt-1">
        <div class="flex items-center justify-between">
          <span
            class="text-xs font-medium"
            :class="props.boundaryVisibility[boundary.id] ? 'text-foreground/80' : 'text-foreground/50'"
            >{{ boundary.label }}</span
          >
          <Switch
            :checked="props.boundaryVisibility[boundary.id]"
            :aria-label="`${props.boundaryVisibility[boundary.id] ? 'Hide' : 'Show'} ${boundary.label}`"
            @update:checked="emit('update:boundary-visible', boundary.id, $event)"
          />
        </div>
        <div
          v-if="props.boundaryVisibility[boundary.id]"
          class="mt-0.5 flex items-center justify-between pl-3"
        >
          <span class="text-[11px] text-foreground/45">Power heatmap</span>
          <Switch
            :checked="props.boundaryHeatEnabled[boundary.id]"
            :aria-label="`${props.boundaryHeatEnabled[boundary.id] ? 'Disable' : 'Enable'} power heating for ${boundary.label}`"
            @update:checked="emit('update:boundary-heat', boundary.id, $event)"
          />
        </div>
      </div>
    </div>

    <div class="h-px bg-border/40" />

    <div data-flyout-section>
      <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50"
        >Layer Colors</span
      >
      <div v-for="target in colorTargets" :key="target.id" class="mt-1.5 flex items-center gap-2">
        <span class="w-12 text-xs text-muted-foreground">{{ target.label }}</span>
        <div class="flex gap-1">
          <span
            v-for="color in target.colors"
            :key="color"
            role="button"
            tabindex="0"
            class="h-4 w-4 cursor-pointer rounded-sm border border-border transition-shadow hover:shadow-md"
            :style="{ backgroundColor: color }"
            :aria-label="`Set ${target.label} color to ${color}`"
            @click="emit('update:basemap-layer-color', target.id, color)"
            @keydown.enter="emit('update:basemap-layer-color', target.id, color)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
