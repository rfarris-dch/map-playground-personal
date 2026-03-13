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
      ? "w-full font-sans text-muted-foreground"
      : "w-full rounded-sm border border-border bg-card p-3 shadow-md font-sans text-muted-foreground"
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
      return "bg-amber-500";
    }

    if (layerId === "substations") {
      return "bg-sky-500";
    }

    return "bg-hyperscale";
  }

  function rowClass(visible: boolean): string {
    if (visible) {
      return "border-border bg-background shadow-sm";
    }

    return "border-transparent bg-card hover:border-border hover:bg-background";
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Power layers">
    <header v-if="!props.embedded" class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-xs font-semibold tracking-wide text-muted-foreground">Power</h2>
      <span class="text-xs text-muted-foreground">Transmission + grid sites</span>
    </header>

    <div class="grid gap-2">
      <label
        v-for="layer in layers"
        :key="layer.layerId"
        class="group flex cursor-pointer items-start gap-2 rounded-sm border px-3 py-1 transition-colors"
        :class="rowClass(layer.visible)"
      >
        <input
          class="mt-[1px] h-4 w-4 shrink-0 rounded-sm border border-border accent-muted-foreground"
          type="checkbox"
          :checked="layer.visible"
          @change="onToggleLayer(layer.layerId, $event)"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full" :class="layer.dotClass" aria-hidden="true" />
            <span
              class="text-xs font-semibold transition-colors"
              :class="layer.visible ? 'text-foreground/70' : 'text-muted-foreground'"
              >{{ layer.label }}</span
            >
          </div>
          <p
            class="mt-1 break-words text-xs transition-colors"
            :class="layer.visible ? 'text-foreground/70' : 'text-muted-foreground'"
          >
            {{ layer.description }}
          </p>
        </div>
      </label>
    </div>
  </aside>
</template>
