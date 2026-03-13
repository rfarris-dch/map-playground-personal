<script setup lang="ts">
  import type { SpatialAnalysisProviderSummaryItem } from "@/features/spatial-analysis/spatial-analysis-provider-summary.types";

  interface SpatialAnalysisProviderSummaryProps {
    readonly formatPower: (powerMw: number) => string;
    readonly heading: string;
    readonly powerLabel?: string | undefined;
    readonly providers: readonly SpatialAnalysisProviderSummaryItem[];
  }

  const props = defineProps<SpatialAnalysisProviderSummaryProps>();

  function providerKey(provider: SpatialAnalysisProviderSummaryItem, index: number): string {
    const providerId = provider.providerId;
    if (typeof providerId === "string" && providerId.length > 0) {
      return providerId;
    }

    return `${provider.providerName}-${String(index)}`;
  }
</script>

<template>
  <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    {{ props.heading }}
  </p>
  <div class="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-1 text-xs">
    <span class="text-xs uppercase tracking-wide text-muted-foreground">Provider</span>
    <span class="text-xs uppercase tracking-wide text-muted-foreground text-right">
      {{ props.powerLabel ?? "Power" }}
    </span>
    <span class="text-xs uppercase tracking-wide text-muted-foreground text-right">Facilities</span>
    <template v-for="(provider, index) in props.providers" :key="providerKey(provider, index)">
      <span class="truncate text-foreground/70">{{ provider.providerName }}</span>
      <span class="text-right text-muted-foreground">
        {{ props.formatPower(provider.commissionedPowerMw) }}
      </span>
      <span class="text-right text-muted-foreground">{{ provider.count }}</span>
    </template>
    <span v-if="props.providers.length === 0" class="col-span-3 text-xs text-muted-foreground"
      >None</span
    >
  </div>
</template>
