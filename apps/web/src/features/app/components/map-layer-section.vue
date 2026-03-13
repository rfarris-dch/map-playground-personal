<script setup lang="ts">
  import { AccordionContent, AccordionHeader, AccordionItem, AccordionTrigger } from "reka-ui";
  import FilterChevronIcon from "@/components/icons/filter-chevron-icon.vue";
  import type { MapLayerSectionProps } from "@/features/app/components/map-layer-section.types";

  const props = defineProps<MapLayerSectionProps>();
</script>

<template>
  <AccordionItem :value="props.value" class="border-b border-border last:border-b-0">
    <AccordionHeader>
      <AccordionTrigger
        class="group flex w-full items-center justify-between gap-3 rounded-sm border border-transparent px-3 py-1 text-left transition-colors hover:border-border hover:bg-background data-[state=open]:border-border data-[state=open]:bg-background [&[data-state=open]>span>svg]:rotate-180"
      >
        <span
          class="text-xs font-semibold tracking-[0.01em] text-foreground/70 transition-colors group-data-[state=open]:text-foreground/75"
          >{{ props.title }}</span
        >
        <span
          class="flex h-4 w-4 items-center justify-center text-foreground/70 transition-colors group-data-[state=open]:text-foreground/75"
        >
          <FilterChevronIcon class="shrink-0 transition-transform duration-200" />
        </span>
      </AccordionTrigger>
    </AccordionHeader>
    <AccordionContent class="px-3 pb-1 pt-1"> <slot /> </AccordionContent>
  </AccordionItem>
</template>
