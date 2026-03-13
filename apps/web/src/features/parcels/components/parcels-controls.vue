<script setup lang="ts">
  import { computed } from "vue";

  interface ParcelsControlsProps {
    readonly embedded?: boolean;
    readonly status: string;
    readonly visible: boolean;
  }

  const props = withDefaults(defineProps<ParcelsControlsProps>(), {
    embedded: false,
  });

  const containerClass = computed(() =>
    props.embedded
      ? "w-full font-sans text-muted-foreground"
      : "w-full rounded-sm border border-border bg-card p-3 shadow-[0_4px_8px_rgba(0,0,0,0.06)] font-sans text-muted-foreground"
  );

  const emit = defineEmits<{
    "update:visible": [value: boolean];
  }>();

  function onToggle(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    emit("update:visible", target.checked);
  }

  function rowClass(visible: boolean): string {
    if (visible) {
      return "border-border bg-background shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
    }

    return "border-transparent bg-card hover:border-border hover:bg-background";
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Parcels layer">
    <header v-if="!props.embedded" class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-xs font-semibold tracking-wide text-muted-foreground">Parcels</h2>
      <span class="text-xs text-muted-foreground">PMTiles draw layer</span>
    </header>

    <label
      class="group flex cursor-pointer items-start gap-2 rounded-sm border px-3 py-1 transition-colors"
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
          <span class="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
          <span
            class="text-xs font-semibold transition-colors"
            :class="props.visible ? 'text-foreground/70' : 'text-muted-foreground'"
            >Property Parcels</span
          >
        </div>
        <p
          class="mt-1 break-words text-xs transition-colors"
          :class="props.visible ? 'text-foreground/70' : 'text-muted-foreground'"
        >
          {{ props.status }}
        </p>
      </div>
    </label>
  </aside>
</template>
