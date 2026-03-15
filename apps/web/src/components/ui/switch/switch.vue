<script setup lang="ts">
  import { SwitchRoot, SwitchThumb } from "reka-ui";
  import { computed, useAttrs } from "vue";
  import { cn } from "@/lib/utils";

  function normalizeClassValue(value: unknown): string {
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map(normalizeClassValue).filter(Boolean).join(" ");
    }
    if (typeof value === "object" && value !== null) {
      return Object.entries(value)
        .filter((entry) => Boolean(entry[1]))
        .map((entry) => entry[0])
        .join(" ");
    }
    return "";
  }

  interface SwitchProps {
    readonly checked?: boolean;
    readonly disabled?: boolean;
  }

  const props = defineProps<SwitchProps>();

  const emit = defineEmits<{
    "update:checked": [value: boolean];
  }>();

  const attrs = useAttrs();

  const className = computed(() =>
    cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      normalizeClassValue(attrs.class)
    )
  );

  function onCheckedChange(value: boolean): void {
    emit("update:checked", value);
  }
</script>

<template>
  <SwitchRoot
    :model-value="props.checked ?? false"
    :disabled="props.disabled ?? false"
    :class="className"
    @update:model-value="onCheckedChange"
  >
    <SwitchThumb
      :class="
        cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
          'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
        )
      "
    />
  </SwitchRoot>
</template>
