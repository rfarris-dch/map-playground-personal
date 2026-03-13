<script setup lang="ts">
  import { AccordionContent, AccordionHeader, AccordionItem, AccordionTrigger } from "reka-ui";
  import FilterChevronIcon from "@/components/icons/filter-chevron-icon.vue";
  import type { MapLayerSectionProps } from "@/features/app/components/map-layer-section.types";

  const props = defineProps<MapLayerSectionProps>();
</script>

<template>
  <AccordionItem :value="props.value" class="border-b border-[#dde3ea] last:border-b-0">
    <AccordionHeader>
      <AccordionTrigger
        class="group flex w-full items-center justify-between gap-3 rounded-[4px] border border-transparent px-3 py-1 text-left transition-colors hover:border-[#E2E8F0] hover:bg-[#F8FAFC] data-[state=open]:border-[#E2E8F0] data-[state=open]:bg-[#F8FAFC] [&[data-state=open]>span>svg]:rotate-180"
      >
        <span
          class="text-[10px] font-semibold tracking-[0.01em] text-[#64748B] transition-colors group-data-[state=open]:text-[#475569]"
          >{{ props.title }}</span
        >
        <span
          class="flex h-4 w-4 items-center justify-center text-[#64748B] transition-colors group-data-[state=open]:text-[#475569]"
        >
          <FilterChevronIcon class="shrink-0 transition-transform duration-200" />
        </span>
      </AccordionTrigger>
    </AccordionHeader>
    <AccordionContent class="px-3 pb-1 pt-1"> <slot /> </AccordionContent>
  </AccordionItem>
</template>
