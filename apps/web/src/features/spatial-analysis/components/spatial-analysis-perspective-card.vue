<script setup lang="ts">
  import type { SpatialAnalysisSummaryResponse } from "@map-migration/http-contracts/spatial-analysis-summary-http";
  import { computed, nextTick, onMounted, ref } from "vue";
  import { useGsapStagger } from "@/composables/use-gsap-stagger";
  import SpatialAnalysisProviderSummary from "@/features/spatial-analysis/components/spatial-analysis-provider-summary.vue";
  import type { SpatialAnalysisProviderSummaryItem } from "@/features/spatial-analysis/spatial-analysis-provider-summary.types";

  interface SpatialAnalysisPerspectiveCardProps {
    readonly accent: "colocation" | "hyperscale";
    readonly formatPower: (powerMw: number) => string;
    readonly powerLabel?: string;
    readonly providerHeading?: string;
    readonly providers?: readonly SpatialAnalysisProviderSummaryItem[];
    readonly summary: SpatialAnalysisSummaryResponse["summary"]["colocation"];
    readonly title: string;
  }

  const props = defineProps<SpatialAnalysisPerspectiveCardProps>();

  const dotClass = computed(() => {
    if (props.accent === "colocation") {
      return "bg-colocation";
    }

    return "bg-hyperscale";
  });

  const providerItems = computed(() => props.providers ?? []);

  const dlRef = ref<HTMLElement | null>(null);
  const { animate: staggerDlRows } = useGsapStagger({
    container: dlRef,
    selector: "dt, dd",
    stagger: 0.02,
    duration: 0.25,
    from: { opacity: 0, y: 8 },
  });

  onMounted(() => {
    nextTick(() => staggerDlRows());
  });
</script>

<template>
  <article class="rounded-sm border border-border bg-card p-2 shadow-sm">
    <div class="mb-1 flex items-center gap-1.5">
      <span class="inline-block h-2 w-2 rounded-full" :class="dotClass" />
      <h3 class="m-0 text-xs font-semibold text-muted-foreground">{{ props.title }}</h3>
    </div>

    <dl ref="dlRef" class="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-xs">
      <dt class="text-muted-foreground">Facilities</dt>
      <dd class="m-0 font-medium text-foreground/70">{{ props.summary.count }}</dd>
      <dt class="text-muted-foreground">Commissioned</dt>
      <dd class="m-0 font-medium text-foreground/70">
        {{ props.formatPower(props.summary.commissionedPowerMw) }}
      </dd>
      <dt class="text-muted-foreground">Pipeline</dt>
      <dd class="m-0 font-medium text-foreground/70">
        {{ props.formatPower(props.summary.pipelinePowerMw) }}
      </dd>
      <dt class="text-muted-foreground">Square Ft</dt>
      <dd class="m-0 font-medium text-foreground/70">
        {{ props.summary.squareFootage > 0 ? Math.round(props.summary.squareFootage).toLocaleString() : "-" }}
      </dd>
      <dt class="text-muted-foreground">Operational</dt>
      <dd class="m-0 text-foreground/70">{{ props.summary.operationalCount }}</dd>
      <dt class="text-muted-foreground">Under Construction</dt>
      <dd class="m-0 text-foreground/70">
        {{ props.summary.underConstructionCount }}
        <span class="text-muted-foreground">
          · {{ props.formatPower(props.summary.underConstructionPowerMw) }}
        </span>
      </dd>
      <dt class="text-muted-foreground">Planned</dt>
      <dd class="m-0 text-foreground/70">
        {{ props.summary.plannedCount }}
        <span class="text-muted-foreground">
          · {{ props.formatPower(props.summary.plannedPowerMw) }}</span
        >
      </dd>
      <dt class="text-muted-foreground">Leased</dt>
      <dd class="m-0 text-foreground/70">{{ props.summary.leasedCount }}</dd>
    </dl>

    <div v-if="props.providers !== undefined" class="mt-2 border-t border-border pt-2">
      <SpatialAnalysisProviderSummary
        :heading="props.providerHeading ?? 'Top Providers'"
        :providers="providerItems"
        :format-power="props.formatPower"
        :power-label="props.powerLabel"
      />
    </div>
  </article>
</template>
