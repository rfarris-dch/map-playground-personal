<script setup lang="ts">
  import { computed } from "vue";
  import SpatialAnalysisProviderSummary from "@/features/spatial-analysis/components/spatial-analysis-provider-summary.vue";
  import type { SpatialAnalysisProviderSummaryItem } from "@/features/spatial-analysis/spatial-analysis-provider-summary.types";

  interface SpatialAnalysisPerspectiveSummary {
    readonly commissionedPowerMw: number;
    readonly count: number;
    readonly leasedCount: number;
    readonly operationalCount: number;
    readonly plannedCount: number;
    readonly underConstructionCount: number;
  }

  interface SpatialAnalysisPerspectiveCardProps {
    readonly accent: "colocation" | "hyperscale";
    readonly formatPower: (powerMw: number) => string;
    readonly powerLabel?: string;
    readonly providerHeading?: string;
    readonly providers?: readonly SpatialAnalysisProviderSummaryItem[];
    readonly summary: SpatialAnalysisPerspectiveSummary;
    readonly title: string;
  }

  const props = defineProps<SpatialAnalysisPerspectiveCardProps>();

  const headingClass = computed(() => {
    if (props.accent === "colocation") {
      return "text-cyan-700";
    }

    return "text-amber-700";
  });

  const dotClass = computed(() => {
    if (props.accent === "colocation") {
      return "bg-cyan-500";
    }

    return "bg-amber-500";
  });

  const providerItems = computed(() => props.providers ?? []);
</script>

<template>
  <article class="rounded-md border border-border/60 bg-muted/20 p-2">
    <div class="mb-1 flex items-center gap-1.5">
      <span class="inline-block h-2 w-2 rounded-full" :class="dotClass" />
      <h3 class="m-0 text-xs font-semibold" :class="headingClass">{{ props.title }}</h3>
    </div>

    <dl class="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-[11px]">
      <dt class="text-muted-foreground">Facilities</dt>
      <dd class="m-0 font-medium">{{ props.summary.count }}</dd>
      <dt class="text-muted-foreground">Commissioned</dt>
      <dd class="m-0 font-medium">{{ props.formatPower(props.summary.commissionedPowerMw) }}</dd>
      <dt class="text-muted-foreground">Operational</dt>
      <dd class="m-0">{{ props.summary.operationalCount }}</dd>
      <dt class="text-muted-foreground">Under Construction</dt>
      <dd class="m-0">{{ props.summary.underConstructionCount }}</dd>
      <dt class="text-muted-foreground">Planned</dt>
      <dd class="m-0">{{ props.summary.plannedCount }}</dd>
      <dt class="text-muted-foreground">Leased</dt>
      <dd class="m-0">{{ props.summary.leasedCount }}</dd>
    </dl>

    <div v-if="props.providers !== undefined" class="mt-2 border-t border-border/60 pt-2">
      <SpatialAnalysisProviderSummary
        :heading="props.providerHeading ?? 'Top Providers'"
        :providers="providerItems"
        :format-power="props.formatPower"
        :power-label="props.powerLabel"
      />
    </div>
  </article>
</template>
