<script setup lang="ts">
  import { computed } from "vue";

  interface VisibilityToggleRowProps {
    readonly checked: boolean;
    readonly description: string;
    readonly dotClass: string;
    readonly title: string;
  }

  const props = defineProps<VisibilityToggleRowProps>();

  const emit = defineEmits<{
    "update:checked": [value: boolean];
  }>();

  const surfaceClass = computed(() =>
    props.checked
      ? "border-border bg-background shadow-sm"
      : "border-transparent bg-card hover:border-border hover:bg-background"
  );
  const textClass = computed(() =>
    props.checked ? "text-foreground/70" : "text-muted-foreground"
  );

  function onChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    emit("update:checked", target.checked);
  }
</script>

<template>
  <label
    class="group flex min-h-[44px] cursor-pointer items-start gap-2 rounded-sm border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-primary/40 focus-within:outline-none"
    :class="surfaceClass"
  >
    <input
      class="h-4 w-4 shrink-0 rounded-sm border border-border accent-muted-foreground"
      type="checkbox"
      :checked="props.checked"
      @change="onChange"
    >
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="h-2 w-2 rounded-full" :class="props.dotClass" aria-hidden="true" />
        <span class="text-xs font-semibold transition-colors" :class="textClass">
          {{ props.title }}
        </span>
      </div>
      <p class="mt-1 break-words text-xs transition-colors" :class="textClass">
        {{ props.description }}
      </p>
      <slot name="details" :text-class="textClass" />
    </div>
  </label>
</template>
