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
      ? "w-full [font-family:Inter,var(--font-sans)] text-[#94A3B8]"
      : "w-full rounded-[4px] border border-[#E2E8F0] bg-white p-3 shadow-[0_4px_8px_rgba(0,0,0,0.06)] [font-family:Inter,var(--font-sans)] text-[#94A3B8]"
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
      return "border-[#CBD5E1] bg-[#F8FAFC] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
    }

    return "border-transparent bg-white hover:border-[#E2E8F0] hover:bg-[#F8FAFC]";
  }

  function sourceLayerRowClass(selected: boolean): string {
    if (selected) {
      return "border-[#E2E8F0] bg-[#F8FAFC]";
    }

    return "border-transparent hover:border-[#E2E8F0] hover:bg-[#F8FAFC]";
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Fiber layers">
    <header v-if="!props.embedded" class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-[10px] font-semibold tracking-wide text-[#94A3B8]">Fiber Locator</h2>
      <span class="text-[10px] text-[#94A3B8]">Vector tiles</span>
    </header>

    <p class="mb-2 break-words text-[10px] text-[#94A3B8]">{{ props.status }}</p>

    <div class="grid gap-2">
      <label
        class="group flex cursor-pointer items-start gap-2 rounded-[4px] border px-3 py-1 transition-colors"
        :class="rowClass(props.metroVisible)"
      >
        <input
          class="mt-[1px] h-[10px] w-[10px] rounded-[2px] border border-[#CBD5E1] accent-[#94A3B8]"
          type="checkbox"
          :checked="props.metroVisible"
          @change="onToggleMetro"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-[#EC4899]" aria-hidden="true" />
            <span
              class="text-[10px] font-semibold transition-colors"
              :class="props.metroVisible ? 'text-[#64748B]' : 'text-[#94A3B8]'"
              >Metro</span
            >
          </div>
          <p
            class="mt-1 break-words text-[10px] transition-colors"
            :class="props.metroVisible ? 'text-[#64748B]' : 'text-[#94A3B8]'"
          >
            Composite metro network
          </p>
        </div>
      </label>

      <label
        class="group flex cursor-pointer items-start gap-2 rounded-[4px] border px-3 py-1 transition-colors"
        :class="rowClass(props.longhaulVisible)"
      >
        <input
          class="mt-[1px] h-[10px] w-[10px] rounded-[2px] border border-[#CBD5E1] accent-[#94A3B8]"
          type="checkbox"
          :checked="props.longhaulVisible"
          @change="onToggleLonghaul"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-[#06B6D4]" aria-hidden="true" />
            <span
              class="text-[10px] font-semibold transition-colors"
              :class="props.longhaulVisible ? 'text-[#64748B]' : 'text-[#94A3B8]'"
              >Longhaul</span
            >
          </div>
          <p
            class="mt-1 break-words text-[10px] transition-colors"
            :class="props.longhaulVisible ? 'text-[#64748B]' : 'text-[#94A3B8]'"
          >
            Composite longhaul network
          </p>
        </div>
      </label>
    </div>

    <div
      class="mt-2 rounded-[4px] border border-[#E2E8F0] bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div class="mb-2 flex items-center justify-between">
        <h3 class="m-0 text-[10px] font-semibold tracking-wide text-[#94A3B8]">
          Fiber ({{ totalSourceLayerCount }})
        </h3>
        <span class="text-[10px] text-[#94A3B8]">Selectable + filterable</span>
      </div>

      <input
        v-model="searchQuery"
        type="text"
        placeholder="Filter fiber lines..."
        class="mb-2 h-[22px] w-full rounded-[4px] border border-[#E2E8F0] bg-white px-2 text-[10px] leading-5 text-[#94A3B8] outline-none placeholder:text-[#E2E8F0] focus-visible:border-[#CBD5E1] focus-visible:ring-2 focus-visible:ring-[#E2E8F0]"
      >

      <p
        v-if="totalSourceLayerCount === 0"
        class="py-3 text-center text-xs text-[#94A3B8] animate-pulse"
      >Loading fiber sources...</p>

      <div v-else class="grid gap-2">
        <section
          class="rounded-[4px] border border-[#E2E8F0] bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="mb-1 flex items-center justify-between">
            <h4 class="m-0 text-[10px] font-semibold text-[#94A3B8]">
              Metro ({{ filteredMetroSourceLayers.length }})
            </h4>
            <div class="flex items-center gap-2 text-[10px]">
              <button
                type="button"
                class="h-[22px] rounded-[4px] border border-[#E2E8F0] bg-white px-2 text-[10px] font-normal text-[#94A3B8] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC] hover:text-[#64748B]"
                @click="emit('setAllSourceLayers', 'metro', true)"
              >
                All
              </button>
              <button
                type="button"
                class="h-[22px] rounded-[4px] border border-[#E2E8F0] bg-white px-2 text-[10px] font-normal text-[#94A3B8] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC] hover:text-[#64748B]"
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
              class="mb-1 flex cursor-pointer items-start gap-2 rounded-[4px] border px-1 py-1 text-[10px] transition-colors"
              :class="sourceLayerRowClass(isSourceLayerSelected('metro', layer.layerName))"
            >
              <input
                class="mt-[1px] h-[10px] w-[10px] rounded-[2px] border border-[#CBD5E1] accent-[#94A3B8]"
                type="checkbox"
                :checked="isSourceLayerSelected('metro', layer.layerName)"
                @change="onToggleSourceLayer('metro', layer.layerName, $event)"
              >
              <span class="mt-[6px] h-[3px] w-4 rounded-full bg-[#EC4899]" aria-hidden="true" />
              <span
                class="min-w-0 flex-1 truncate text-[10px] transition-colors"
                :class="
                  isSourceLayerSelected('metro', layer.layerName)
                    ? 'font-medium text-[#64748B]'
                    : 'text-[#94A3B8]'
                "
                >{{ layer.label }}</span
              >
            </label>
            <p
              v-if="filteredMetroSourceLayers.length === 0"
              class="m-0 px-1 py-1 text-[10px] text-[#94A3B8]"
            >
              No metro lines match this filter.
            </p>
          </div>
        </section>

        <section
          class="rounded-[4px] border border-[#E2E8F0] bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="mb-1 flex items-center justify-between">
            <h4 class="m-0 text-[10px] font-semibold text-[#94A3B8]">
              Longhaul ({{ filteredLonghaulSourceLayers.length }})
            </h4>
            <div class="flex items-center gap-2 text-[10px]">
              <button
                type="button"
                class="h-[22px] rounded-[4px] border border-[#E2E8F0] bg-white px-2 text-[10px] font-normal text-[#94A3B8] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC] hover:text-[#64748B]"
                @click="emit('setAllSourceLayers', 'longhaul', true)"
              >
                All
              </button>
              <button
                type="button"
                class="h-[22px] rounded-[4px] border border-[#E2E8F0] bg-white px-2 text-[10px] font-normal text-[#94A3B8] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC] hover:text-[#64748B]"
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
              class="mb-1 flex cursor-pointer items-start gap-2 rounded-[4px] border px-1 py-1 text-[10px] transition-colors"
              :class="sourceLayerRowClass(isSourceLayerSelected('longhaul', layer.layerName))"
            >
              <input
                class="mt-[1px] h-[10px] w-[10px] rounded-[2px] border border-[#CBD5E1] accent-[#94A3B8]"
                type="checkbox"
                :checked="isSourceLayerSelected('longhaul', layer.layerName)"
                @change="onToggleSourceLayer('longhaul', layer.layerName, $event)"
              >
              <span class="mt-[6px] h-[3px] w-4 rounded-full bg-[#06B6D4]" aria-hidden="true" />
              <span
                class="min-w-0 flex-1 truncate text-[10px] transition-colors"
                :class="
                  isSourceLayerSelected('longhaul', layer.layerName)
                    ? 'font-medium text-[#64748B]'
                    : 'text-[#94A3B8]'
                "
                >{{ layer.label }}</span
              >
            </label>
            <p
              v-if="filteredLonghaulSourceLayers.length === 0"
              class="m-0 px-1 py-1 text-[10px] text-[#94A3B8]"
            >
              No longhaul lines match this filter.
            </p>
          </div>
        </section>
      </div>
    </div>
  </aside>
</template>
