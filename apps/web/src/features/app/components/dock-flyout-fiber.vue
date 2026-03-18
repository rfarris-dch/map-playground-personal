<script setup lang="ts">
  import Switch from "@/components/ui/switch/switch.vue";
  import type {
    FiberSourceLayerOptionsState,
    FiberSourceLayerSelectionState,
    FiberVisibilityState,
  } from "@/features/app/core/app-shell.types";
  import type { FiberLocatorLineId } from "@/features/fiber-locator/fiber-locator.types";

  interface DockFlyoutFiberProps {
    readonly visibleFiberLayers: FiberVisibilityState;
    readonly fiberSourceLayerOptions: FiberSourceLayerOptionsState;
    readonly selectedFiberSourceLayerNames: FiberSourceLayerSelectionState;
  }

  interface DockFlyoutFiberEmits {
    "update:fiber-line-visible": [lineId: FiberLocatorLineId, visible: boolean];
    "toggle-source-layer": [lineId: FiberLocatorLineId, layerName: string, visible: boolean];
  }

  const props = defineProps<DockFlyoutFiberProps>();
  const emit = defineEmits<DockFlyoutFiberEmits>();

  function isSourceSelected(lineId: FiberLocatorLineId, layerName: string): boolean {
    const selected = lineId === "metro"
      ? props.selectedFiberSourceLayerNames.metro
      : props.selectedFiberSourceLayerNames.longhaul;
    return selected.some((n) => n.toLowerCase() === layerName.toLowerCase());
  }

  function toggleSource(lineId: FiberLocatorLineId, layerName: string): void {
    emit("toggle-source-layer", lineId, layerName, !isSourceSelected(lineId, layerName));
  }
</script>

<template>
  <div class="flex flex-col gap-3">
    <div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full bg-pink-500" aria-hidden="true" />
          <span class="text-[13px] font-semibold text-foreground/90">Metro</span>
        </div>
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
        class="mt-1 flex flex-col gap-0.5 pl-4"
      >
        <label
          v-for="layer in props.fiberSourceLayerOptions.metro"
          :key="layer.layerName"
          class="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-black/[0.07]"
        >
          <span
            class="flex size-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors"
            :class="isSourceSelected('metro', layer.layerName)
              ? 'border-foreground/65 bg-foreground/65'
              : 'border-border bg-transparent'"
          >
            <svg
              v-if="isSourceSelected('metro', layer.layerName)"
              aria-hidden="true"
              class="size-2.5 text-white"
              viewBox="0 0 10 10"
              fill="none"
            >
              <path d="M2 5l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <span
            v-if="layer.color"
            class="h-[3px] w-3 rounded-full"
            :style="{ backgroundColor: layer.color }"
            aria-hidden="true"
          />
          <span
            class="min-w-0 flex-1 truncate text-xs leading-none"
            :class="isSourceSelected('metro', layer.layerName) ? 'text-foreground' : 'text-foreground/70'"
          >{{ layer.label }}</span>
          <input
            type="checkbox"
            class="sr-only"
            :checked="isSourceSelected('metro', layer.layerName)"
            @change="toggleSource('metro', layer.layerName)"
          >
        </label>
      </div>
    </div>

    <div class="h-px bg-border" />

    <div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full bg-colocation" aria-hidden="true" />
          <span class="text-[13px] font-semibold text-foreground/90">Longhaul</span>
        </div>
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
        class="mt-1 flex flex-col gap-0.5 pl-4"
      >
        <label
          v-for="layer in props.fiberSourceLayerOptions.longhaul"
          :key="layer.layerName"
          class="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-black/[0.07]"
        >
          <span
            class="flex size-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors"
            :class="isSourceSelected('longhaul', layer.layerName)
              ? 'border-foreground/65 bg-foreground/65'
              : 'border-border bg-transparent'"
          >
            <svg
              v-if="isSourceSelected('longhaul', layer.layerName)"
              aria-hidden="true"
              class="size-2.5 text-white"
              viewBox="0 0 10 10"
              fill="none"
            >
              <path d="M2 5l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <span
            v-if="layer.color"
            class="h-[3px] w-3 rounded-full"
            :style="{ backgroundColor: layer.color }"
            aria-hidden="true"
          />
          <span
            class="min-w-0 flex-1 truncate text-xs leading-none"
            :class="isSourceSelected('longhaul', layer.layerName) ? 'text-foreground' : 'text-foreground/70'"
          >{{ layer.label }}</span>
          <input
            type="checkbox"
            class="sr-only"
            :checked="isSourceSelected('longhaul', layer.layerName)"
            @change="toggleSource('longhaul', layer.layerName)"
          >
        </label>
      </div>
    </div>
  </div>
</template>
