<script setup lang="ts">
  import { ChevronDown } from "lucide-vue-next";
  import { AccordionHeader, AccordionTrigger as AccordionTriggerPrimitive } from "reka-ui";
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

  const className = computed(() =>
    cn(
      "flex flex-1 items-center justify-between py-2 font-medium text-sm transition-all hover:underline",
      "[&[data-state=open]>svg]:rotate-180",
      normalizeClassValue(attrs.class)
    )
  );

  const forwardedAttrs = computed(() => {
    const { class: _class, ...rest } = attrs;
    return rest;
  });
</script>

<template>
  <AccordionHeader class="flex">
    <AccordionTriggerPrimitive :class="className" v-bind="forwardedAttrs">
      <slot />
      <ChevronDown
        class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
      />
    </AccordionTriggerPrimitive>
  </AccordionHeader>
</template>
