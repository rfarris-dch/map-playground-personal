<script setup lang="ts">
  import LayerControlsPanel from "@/components/map/layer-controls-panel.vue";
  import VisibilityToggleRow from "@/components/map/visibility-toggle-row.vue";
  import { hydroBasinsControlMetadata } from "@/features/hydro-basins/hydro-basins.service";

  interface HydroBasinsControlsProps {
    readonly embedded?: boolean;
    readonly showZoomHint: boolean;
    readonly visible: boolean;
  }

  const props = withDefaults(defineProps<HydroBasinsControlsProps>(), {
    embedded: false,
  });

  const emit = defineEmits<{
    "update:visible": [value: boolean];
  }>();

  const metadata = hydroBasinsControlMetadata();
</script>

<template>
  <LayerControlsPanel ariaLabel="Hydro basins layer" :embedded="props.embedded">
    <VisibilityToggleRow
      :checked="props.visible"
      :title="metadata.label"
      :description="metadata.description"
      dot-class="bg-sky-500"
      @update:checked="emit('update:visible', $event)"
    >
      <template #details="{ textClass }">
        <p
          v-if="props.showZoomHint"
          class="mt-1 break-words text-xs transition-colors"
          :class="textClass"
        >
          Zoom in to view.
        </p>
      </template>
    </VisibilityToggleRow>
  </LayerControlsPanel>
</template>
