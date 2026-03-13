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
    props.embedded
      ? "w-full font-sans text-muted-foreground"
      : "w-full rounded-sm border border-border bg-card p-3 shadow-[0_4px_8px_rgba(0,0,0,0.06)] font-sans text-muted-foreground"
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

  function rowClass(visible: boolean): string {
    if (visible) {
      return "border-border bg-background shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
    }

    return "border-transparent bg-card hover:border-border hover:bg-background";
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Facilities layers">
    <header v-if="!props.embedded" class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-xs font-semibold tracking-wide text-muted-foreground">Facilities</h2>
      <span class="text-xs text-muted-foreground">Colocation and hyperscale visibility</span>
    </header>

    <div class="grid gap-2">
      <label
        class="group flex min-h-[44px] cursor-pointer items-start gap-2 rounded-sm border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-primary/40 focus-within:outline-none"
        :class="rowClass(props.colocationVisible)"
      >
        <input
          class="mt-[1px] h-4 w-4 shrink-0 rounded-sm border border-border accent-muted-foreground"
          type="checkbox"
          :checked="props.colocationVisible"
          @change="onToggleColocation"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-colocation" aria-hidden="true" />
            <span
              class="text-xs font-semibold transition-colors"
              :class="props.colocationVisible ? 'text-foreground/70' : 'text-muted-foreground'"
              >Colocation</span
            >
          </div>
          <p
            class="mt-1 break-words text-xs transition-colors"
            :class="props.colocationVisible ? 'text-foreground/70' : 'text-muted-foreground'"
          >
            {{ props.colocationStatus }}
          </p>
        </div>
      </label>

      <label
        class="group flex min-h-[44px] cursor-pointer items-start gap-2 rounded-sm border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-primary/40 focus-within:outline-none"
        :class="rowClass(props.hyperscaleVisible)"
      >
        <input
          class="mt-[1px] h-4 w-4 shrink-0 rounded-sm border border-border accent-muted-foreground"
          type="checkbox"
          :checked="props.hyperscaleVisible"
          @change="onToggleHyperscale"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-orange-500" aria-hidden="true" />
            <span
              class="text-xs font-semibold transition-colors"
              :class="props.hyperscaleVisible ? 'text-foreground/70' : 'text-muted-foreground'"
              >Hyperscale</span
            >
          </div>
          <p
            class="mt-1 break-words text-xs transition-colors"
            :class="props.hyperscaleVisible ? 'text-foreground/70' : 'text-muted-foreground'"
          >
            {{ props.hyperscaleStatus }}
          </p>
        </div>
      </label>
    </div>
  </aside>
</template>
