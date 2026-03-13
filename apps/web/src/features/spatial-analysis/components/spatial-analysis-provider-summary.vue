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
  <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
    {{ props.heading }}
  </p>
  <div class="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-1 text-[11px]">
    <span class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Provider</span>
    <span class="text-[10px] uppercase tracking-wide text-[#94A3B8] text-right">
      {{ props.powerLabel ?? "Power" }}
    </span>
    <span class="text-[10px] uppercase tracking-wide text-[#94A3B8] text-right">Facilities</span>
    <template v-for="(provider, index) in props.providers" :key="providerKey(provider, index)">
      <span class="truncate text-[#64748B]">{{ provider.providerName }}</span>
      <span class="text-right text-[#94A3B8]">
        {{ props.formatPower(provider.commissionedPowerMw) }}
      </span>
      <span class="text-right text-[#94A3B8]">{{ provider.count }}</span>
    </template>
    <span v-if="props.providers.length === 0" class="col-span-3 text-[10px] text-[#94A3B8]"
      >None</span
    >
  </div>
</template>
