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
      ? "w-full"
      : "w-full rounded-lg border border-border/90 bg-card/95 p-3 shadow-lg backdrop-blur-sm"
  );

  const layers = computed(() =>
    powerLayerIds().map((layerId) => {
      return {
        layerId,
        visible: visibleForLayer(layerId),
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
</script>

<template>
  <aside :class="containerClass" aria-label="Power layers">
    <header v-if="!props.embedded" class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-xs font-semibold tracking-wide">Power</h2>
      <span class="text-[11px] text-muted-foreground">Transmission + grid sites</span>
    </header>

    <div class="grid gap-2">
      <label
        v-for="layer in layers"
        :key="layer.layerId"
        class="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 p-2"
      >
        <input
          class="mt-0.5 h-4 w-4"
          type="checkbox"
          :checked="layer.visible"
          @change="onToggleLayer(layer.layerId, $event)"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span
              class="h-2.5 w-2.5 rounded-full"
              :style="{ backgroundColor: layer.color }"
              aria-hidden="true"
            />
            <span class="text-xs font-medium">{{ layer.label }}</span>
          </div>
          <p class="mt-1 break-words text-[11px] text-muted-foreground">{{ layer.description }}</p>
        </div>
      </label>
    </div>
  </aside>
</template>
