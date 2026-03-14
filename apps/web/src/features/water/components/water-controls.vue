<script setup lang="ts">
  import LayerControlsPanel from "@/components/map/layer-controls-panel.vue";
  import VisibilityToggleRow from "@/components/map/visibility-toggle-row.vue";

  interface WaterControlsProps {
    readonly embedded?: boolean;
    readonly visible: boolean;
  }

  const props = withDefaults(defineProps<WaterControlsProps>(), {
    embedded: false,
  });

  const emit = defineEmits<{
    "update:visible": [value: boolean];
  }>();
</script>

<template>
  <LayerControlsPanel
    ariaLabel="Water features layer"
    :embedded="props.embedded"
    title="Water"
    subtitle="USGS raster overlay"
  >
    <VisibilityToggleRow
      :checked="props.visible"
      title="USGS Water Features"
      description="Rivers, streams, lakes, and reservoirs from the HydroCached raster service"
      dot-class="bg-indigo-500"
      @update:checked="emit('update:visible', $event)"
    />
  </LayerControlsPanel>
</template>
