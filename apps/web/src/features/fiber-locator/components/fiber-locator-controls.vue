<script setup lang="ts">
  import { computed, ref } from "vue";
  import LayerControlsPanel from "@/components/map/layer-controls-panel.vue";
  import VisibilityToggleRow from "@/components/map/visibility-toggle-row.vue";
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

  function isSourceLayerSelected(lineId: FiberLocatorLineId, layerName: string): boolean {
    const normalizedLayerName = layerName.toLowerCase();
    if (lineId === "metro") {
      return selectedMetroSourceLayers.value.has(normalizedLayerName);
    }

    return selectedLonghaulSourceLayers.value.has(normalizedLayerName);
  }

  function sourceLayerRowClass(selected: boolean): string {
    if (selected) {
      return "border-border bg-background";
    }

    return "border-transparent hover:border-border hover:bg-background";
  }

  function onToggleSourceLayer(lineId: FiberLocatorLineId, layerName: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    emit("toggleSourceLayer", lineId, layerName, target.checked);
  }
</script>

<template>
  <LayerControlsPanel
    ariaLabel="Fiber layers"
    :embedded="props.embedded"
    title="Fiber Locator"
    subtitle="Vector tiles"
  >
    <p class="mb-2 break-words text-xs text-muted-foreground">{{ props.status }}</p>

    <div class="grid gap-2">
      <VisibilityToggleRow
        :checked="props.metroVisible"
        title="Metro"
        description="Composite metro network"
        dot-class="bg-pink-500"
        @update:checked="emit('update:metroVisible', $event)"
      />
      <VisibilityToggleRow
        :checked="props.longhaulVisible"
        title="Longhaul"
        description="Composite longhaul network"
        dot-class="bg-cyan-500"
        @update:checked="emit('update:longhaulVisible', $event)"
      />
    </div>

    <input
      v-model="searchQuery"
      type="text"
      placeholder="Filter fiber lines..."
      class="mt-2 h-[22px] w-full rounded-sm border border-border bg-card px-2 text-xs leading-5 text-muted-foreground outline-none placeholder:text-border focus-visible:border-border focus-visible:ring-2 focus-visible:ring-border"
    >

    <p
      v-if="totalSourceLayerCount === 0"
      class="py-3 text-center text-xs text-muted-foreground animate-pulse"
    >
      Loading fiber sources...
    </p>

    <section v-if="props.metroVisible" class="mt-2">
      <div class="mb-1 flex items-center justify-between">
        <h3 class="m-0 text-xs font-semibold text-muted-foreground">
          Metro ({{ filteredMetroSourceLayers.length }})
        </h3>
        <div class="flex items-center gap-2 text-xs">
          <button
            type="button"
            class="h-[22px] rounded-sm border border-border bg-card px-2 text-xs font-normal text-muted-foreground shadow-sm transition-colors hover:border-border hover:bg-background hover:text-foreground/70"
            @click="emit('setAllSourceLayers', 'metro', true)"
          >
            All
          </button>
          <button
            type="button"
            class="h-[22px] rounded-sm border border-border bg-card px-2 text-xs font-normal text-muted-foreground shadow-sm transition-colors hover:border-border hover:bg-background hover:text-foreground/70"
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
          class="mb-1 flex cursor-pointer items-start gap-2 rounded-sm border px-1 py-1 text-xs transition-colors"
          :class="sourceLayerRowClass(isSourceLayerSelected('metro', layer.layerName))"
        >
          <input
            class="h-4 w-4 shrink-0 rounded-sm border border-border accent-muted-foreground"
            type="checkbox"
            :checked="isSourceLayerSelected('metro', layer.layerName)"
            @change="onToggleSourceLayer('metro', layer.layerName, $event)"
          >
          <span class="mt-1.5 h-0.5 w-4 rounded-full bg-pink-500" aria-hidden="true" />
          <span
            class="min-w-0 flex-1 truncate text-xs transition-colors"
            :class="
              isSourceLayerSelected('metro', layer.layerName)
                ? 'font-medium text-foreground/70'
                : 'text-muted-foreground'
            "
          >
            {{ layer.label }}
          </span>
        </label>
        <p
          v-if="filteredMetroSourceLayers.length === 0"
          class="m-0 px-1 py-1 text-xs text-muted-foreground"
        >
          No metro lines match this filter.
        </p>
      </div>
    </section>

    <section v-if="props.longhaulVisible" class="mt-2">
      <div class="mb-1 flex items-center justify-between">
        <h3 class="m-0 text-xs font-semibold text-muted-foreground">
          Longhaul ({{ filteredLonghaulSourceLayers.length }})
        </h3>
        <div class="flex items-center gap-2 text-xs">
          <button
            type="button"
            class="h-[22px] rounded-sm border border-border bg-card px-2 text-xs font-normal text-muted-foreground shadow-sm transition-colors hover:border-border hover:bg-background hover:text-foreground/70"
            @click="emit('setAllSourceLayers', 'longhaul', true)"
          >
            All
          </button>
          <button
            type="button"
            class="h-[22px] rounded-sm border border-border bg-card px-2 text-xs font-normal text-muted-foreground shadow-sm transition-colors hover:border-border hover:bg-background hover:text-foreground/70"
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
          class="mb-1 flex cursor-pointer items-start gap-2 rounded-sm border px-1 py-1 text-xs transition-colors"
          :class="sourceLayerRowClass(isSourceLayerSelected('longhaul', layer.layerName))"
        >
          <input
            class="h-4 w-4 shrink-0 rounded-sm border border-border accent-muted-foreground"
            type="checkbox"
            :checked="isSourceLayerSelected('longhaul', layer.layerName)"
            @change="onToggleSourceLayer('longhaul', layer.layerName, $event)"
          >
          <span class="mt-1.5 h-0.5 w-4 rounded-full bg-cyan-500" aria-hidden="true" />
          <span
            class="min-w-0 flex-1 truncate text-xs transition-colors"
            :class="
              isSourceLayerSelected('longhaul', layer.layerName)
                ? 'font-medium text-foreground/70'
                : 'text-muted-foreground'
            "
          >
            {{ layer.label }}
          </span>
        </label>
        <p
          v-if="filteredLonghaulSourceLayers.length === 0"
          class="m-0 px-1 py-1 text-xs text-muted-foreground"
        >
          No longhaul lines match this filter.
        </p>
      </div>
    </section>
  </LayerControlsPanel>
</template>
