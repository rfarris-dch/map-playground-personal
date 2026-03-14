<script setup lang="ts">
  import { computed } from "vue";
  import LayerControlsPanel from "@/components/map/layer-controls-panel.vue";
  import VisibilityToggleRow from "@/components/map/visibility-toggle-row.vue";
  import { powerLayerIds, powerLayerMetadata } from "@/features/power/power.service";
  import type { PowerLayerId } from "@/features/power/power.types";

  interface PowerControlsProps {
    readonly embedded?: boolean;
    readonly plantsVisible: boolean;
    readonly substationsVisible: boolean;
    readonly transmissionVisible: boolean;
  }

  interface PowerControlRow {
    readonly description: string;
    readonly dotClass: string;
    readonly label: string;
    readonly layerId: PowerLayerId;
    readonly visible: boolean;
  }

  const props = withDefaults(defineProps<PowerControlsProps>(), {
    embedded: false,
  });

  const emit = defineEmits<{
    "update:plantsVisible": [value: boolean];
    "update:substationsVisible": [value: boolean];
    "update:transmissionVisible": [value: boolean];
  }>();

  const layers = computed<PowerControlRow[]>(() =>
    powerLayerIds().map((layerId) => ({
      layerId,
      visible: visibleForLayer(layerId),
      dotClass: dotClassForLayer(layerId),
      ...powerLayerMetadata(layerId),
    }))
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

  function dotClassForLayer(layerId: PowerLayerId): string {
    if (layerId === "transmission") {
      return "bg-amber-500";
    }

    if (layerId === "substations") {
      return "bg-sky-500";
    }

    return "bg-hyperscale";
  }
</script>

<template>
  <LayerControlsPanel
    ariaLabel="Power layers"
    :embedded="props.embedded"
    title="Power"
    subtitle="Transmission + grid sites"
  >
    <div class="grid gap-2">
      <VisibilityToggleRow
        v-for="layer in layers"
        :key="layer.layerId"
        :checked="layer.visible"
        :title="layer.label"
        :description="layer.description"
        :dot-class="layer.dotClass"
        @update:checked="emitVisibility(layer.layerId, $event)"
      />
    </div>
  </LayerControlsPanel>
</template>
