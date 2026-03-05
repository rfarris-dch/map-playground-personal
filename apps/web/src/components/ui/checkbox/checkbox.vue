<script setup lang="ts">
  import { Check } from "lucide-vue-next";
  import { CheckboxIndicator, CheckboxRoot } from "reka-ui";
  import { computed, useAttrs } from "vue";
  import { cn } from "@/lib/utils";

  type CheckboxState = boolean | "indeterminate";

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

  interface CheckboxProps {
    readonly checked?: CheckboxState;
    readonly disabled?: boolean;
    readonly id?: string;
    readonly name?: string;
  }

  const props = defineProps<CheckboxProps>();

  const emit = defineEmits<{
    "update:checked": [value: CheckboxState];
  }>();

  const attrs = useAttrs();

  const forwardedAttrs = computed(() => {
    const { class: _class, ...rest } = attrs;
    return rest;
  });

  const optionalIdentityProps = computed(() => {
    const next: { id?: string; name?: string } = {};
    if (typeof props.id === "string") {
      next.id = props.id;
    }
    if (typeof props.name === "string") {
      next.name = props.name;
    }
    return next;
  });

  const rootAttrs = computed(() => ({
    ...optionalIdentityProps.value,
    ...forwardedAttrs.value,
  }));

  const className = computed(() =>
    cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary/50 ring-offset-background",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      normalizeClassValue(attrs.class)
    )
  );

  function onCheckedChange(value: CheckboxState): void {
    emit("update:checked", value);
  }
</script>

<template>
  <CheckboxRoot
    :model-value="props.checked ?? false"
    :disabled="props.disabled ?? false"
    :class="className"
    v-bind="rootAttrs"
    @update:model-value="onCheckedChange"
  >
    <CheckboxIndicator class="flex h-full w-full items-center justify-center text-current">
      <Check class="h-3.5 w-3.5" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
