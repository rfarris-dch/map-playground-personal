<script setup lang="ts">
  import Checkbox from "@/components/ui/checkbox/checkbox.vue";
  import Switch from "@/components/ui/switch/switch.vue";
  import type {
    FiberSourceLayerOptionsState,
    FiberSourceLayerSelectionState,
    FiberVisibilityState,
  } from "@/features/app/core/app-shell.types";
  import type { FiberLocatorLineId } from "@/features/fiber-locator/fiber-locator.types";

  interface DockFlyoutFiberProps {
    readonly fiberSourceLayerOptions: FiberSourceLayerOptionsState;
    readonly selectedFiberSourceLayerNames: FiberSourceLayerSelectionState;
    readonly visibleFiberLayers: FiberVisibilityState;
  }

  interface DockFlyoutFiberEmits {
    "toggle-source-layer": [lineId: FiberLocatorLineId, layerName: string, visible: boolean];
    "update:fiber-line-visible": [lineId: FiberLocatorLineId, visible: boolean];
  }

  const props = defineProps<DockFlyoutFiberProps>();
  const emit = defineEmits<DockFlyoutFiberEmits>();

  function isSourceSelected(lineId: FiberLocatorLineId, layerName: string): boolean {
    const selected =
      lineId === "metro"
        ? props.selectedFiberSourceLayerNames.metro
        : props.selectedFiberSourceLayerNames.longhaul;
    return selected.some((n) => n.toLowerCase() === layerName.toLowerCase());
  }

  function toggleSource(lineId: FiberLocatorLineId, layerName: string): void {
    emit("toggle-source-layer", lineId, layerName, !isSourceSelected(lineId, layerName));
  }
</script>

<template>
  <div class="flyout-sections flex flex-col">
    <div data-flyout-section>
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-foreground/50">Metro</span>
        <Switch
          :checked="props.visibleFiberLayers.metro"
          aria-label="Toggle metro fiber"
          @update:checked="emit('update:fiber-line-visible', 'metro', $event)"
        />
      </div>
      <p
        v-if="props.fiberSourceLayerOptions.metro.length === 0 && props.visibleFiberLayers.metro"
        class="mt-1 text-center text-xs text-muted-foreground animate-pulse"
      >
        Loading metro sources...
      </p>
      <div
        v-if="props.fiberSourceLayerOptions.metro.length > 0 && props.visibleFiberLayers.metro"
        class="mt-1 flex flex-col gap-0.5 pl-3"
      >
        <label
          v-for="layer in props.fiberSourceLayerOptions.metro"
          :key="layer.layerName"
          class="flex cursor-pointer items-center gap-2 py-0.5"
        >
          <Checkbox
            :checked="isSourceSelected('metro', layer.layerName)"
            @update:checked="toggleSource('metro', layer.layerName)"
          />
          <span class="min-w-0 flex-1 truncate text-[10px] text-foreground/50"
            >{{ layer.label }}</span
          >
          <span
            v-if="layer.color"
            class="h-[2px] w-5 shrink-0 rounded-full"
            :style="{ backgroundColor: layer.color }"
            aria-hidden="true"
          />
        </label>
      </div>
    </div>

    <div data-flyout-section>
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-foreground/50">Long Haul</span>
        <Switch
          :checked="props.visibleFiberLayers.longhaul"
          aria-label="Toggle longhaul fiber"
          @update:checked="emit('update:fiber-line-visible', 'longhaul', $event)"
        />
      </div>
      <p
        v-if="props.fiberSourceLayerOptions.longhaul.length === 0 && props.visibleFiberLayers.longhaul"
        class="mt-1 text-center text-xs text-muted-foreground animate-pulse"
      >
        Loading longhaul sources...
      </p>
      <div
        v-if="props.fiberSourceLayerOptions.longhaul.length > 0 && props.visibleFiberLayers.longhaul"
        class="mt-1 flex flex-col gap-0.5 pl-3"
      >
        <label
          v-for="layer in props.fiberSourceLayerOptions.longhaul"
          :key="layer.layerName"
          class="flex cursor-pointer items-center gap-2 py-0.5"
        >
          <Checkbox
            :checked="isSourceSelected('longhaul', layer.layerName)"
            @update:checked="toggleSource('longhaul', layer.layerName)"
          />
          <span class="min-w-0 flex-1 truncate text-[10px] text-foreground/50"
            >{{ layer.label }}</span
          >
          <span
            v-if="layer.color"
            class="h-[2px] w-5 shrink-0 rounded-full"
            :style="{ backgroundColor: layer.color }"
            aria-hidden="true"
          />
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .flyout-sections > * {
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }

  .flyout-sections > *:first-child {
    padding-top: 0;
  }

  .flyout-sections > *:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }
</style>
