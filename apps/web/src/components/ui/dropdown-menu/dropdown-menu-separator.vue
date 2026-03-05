<script setup lang="ts">
  import { DropdownMenuSeparator as DropdownMenuSeparatorPrimitive } from "reka-ui";
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

  const forwardedAttrs = computed(() => {
    const { class: _class, ...rest } = attrs;
    return rest;
  });

  const className = computed(() =>
    cn("-mx-1 my-1 h-px bg-border/80", normalizeClassValue(attrs.class))
  );
</script>

<template>
  <DropdownMenuSeparatorPrimitive :class="className" v-bind="forwardedAttrs" />
</template>
