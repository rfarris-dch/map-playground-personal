<script setup lang="ts">
  import { computed } from "vue";
  import { powerLayerIds, powerLayerMetadata } from "@/features/power/power.service";
  import type { PowerLayerId } from "@/features/power/power.types";

  interface PowerControlsProps {
    readonly embedded?: boolean;
    readonly plantsVisible: boolean;
    readonly substationsVisible: boolean;
    readonly transmissionVisible: boolean;
  }

  const props = withDefaults(defineProps<PowerControlsProps>(), {
    embedded: false,
  });

  const emit = defineEmits<{
    "update:plantsVisible": [value: boolean];
    "update:substationsVisible": [value: boolean];
    "update:transmissionVisible": [value: boolean];
  }>();

  const containerClass = computed(() =>
    props.embedded
      ? "w-full [font-family:Inter,var(--font-sans)] text-[#94A3B8]"
      : "w-full rounded-[4px] border border-[#E2E8F0] bg-white p-3 shadow-[0_4px_8px_rgba(0,0,0,0.06)] [font-family:Inter,var(--font-sans)] text-[#94A3B8]"
  );

  const layers = computed(() =>
    powerLayerIds().map((layerId) => {
      return {
        layerId,
        visible: visibleForLayer(layerId),
        dotClass: dotClassForLayer(layerId),
        ...powerLayerMetadata(layerId),
      };
    })
  );

  function visibleForLayer(layerId: PowerLayerId): boolean {
    if (layerId === "transmission") {
      return props.transmissionVisible;
    }

    if (layerId === "substations") {
      return props.substationsVisible;
    }

    return props.plantsVisible;
  }

  function emitVisibility(layerId: PowerLayerId, visible: boolean): void {
    if (layerId === "transmission") {
      emit("update:transmissionVisible", visible);
      return;
    }

    if (layerId === "substations") {
      emit("update:substationsVisible", visible);
      return;
    }

    emit("update:plantsVisible", visible);
  }

  function onToggleLayer(layerId: PowerLayerId, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    emitVisibility(layerId, target.checked);
  }

  function dotClassForLayer(layerId: PowerLayerId): string {
    if (layerId === "transmission") {
      return "bg-[#F59E0B]";
    }

    if (layerId === "substations") {
      return "bg-[#0EA5E9]";
    }

    return "bg-[#10B981]";
  }

  function rowClass(visible: boolean): string {
    if (visible) {
      return "border-[#CBD5E1] bg-[#F8FAFC] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
    }

    return "border-transparent bg-white hover:border-[#E2E8F0] hover:bg-[#F8FAFC]";
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Power layers">
    <header v-if="!props.embedded" class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-[10px] font-semibold tracking-wide text-[#94A3B8]">Power</h2>
      <span class="text-[10px] text-[#94A3B8]">Transmission + grid sites</span>
    </header>

    <div class="grid gap-2">
      <label
        v-for="layer in layers"
        :key="layer.layerId"
        class="group flex cursor-pointer items-start gap-2 rounded-[4px] border px-3 py-1 transition-colors"
        :class="rowClass(layer.visible)"
      >
        <input
          class="mt-[1px] h-[10px] w-[10px] rounded-[2px] border border-[#CBD5E1] accent-[#94A3B8]"
          type="checkbox"
          :checked="layer.visible"
          @change="onToggleLayer(layer.layerId, $event)"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full" :class="layer.dotClass" aria-hidden="true" />
            <span
              class="text-[10px] font-semibold transition-colors"
              :class="layer.visible ? 'text-[#64748B]' : 'text-[#94A3B8]'"
              >{{ layer.label }}</span
            >
          </div>
          <p
            class="mt-1 break-words text-[10px] transition-colors"
            :class="layer.visible ? 'text-[#64748B]' : 'text-[#94A3B8]'"
          >
            {{ layer.description }}
          </p>
        </div>
      </label>
    </div>
  </aside>
</template>
