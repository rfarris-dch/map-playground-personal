<script setup lang="ts">
  import type { FacilitiesDetailResponse } from "@map-migration/http-contracts/facilities-http";
  import { Building2, HardHat, Ruler, Zap } from "lucide-vue-next";
  import { computed } from "vue";
  import type { DetailField } from "@/components/detail/detail-card.vue";
  import DetailCard from "@/components/detail/detail-card.vue";
  import DetailMetricCard from "@/components/detail/detail-metric-card.vue";
  import { formatNullableMw } from "@/features/facilities/facility-detail/detail.service";

  type DetailProperties = FacilitiesDetailResponse["feature"]["properties"];

  const props = defineProps<{
    readonly properties: DetailProperties;
  }>();

  function formatSqft(value: number | null): string {
    if (value === null) {
      return "n/a";
    }
    return `${value.toLocaleString()} sq ft`;
  }

  const capacityFields = computed<readonly DetailField[]>(() => [
    { label: "Commissioned Power", value: formatNullableMw(props.properties.commissionedPowerMw) },
    { label: "Available Power", value: formatNullableMw(props.properties.availablePowerMw) },
    {
      label: "Under Construction",
      value: formatNullableMw(props.properties.underConstructionPowerMw),
    },
    { label: "Planned Power", value: formatNullableMw(props.properties.plannedPowerMw) },
    { label: "Square Footage", value: formatSqft(props.properties.squareFootage) },
  ]);
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <DetailMetricCard
        label="Commissioned"
        :value="formatNullableMw(properties.commissionedPowerMw)"
        :icon="Zap"
      />
      <DetailMetricCard
        label="Available"
        :value="formatNullableMw(properties.availablePowerMw)"
        :icon="Zap"
      />
      <DetailMetricCard
        label="Under Construction"
        :value="formatNullableMw(properties.underConstructionPowerMw)"
        :icon="HardHat"
      />
      <DetailMetricCard
        label="Planned"
        :value="formatNullableMw(properties.plannedPowerMw)"
        :icon="Building2"
      />
    </div>

    <DetailCard title="Power & Capacity" :fields="capacityFields" />
  </div>
</template>
