<script setup lang="ts">
  import { DropdownMenuContent as DropdownMenuContentPrimitive, DropdownMenuPortal } from "reka-ui";
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

  interface DropdownMenuContentProps {
    readonly align?: "start" | "center" | "end";
    readonly collisionPadding?: number;
    readonly sideOffset?: number;
  }

  const props = withDefaults(defineProps<DropdownMenuContentProps>(), {
    align: "start",
    collisionPadding: 8,
    sideOffset: 6,
  });

  const attrs = useAttrs();

  const forwardedAttrs = computed(() => {
    const { class: _class, ...rest } = attrs;
    return rest;
  });

  const className = computed(() =>
    cn(
      "z-50 min-w-44 rounded-md border border-border/80 bg-card p-1 text-card-foreground shadow-lg",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=open]:animate-in",
      "data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1",
      normalizeClassValue(attrs.class)
    )
  );
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContentPrimitive
      :align="props.align"
      :collision-padding="props.collisionPadding"
      :side-offset="props.sideOffset"
      :class="className"
      v-bind="forwardedAttrs"
    >
      <slot />
    </DropdownMenuContentPrimitive>
  </DropdownMenuPortal>
</template>
