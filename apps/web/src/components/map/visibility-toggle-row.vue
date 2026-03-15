<script setup lang="ts">
  import { computed } from "vue";
  import Switch from "@/components/ui/switch/switch.vue";

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
</script>

<template>
  <div
    class="group flex min-h-[44px] cursor-pointer items-start gap-2 rounded-sm border px-3 py-2 transition-colors"
    :class="surfaceClass"
    @click="emit('update:checked', !props.checked)"
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
    <Switch
      :checked="props.checked"
      class="mt-0.5 shrink-0"
      @click.stop
      @update:checked="emit('update:checked', $event)"
    />
  </div>
</template>
