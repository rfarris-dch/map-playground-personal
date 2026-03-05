<script setup lang="ts">
  import { AccordionItem as AccordionItemPrimitive } from "reka-ui";
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

  interface AccordionItemProps {
    readonly value: string;
  }

  const props = defineProps<AccordionItemProps>();
  const attrs = useAttrs();

  const className = computed(() =>
    cn("border-b last:border-b-0", normalizeClassValue(attrs.class))
  );

  const forwardedAttrs = computed(() => {
    const { class: _class, ...rest } = attrs;
    return rest;
  });
</script>

<template>
  <AccordionItemPrimitive :value="props.value" :class="className" v-bind="forwardedAttrs">
    <slot />
  </AccordionItemPrimitive>
</template>
