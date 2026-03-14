<script setup lang="ts">
  import LayerControlsPanel from "@/components/map/layer-controls-panel.vue";
  import VisibilityToggleRow from "@/components/map/visibility-toggle-row.vue";

  interface FacilitiesControlsProps {
    readonly colocationStatus: string;
    readonly colocationVisible: boolean;
    readonly embedded?: boolean;
    readonly hyperscaleStatus: string;
    readonly hyperscaleVisible: boolean;
  }

  const props = withDefaults(defineProps<FacilitiesControlsProps>(), {
    embedded: false,
  });

  const emit = defineEmits<{
    "update:colocationVisible": [value: boolean];
    "update:hyperscaleVisible": [value: boolean];
  }>();
</script>

<template>
  <LayerControlsPanel
    ariaLabel="Facilities layers"
    :embedded="props.embedded"
    title="Facilities"
    subtitle="Colocation and hyperscale visibility"
  >
    <div class="grid gap-2">
      <VisibilityToggleRow
        :checked="props.colocationVisible"
        title="Colocation"
        :description="props.colocationStatus"
        dot-class="bg-colocation"
        @update:checked="emit('update:colocationVisible', $event)"
      />
      <VisibilityToggleRow
        :checked="props.hyperscaleVisible"
        title="Hyperscale"
        :description="props.hyperscaleStatus"
        dot-class="bg-hyperscale"
        @update:checked="emit('update:hyperscaleVisible', $event)"
      />
    </div>
  </LayerControlsPanel>
</template>
