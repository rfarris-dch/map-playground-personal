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
      ? "w-full font-sans text-muted-foreground"
      : "w-full rounded-sm border border-border bg-card p-3 shadow-[0_4px_8px_rgba(0,0,0,0.06)] font-sans text-muted-foreground"
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

  function rowClass(visible: boolean): string {
    if (visible) {
      return "border-border bg-background shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
    }

    return "border-transparent bg-card hover:border-border hover:bg-background";
  }

  function sourceLayerRowClass(selected: boolean): string {
    if (selected) {
      return "border-border bg-background";
    }

    return "border-transparent hover:border-border hover:bg-background";
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Fiber layers">
    <header v-if="!props.embedded" class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-xs font-semibold tracking-wide text-muted-foreground">Fiber Locator</h2>
      <span class="text-xs text-muted-foreground">Vector tiles</span>
    </header>

    <p class="mb-2 break-words text-xs text-muted-foreground">{{ props.status }}</p>

    <div class="grid gap-2">
      <label
        class="group flex min-h-[44px] cursor-pointer items-start gap-2 rounded-sm border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-primary/40 focus-within:outline-none"
        :class="rowClass(props.metroVisible)"
      >
        <input
          class="mt-[1px] h-4 w-4 shrink-0 rounded-sm border border-border accent-muted-foreground"
          type="checkbox"
          :checked="props.metroVisible"
          @change="onToggleMetro"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-pink-500" aria-hidden="true" />
            <span
              class="text-xs font-semibold transition-colors"
              :class="props.metroVisible ? 'text-foreground/70' : 'text-muted-foreground'"
              >Metro</span
            >
          </div>
          <p
            class="mt-1 break-words text-xs transition-colors"
            :class="props.metroVisible ? 'text-foreground/70' : 'text-muted-foreground'"
          >
            Composite metro network
          </p>
        </div>
      </label>

      <label
        class="group flex min-h-[44px] cursor-pointer items-start gap-2 rounded-sm border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-primary/40 focus-within:outline-none"
        :class="rowClass(props.longhaulVisible)"
      >
        <input
          class="mt-[1px] h-4 w-4 shrink-0 rounded-sm border border-border accent-muted-foreground"
          type="checkbox"
          :checked="props.longhaulVisible"
          @change="onToggleLonghaul"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-cyan-500" aria-hidden="true" />
            <span
              class="text-xs font-semibold transition-colors"
              :class="props.longhaulVisible ? 'text-foreground/70' : 'text-muted-foreground'"
              >Longhaul</span
            >
          </div>
          <p
            class="mt-1 break-words text-xs transition-colors"
            :class="props.longhaulVisible ? 'text-foreground/70' : 'text-muted-foreground'"
          >
            Composite longhaul network
          </p>
        </div>
      </label>
    </div>

    <div
      class="mt-2 rounded-sm border border-border bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div class="mb-2 flex items-center justify-between">
        <h3 class="m-0 text-xs font-semibold tracking-wide text-muted-foreground">
          Fiber ({{ totalSourceLayerCount }})
        </h3>
        <span class="text-xs text-muted-foreground">Selectable + filterable</span>
      </div>

      <input
        v-model="searchQuery"
        type="text"
        placeholder="Filter fiber lines..."
        class="mb-2 h-[22px] w-full rounded-sm border border-border bg-card px-2 text-xs leading-5 text-muted-foreground outline-none placeholder:text-border focus-visible:border-border focus-visible:ring-2 focus-visible:ring-border"
      >

      <p
        v-if="totalSourceLayerCount === 0"
        class="py-3 text-center text-xs text-[#94A3B8] animate-pulse"
      >Loading fiber sources...</p>

      <div v-else class="grid gap-2">
        <section
          class="rounded-sm border border-border bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="mb-1 flex items-center justify-between">
            <h4 class="m-0 text-xs font-semibold text-muted-foreground">
              Metro ({{ filteredMetroSourceLayers.length }})
            </h4>
            <div class="flex items-center gap-2 text-xs">
              <button
                type="button"
                class="h-[22px] rounded-sm border border-border bg-card px-2 text-xs font-normal text-muted-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-border hover:bg-background hover:text-foreground/70"
                @click="emit('setAllSourceLayers', 'metro', true)"
              >
                All
              </button>
              <button
                type="button"
                class="h-[22px] rounded-sm border border-border bg-card px-2 text-xs font-normal text-muted-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-border hover:bg-background hover:text-foreground/70"
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
                class="mt-[1px] h-4 w-4 shrink-0 rounded-sm border border-border accent-muted-foreground"
                type="checkbox"
                :checked="isSourceLayerSelected('metro', layer.layerName)"
                @change="onToggleSourceLayer('metro', layer.layerName, $event)"
              >
              <span class="mt-[6px] h-[3px] w-4 rounded-full bg-pink-500" aria-hidden="true" />
              <span
                class="min-w-0 flex-1 truncate text-xs transition-colors"
                :class="
                  isSourceLayerSelected('metro', layer.layerName)
                    ? 'font-medium text-foreground/70'
                    : 'text-muted-foreground'
                "
                >{{ layer.label }}</span
              >
            </label>
            <p
              v-if="filteredMetroSourceLayers.length === 0"
              class="m-0 px-1 py-1 text-xs text-muted-foreground"
            >
              No metro lines match this filter.
            </p>
          </div>
        </section>

        <section
          class="rounded-sm border border-border bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="mb-1 flex items-center justify-between">
            <h4 class="m-0 text-xs font-semibold text-muted-foreground">
              Longhaul ({{ filteredLonghaulSourceLayers.length }})
            </h4>
            <div class="flex items-center gap-2 text-xs">
              <button
                type="button"
                class="h-[22px] rounded-sm border border-border bg-card px-2 text-xs font-normal text-muted-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-border hover:bg-background hover:text-foreground/70"
                @click="emit('setAllSourceLayers', 'longhaul', true)"
              >
                All
              </button>
              <button
                type="button"
                class="h-[22px] rounded-sm border border-border bg-card px-2 text-xs font-normal text-muted-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-border hover:bg-background hover:text-foreground/70"
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
                class="mt-[1px] h-4 w-4 shrink-0 rounded-sm border border-border accent-muted-foreground"
                type="checkbox"
                :checked="isSourceLayerSelected('longhaul', layer.layerName)"
                @change="onToggleSourceLayer('longhaul', layer.layerName, $event)"
              >
              <span class="mt-[6px] h-[3px] w-4 rounded-full bg-cyan-500" aria-hidden="true" />
              <span
                class="min-w-0 flex-1 truncate text-xs transition-colors"
                :class="
                  isSourceLayerSelected('longhaul', layer.layerName)
                    ? 'font-medium text-foreground/70'
                    : 'text-muted-foreground'
                "
                >{{ layer.label }}</span
              >
            </label>
            <p
              v-if="filteredLonghaulSourceLayers.length === 0"
              class="m-0 px-1 py-1 text-xs text-muted-foreground"
            >
              No longhaul lines match this filter.
            </p>
          </div>
        </section>
      </div>
    </div>
  </aside>
</template>
