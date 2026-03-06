<script setup lang="ts">
  import { ChevronDown } from "lucide-vue-next";
  import { AccordionContent, AccordionHeader, AccordionItem, AccordionTrigger } from "reka-ui";
  import type { MapLayerSectionProps } from "@/features/app/components/map-layer-section.types";

  const props = defineProps<MapLayerSectionProps>();
</script>

<template>
  <AccordionItem :value="props.value" class="border-b border-border/70 last:border-b-0">
    <AccordionHeader>
      <AccordionTrigger
        class="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold tracking-wide transition hover:bg-muted/40 [&[data-state=open]>svg]:rotate-180"
      >
        {{ props.title }}
        <ChevronDown
          class="h-4 w-4 shrink-0 transition-transform duration-200"
          aria-hidden="true"
        />
      </AccordionTrigger>
    </AccordionHeader>
    <AccordionContent class="px-3 pb-3 pt-1"> <slot /> </AccordionContent>
  </AccordionItem>
</template>
