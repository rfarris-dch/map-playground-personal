<script setup lang="ts">
  import LayerControlsPanel from "@/components/map/layer-controls-panel.vue";
  import VisibilityToggleRow from "@/components/map/visibility-toggle-row.vue";

  interface ParcelsControlsProps {
    readonly embedded?: boolean;
    readonly status: string;
    readonly visible: boolean;
  }

  const props = withDefaults(defineProps<ParcelsControlsProps>(), {
    embedded: false,
  });

  const emit = defineEmits<{
    "update:visible": [value: boolean];
  }>();
</script>

<template>
  <LayerControlsPanel
    ariaLabel="Parcels layer"
    :embedded="props.embedded"
    title="Parcels"
    subtitle="PMTiles draw layer"
  >
    <VisibilityToggleRow
      :checked="props.visible"
      title="Property Parcels"
      :description="props.status"
      dot-class="bg-amber-500"
      @update:checked="emit('update:visible', $event)"
    />
  </LayerControlsPanel>
</template>
