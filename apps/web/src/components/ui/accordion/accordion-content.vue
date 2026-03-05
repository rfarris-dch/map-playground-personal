<script setup lang="ts">
  import { AccordionContent as AccordionContentPrimitive } from "reka-ui";
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

  const attrs = useAttrs();

  const contentClassName = computed(() =>
    cn(
      "overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
      normalizeClassValue(attrs.class)
    )
  );

  const forwardedAttrs = computed(() => {
    const { class: _class, ...rest } = attrs;
    return rest;
  });
</script>

<template>
  <AccordionContentPrimitive :class="contentClassName" v-bind="forwardedAttrs">
    <div class="pb-2 pt-0"><slot /></div>
  </AccordionContentPrimitive>
</template>
