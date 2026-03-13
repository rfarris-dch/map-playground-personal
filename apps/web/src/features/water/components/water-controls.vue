<script setup lang="ts">
  import { computed } from "vue";

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

  const containerClass = computed(() =>
    props.embedded
      ? "w-full font-sans text-muted-foreground"
      : "w-full rounded-sm border border-border bg-card p-3 shadow-md font-sans text-muted-foreground"
  );

  function onToggle(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    emit("update:visible", target.checked);
  }

  function rowClass(visible: boolean): string {
    if (visible) {
      return "border-border bg-background shadow-sm";
    }

    return "border-transparent bg-card hover:border-border hover:bg-background";
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Water features layer">
    <header v-if="!props.embedded" class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-xs font-semibold tracking-wide text-muted-foreground">Water</h2>
      <span class="text-xs text-muted-foreground">USGS raster overlay</span>
    </header>

    <label
      class="group flex min-h-[44px] cursor-pointer items-start gap-2 rounded-sm border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-primary/40 focus-within:outline-none"
      :class="rowClass(props.visible)"
    >
      <input
        class="mt-[1px] h-4 w-4 shrink-0 rounded-sm border border-border accent-muted-foreground"
        type="checkbox"
        :checked="props.visible"
        @change="onToggle"
      >
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-indigo-500" aria-hidden="true" />
          <span
            class="text-xs font-semibold transition-colors"
            :class="props.visible ? 'text-foreground/70' : 'text-muted-foreground'"
            >USGS Water Features</span
          >
        </div>
        <p
          class="mt-1 break-words text-xs transition-colors"
          :class="props.visible ? 'text-foreground/70' : 'text-muted-foreground'"
        >
          Rivers, streams, lakes, and reservoirs from the HydroCached raster service
        </p>
      </div>
    </label>
  </aside>
</template>
