<script setup lang="ts">
  import Button from "@/components/ui/button/button.vue";

  interface EntityDetailDrawerShellProps {
    readonly ariaLabel: string;
    readonly errorMessage: string;
    readonly eyebrow: string;
    readonly isError: boolean;
    readonly isLoading: boolean;
    readonly loadingMessage: string;
    readonly selected: unknown | null;
    readonly title: string;
    readonly topClass?: string;
    readonly widthClass?: string;
  }

  const props = withDefaults(defineProps<EntityDetailDrawerShellProps>(), {
    topClass: "top-4",
    widthClass: "w-[min(28rem,calc(100%-2rem))]",
  });

  const emit = defineEmits<{
    close: [];
  }>();
</script>

<template>
  <aside
    v-if="props.selected !== null"
    class="map-glass-elevated pointer-events-auto absolute right-4 z-10 max-h-[calc(100%-2rem)] overflow-y-auto rounded-lg p-4"
    :class="[props.widthClass, props.topClass]"
    :aria-label="props.ariaLabel"
  >
    <header class="mb-3 flex items-center gap-2">
      <h2 class="m-0 text-sm font-semibold tracking-tight">{{ props.eyebrow }}</h2>
      <p class="m-0 truncate text-base font-semibold">{{ props.title }}</p>
      <Button variant="glass" size="sm" class="ml-auto" @click="emit('close')">Close</Button>
    </header>

    <div v-if="props.isLoading" class="space-y-3" role="status" aria-live="polite" aria-busy="true">
      <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
        <div class="h-3 w-16 animate-pulse rounded bg-muted/50" />
        <div class="h-3 w-32 animate-pulse rounded bg-muted/40" />
        <div class="h-3 w-20 animate-pulse rounded bg-muted/50" />
        <div class="h-3 w-24 animate-pulse rounded bg-muted/40" />
        <div class="h-3 w-14 animate-pulse rounded bg-muted/50" />
        <div class="h-3 w-28 animate-pulse rounded bg-muted/40" />
      </div>
      <p class="m-0 text-xs text-muted-foreground">{{ props.loadingMessage }}</p>
    </div>

    <p v-else-if="props.isError" class="m-0 text-xs text-muted-foreground">
      {{ props.errorMessage }}
    </p>

    <slot v-else />
  </aside>
</template>
