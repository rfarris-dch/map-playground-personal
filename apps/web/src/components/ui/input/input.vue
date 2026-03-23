<script setup lang="ts">
  import { computed, useAttrs } from "vue";
  import { cn } from "@/lib/utils";

  function normalizeClassValue(value: unknown): string {
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => normalizeClassValue(item))
        .filter((item) => item.length > 0)
        .join(" ");
    }

    if (typeof value === "object" && value !== null) {
      return Object.entries(value)
        .filter((entry) => Boolean(entry[1]))
        .map((entry) => entry[0])
        .join(" ");
    }

    return "";
  }

  interface InputProps {
    readonly modelValue?: number | string | null;
  }

  const props = defineProps<InputProps>();

  const emit = defineEmits<{
    "update:modelValue": [value: string];
  }>();

  const attrs = useAttrs();

  const forwardedAttrs = computed(() => {
    const { class: _class, ...rest } = attrs;
    return rest;
  });

  const inputValue = computed(() => {
    if (typeof props.modelValue === "number") {
      return String(props.modelValue);
    }

    return props.modelValue ?? undefined;
  });

  const className = computed(() =>
    cn(
      "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
      "ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm",
      "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2",
      "focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      normalizeClassValue(attrs.class)
    )
  );

  function handleInput(event: Event): void {
    const eventTarget = event.target;
    if (!(eventTarget instanceof HTMLInputElement)) {
      return;
    }

    emit("update:modelValue", eventTarget.value);
  }
</script>

<template>
  <input :value="inputValue" :class="className" v-bind="forwardedAttrs" @input="handleInput">
</template>
