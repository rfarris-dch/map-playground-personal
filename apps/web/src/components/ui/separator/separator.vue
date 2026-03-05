<script setup lang="ts">
  import { Separator } from "reka-ui";
  import { computed } from "vue";
  import { cn } from "@/lib/utils";

  interface SeparatorProps {
    decorative?: boolean;
    orientation?: "horizontal" | "vertical";
  }

  const props = withDefaults(defineProps<SeparatorProps>(), {
    decorative: true,
    orientation: "horizontal",
  });

  const className = computed(() =>
    cn("shrink-0 bg-border", props.orientation === "horizontal" ? "h-px w-full" : "h-full w-px")
  );
</script>

<template>
  <Separator :orientation="props.orientation" :decorative="props.decorative" :class="className" />
</template>
