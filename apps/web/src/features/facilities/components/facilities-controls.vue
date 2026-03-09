<script setup lang="ts">
  import { computed } from "vue";

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

  const containerClass = computed(() =>
    props.embedded ? "w-full" : "map-glass-panel w-full rounded-lg p-3"
  );

  const emit = defineEmits<{
    "update:colocationVisible": [value: boolean];
    "update:hyperscaleVisible": [value: boolean];
  }>();

  function onToggleColocation(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    emit("update:colocationVisible", target.checked);
  }

  function onToggleHyperscale(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    emit("update:hyperscaleVisible", target.checked);
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Facilities layers">
    <header v-if="!props.embedded" class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-xs font-semibold tracking-wide">Facilities</h2>
      <span class="text-[11px] text-muted-foreground">Legend + toggles</span>
    </header>

    <div class="grid gap-2">
      <label class="map-glass-card flex cursor-pointer items-start gap-3 rounded-md p-2">
        <input
          class="mt-0.5 h-4 w-4"
          type="checkbox"
          :checked="props.colocationVisible"
          @change="onToggleColocation"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-[#3b82f6]" aria-hidden="true" />
            <span class="text-xs font-medium">Colocation</span>
          </div>
          <p class="mt-1 break-words text-[11px] font-mono text-muted-foreground">
            {{ props.colocationStatus }}
          </p>
        </div>
      </label>

      <label class="map-glass-card flex cursor-pointer items-start gap-3 rounded-md p-2">
        <input
          class="mt-0.5 h-4 w-4"
          type="checkbox"
          :checked="props.hyperscaleVisible"
          @change="onToggleHyperscale"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-[#f97316]" aria-hidden="true" />
            <span class="text-xs font-medium">Hyperscale</span>
          </div>
          <p class="mt-1 break-words text-[11px] font-mono text-muted-foreground">
            {{ props.hyperscaleStatus }}
          </p>
        </div>
      </label>
    </div>
  </aside>
</template>
