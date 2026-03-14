<script setup lang="ts">
  import LayerControlsPanel from "@/components/map/layer-controls-panel.vue";
  import VisibilityToggleRow from "@/components/map/visibility-toggle-row.vue";
  import { floodControlMetadata } from "@/features/flood/flood.service";

  interface FloodControlsProps {
    readonly embedded?: boolean;
    readonly flood100Visible: boolean;
    readonly flood500Visible: boolean;
    readonly showFlood100ZoomHint: boolean;
    readonly showFlood500ZoomHint: boolean;
  }

  const props = withDefaults(defineProps<FloodControlsProps>(), {
    embedded: false,
  });

  const emit = defineEmits<{
    "update:flood100-visible": [value: boolean];
    "update:flood500-visible": [value: boolean];
  }>();

  const flood100Metadata = floodControlMetadata("flood-100");
  const flood500Metadata = floodControlMetadata("flood-500");
</script>

<template>
  <LayerControlsPanel ariaLabel="Flood risk layers" :embedded="props.embedded">
    <div class="grid gap-2">
      <VisibilityToggleRow
        :checked="props.flood100Visible"
        :title="flood100Metadata.label"
        :description="flood100Metadata.description"
        dot-class="bg-blue-400"
        @update:checked="emit('update:flood100-visible', $event)"
      >
        <template #details="{ textClass }">
          <p
            v-if="props.showFlood100ZoomHint"
            class="mt-1 break-words text-xs transition-colors"
            :class="textClass"
          >
            Zoom in to view.
          </p>
        </template>
      </VisibilityToggleRow>

      <VisibilityToggleRow
        :checked="props.flood500Visible"
        :title="flood500Metadata.label"
        :description="flood500Metadata.description"
        dot-class="bg-blue-600"
        @update:checked="emit('update:flood500-visible', $event)"
      >
        <template #details="{ textClass }">
          <p
            v-if="props.showFlood500ZoomHint"
            class="mt-1 break-words text-xs transition-colors"
            :class="textClass"
          >
            Zoom in to view.
          </p>
        </template>
      </VisibilityToggleRow>
    </div>
  </LayerControlsPanel>
</template>
