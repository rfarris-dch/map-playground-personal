<script setup lang="ts">
  interface FacilitiesControlsProps {
    readonly colocationStatus: string;
    readonly colocationVisible: boolean;
    readonly hyperscaleStatus: string;
    readonly hyperscaleVisible: boolean;
  }

  const props = defineProps<FacilitiesControlsProps>();

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
  <aside
    class="pointer-events-auto absolute left-4 top-4 z-20 w-[min(26rem,calc(100%-2rem))] rounded-lg border border-border/90 bg-card/95 p-3 shadow-lg backdrop-blur-sm"
    aria-label="Facilities layers"
  >
    <header class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-xs font-semibold tracking-wide">Facilities</h2>
      <span class="text-[11px] text-muted-foreground">Legend + toggles</span>
    </header>

    <div class="grid gap-2">
      <label class="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 p-2">
        <input
          class="mt-0.5 h-4 w-4"
          type="checkbox"
          :checked="props.colocationVisible"
          @change="onToggleColocation"
        />
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

      <label class="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 p-2">
        <input
          class="mt-0.5 h-4 w-4"
          type="checkbox"
          :checked="props.hyperscaleVisible"
          @change="onToggleHyperscale"
        />
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
