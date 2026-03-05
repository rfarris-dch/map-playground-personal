<script setup lang="ts">
  import { computed, ref } from "vue";
  import type {
    FiberLocatorLineId,
    FiberLocatorSourceLayerOption,
  } from "@/features/fiber-locator/fiber-locator.types";

  interface FiberLocatorControlsProps {
    readonly embedded?: boolean;
    readonly longhaulSourceLayers: readonly FiberLocatorSourceLayerOption[];
    readonly longhaulVisible: boolean;
    readonly metroSourceLayers: readonly FiberLocatorSourceLayerOption[];
    readonly metroVisible: boolean;
    readonly selectedLonghaulSourceLayerNames: readonly string[];
    readonly selectedMetroSourceLayerNames: readonly string[];
    readonly status: string;
  }

  const props = withDefaults(defineProps<FiberLocatorControlsProps>(), {
    embedded: false,
  });
  const searchQuery = ref("");

  const emit = defineEmits<{
    "update:longhaulVisible": [value: boolean];
    "update:metroVisible": [value: boolean];
    setAllSourceLayers: [lineId: FiberLocatorLineId, visible: boolean];
    toggleSourceLayer: [lineId: FiberLocatorLineId, layerName: string, visible: boolean];
  }>();

  const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase());
  const selectedMetroSourceLayers = computed(
    () => new Set(props.selectedMetroSourceLayerNames.map((layerName) => layerName.toLowerCase()))
  );
  const selectedLonghaulSourceLayers = computed(
    () =>
      new Set(props.selectedLonghaulSourceLayerNames.map((layerName) => layerName.toLowerCase()))
  );

  const filteredMetroSourceLayers = computed(() => {
    const query = normalizedSearchQuery.value;
    if (query.length === 0) {
      return props.metroSourceLayers;
    }

    return props.metroSourceLayers.filter((layer) => {
      const label = layer.label.toLowerCase();
      const layerName = layer.layerName.toLowerCase();
      return label.includes(query) || layerName.includes(query);
    });
  });

  const filteredLonghaulSourceLayers = computed(() => {
    const query = normalizedSearchQuery.value;
    if (query.length === 0) {
      return props.longhaulSourceLayers;
    }

    return props.longhaulSourceLayers.filter((layer) => {
      const label = layer.label.toLowerCase();
      const layerName = layer.layerName.toLowerCase();
      return label.includes(query) || layerName.includes(query);
    });
  });

  const totalSourceLayerCount = computed(
    () => props.metroSourceLayers.length + props.longhaulSourceLayers.length
  );
  const containerClass = computed(() =>
    props.embedded
      ? "w-full"
      : "w-full rounded-lg border border-border/90 bg-card/95 p-3 shadow-lg backdrop-blur-sm"
  );

  function onToggleMetro(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    emit("update:metroVisible", target.checked);
  }

  function onToggleLonghaul(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    emit("update:longhaulVisible", target.checked);
  }

  function onToggleSourceLayer(lineId: FiberLocatorLineId, layerName: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    emit("toggleSourceLayer", lineId, layerName, target.checked);
  }

  function isSourceLayerSelected(lineId: FiberLocatorLineId, layerName: string): boolean {
    const normalizedLayerName = layerName.toLowerCase();
    if (lineId === "metro") {
      return selectedMetroSourceLayers.value.has(normalizedLayerName);
    }

    return selectedLonghaulSourceLayers.value.has(normalizedLayerName);
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Fiber layers">
    <header v-if="!props.embedded" class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-xs font-semibold tracking-wide">Fiber Locator</h2>
      <span class="text-[11px] text-muted-foreground">Vector tiles</span>
    </header>

    <p class="mb-2 break-words text-[11px] font-mono text-muted-foreground">{{ props.status }}</p>

    <div class="grid gap-2">
      <label class="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 p-2">
        <input
          class="mt-0.5 h-4 w-4"
          type="checkbox"
          :checked="props.metroVisible"
          @change="onToggleMetro"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-[#ec4899]" aria-hidden="true" />
            <span class="text-xs font-medium">Metro</span>
          </div>
          <p class="mt-1 break-words text-[11px] text-muted-foreground">Composite metro network</p>
        </div>
      </label>

      <label class="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 p-2">
        <input
          class="mt-0.5 h-4 w-4"
          type="checkbox"
          :checked="props.longhaulVisible"
          @change="onToggleLonghaul"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-[#06b6d4]" aria-hidden="true" />
            <span class="text-xs font-medium">Longhaul</span>
          </div>
          <p class="mt-1 break-words text-[11px] text-muted-foreground">
            Composite longhaul network
          </p>
        </div>
      </label>
    </div>

    <div class="mt-2 rounded-md border border-border/70 p-2">
      <div class="mb-2 flex items-center justify-between">
        <h3 class="m-0 text-[11px] font-semibold tracking-wide">
          Fiber ({{ totalSourceLayerCount }})
        </h3>
        <span class="text-[10px] text-muted-foreground">Selectable + filterable</span>
      </div>

      <input
        v-model="searchQuery"
        type="text"
        placeholder="Filter fiber lines..."
        class="mb-2 w-full rounded border border-border/70 bg-background/80 px-2 py-1 text-[11px] leading-5 outline-none focus:border-primary"
      >

      <div class="grid gap-2">
        <section class="rounded border border-border/70 p-2">
          <div class="mb-1 flex items-center justify-between">
            <h4 class="m-0 text-[11px] font-semibold">
              Metro ({{ filteredMetroSourceLayers.length }})
            </h4>
            <div class="flex items-center gap-2 text-[10px]">
              <button
                type="button"
                class="text-primary hover:underline"
                @click="emit('setAllSourceLayers', 'metro', true)"
              >
                All
              </button>
              <button
                type="button"
                class="text-primary hover:underline"
                @click="emit('setAllSourceLayers', 'metro', false)"
              >
                None
              </button>
            </div>
          </div>

          <div class="max-h-40 overflow-auto pr-1">
            <label
              v-for="layer in filteredMetroSourceLayers"
              :key="layer.layerName"
              class="mb-1 flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-[11px] hover:bg-muted/40"
            >
              <input
                class="mt-0.5 h-3.5 w-3.5"
                type="checkbox"
                :checked="isSourceLayerSelected('metro', layer.layerName)"
                @change="onToggleSourceLayer('metro', layer.layerName, $event)"
              >
              <span
                class="mt-[6px] h-[3px] w-4 rounded-full"
                :style="{ backgroundColor: layer.color ?? '#ec4899' }"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1 truncate text-[11px]">{{ layer.label }}</span>
            </label>
            <p
              v-if="filteredMetroSourceLayers.length === 0"
              class="m-0 px-1 py-1 text-[11px] text-muted-foreground"
            >
              No metro lines match this filter.
            </p>
          </div>
        </section>

        <section class="rounded border border-border/70 p-2">
          <div class="mb-1 flex items-center justify-between">
            <h4 class="m-0 text-[11px] font-semibold">
              Longhaul ({{ filteredLonghaulSourceLayers.length }})
            </h4>
            <div class="flex items-center gap-2 text-[10px]">
              <button
                type="button"
                class="text-primary hover:underline"
                @click="emit('setAllSourceLayers', 'longhaul', true)"
              >
                All
              </button>
              <button
                type="button"
                class="text-primary hover:underline"
                @click="emit('setAllSourceLayers', 'longhaul', false)"
              >
                None
              </button>
            </div>
          </div>

          <div class="max-h-40 overflow-auto pr-1">
            <label
              v-for="layer in filteredLonghaulSourceLayers"
              :key="layer.layerName"
              class="mb-1 flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-[11px] hover:bg-muted/40"
            >
              <input
                class="mt-0.5 h-3.5 w-3.5"
                type="checkbox"
                :checked="isSourceLayerSelected('longhaul', layer.layerName)"
                @change="onToggleSourceLayer('longhaul', layer.layerName, $event)"
              >
              <span
                class="mt-[6px] h-[3px] w-4 rounded-full"
                :style="{ backgroundColor: layer.color ?? '#06b6d4' }"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1 truncate text-[11px]">{{ layer.label }}</span>
            </label>
            <p
              v-if="filteredLonghaulSourceLayers.length === 0"
              class="m-0 px-1 py-1 text-[11px] text-muted-foreground"
            >
              No longhaul lines match this filter.
            </p>
          </div>
        </section>
      </div>
    </div>
  </aside>
</template>
