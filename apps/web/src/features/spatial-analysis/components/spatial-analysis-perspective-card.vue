<script setup lang="ts">
  import { computed } from "vue";
  import SpatialAnalysisProviderSummary from "@/features/spatial-analysis/components/spatial-analysis-provider-summary.vue";
  import type { SpatialAnalysisProviderSummaryItem } from "@/features/spatial-analysis/spatial-analysis-provider-summary.types";

  interface SpatialAnalysisPerspectiveSummary {
    readonly availablePowerMw: number;
    readonly commissionedPowerMw: number;
    readonly count: number;
    readonly leasedCount: number;
    readonly operationalCount: number;
    readonly pipelinePowerMw: number;
    readonly plannedCount: number;
    readonly plannedPowerMw: number;
    readonly squareFootage: number;
    readonly underConstructionCount: number;
    readonly underConstructionPowerMw: number;
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

  const dotClass = computed(() => {
    if (props.accent === "colocation") {
      return "bg-cyan-500";
    }

    return "bg-amber-500";
  });

  const providerItems = computed(() => props.providers ?? []);
</script>

<template>
  <article
    class="rounded-[4px] border border-[#E2E8F0] bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
  >
    <div class="mb-1 flex items-center gap-1.5">
      <span class="inline-block h-2 w-2 rounded-full" :class="dotClass" />
      <h3 class="m-0 text-[10px] font-semibold text-[#94A3B8]">{{ props.title }}</h3>
    </div>

    <dl class="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-[10px]">
      <dt class="text-[#94A3B8]">Facilities</dt>
      <dd class="m-0 font-medium text-[#64748B]">{{ props.summary.count }}</dd>
      <dt class="text-[#94A3B8]">Commissioned</dt>
      <dd class="m-0 font-medium text-[#64748B]">
        {{ props.formatPower(props.summary.commissionedPowerMw) }}
      </dd>
      <dt class="text-[#94A3B8]">Pipeline</dt>
      <dd class="m-0 font-medium text-[#64748B]">
        {{ props.formatPower(props.summary.pipelinePowerMw) }}
      </dd>
      <dt class="text-[#94A3B8]">Square Ft</dt>
      <dd class="m-0 font-medium text-[#64748B]">
        {{ props.summary.squareFootage > 0 ? Math.round(props.summary.squareFootage).toLocaleString() : "-" }}
      </dd>
      <dt class="text-[#94A3B8]">Operational</dt>
      <dd class="m-0 text-[#64748B]">{{ props.summary.operationalCount }}</dd>
      <dt class="text-[#94A3B8]">Under Construction</dt>
      <dd class="m-0 text-[#64748B]">
        {{ props.summary.underConstructionCount }}
        <span class="text-[#94A3B8]">
          · {{ props.formatPower(props.summary.underConstructionPowerMw) }}
        </span>
      </dd>
      <dt class="text-[#94A3B8]">Planned</dt>
      <dd class="m-0 text-[#64748B]">
        {{ props.summary.plannedCount }}
        <span class="text-[#94A3B8]"> · {{ props.formatPower(props.summary.plannedPowerMw) }}</span>
      </dd>
      <dt class="text-[#94A3B8]">Leased</dt>
      <dd class="m-0 text-[#64748B]">{{ props.summary.leasedCount }}</dd>
    </dl>

    <div v-if="props.providers !== undefined" class="mt-2 border-t border-[#E2E8F0] pt-2">
      <SpatialAnalysisProviderSummary
        :heading="props.providerHeading ?? 'Top Providers'"
        :providers="providerItems"
        :format-power="props.formatPower"
        :power-label="props.powerLabel"
      />
    </div>
  </article>
</template>
