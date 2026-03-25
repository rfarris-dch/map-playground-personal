<script setup lang="ts">
  import type { PointGeometry } from "@map-migration/geo-kernel/geometry";
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
    readonly geometry: PointGeometry | null;
    readonly iconClass?: string;
    readonly accentClass?: string;
  }>();

  function formatSqft(value: number | null): string {
    if (value === null) {
      return "--";
    }
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M sq ft`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K sq ft`;
    }
    return `${value.toLocaleString()} sq ft`;
  }

  const availablePercent = computed(() => {
    const commissioned = props.properties.commissionedPowerMw;
    const available = props.properties.availablePowerMw;
    if (commissioned === null || available === null || commissioned === 0) {
      return null;
    }
    return `${((available / commissioned) * 100).toFixed(0)}% of commissioned`;
  });

  const generalInfoFields = computed<readonly DetailField[]>(() => [
    { label: "Provider", value: props.properties.providerName },
    { label: "Type", value: props.properties.perspective },
    { label: "Address", value: props.properties.address },
    { label: "City", value: props.properties.city },
    { label: "State", value: props.properties.state },
    { label: "State Code", value: props.properties.stateAbbrev },
    { label: "County FIPS", value: props.properties.countyFips },
    { label: "Status", value: props.properties.commissionedSemantic },
    { label: "Ownership", value: props.properties.leaseOrOwn },
    {
      label: "Latitude",
      value: props.geometry ? String(props.geometry.coordinates[1].toFixed(6)) : null,
    },
    {
      label: "Longitude",
      value: props.geometry ? String(props.geometry.coordinates[0].toFixed(6)) : null,
    },
  ]);
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <DetailMetricCard
        label="Commissioned Power"
        :value="formatNullableMw(properties.commissionedPowerMw)"
        :icon="Zap"
        v-bind="iconClass === undefined ? {} : { iconClass }"
      />
      <DetailMetricCard
        label="Available Power"
        :value="formatNullableMw(properties.availablePowerMw)"
        :icon="Zap"
        v-bind="{ ...(iconClass === undefined ? {} : { iconClass }), ...(availablePercent === null ? {} : { description: availablePercent }) }"
      />
      <DetailMetricCard
        label="Under Construction"
        :value="formatNullableMw(properties.underConstructionPowerMw)"
        :icon="HardHat"
        v-bind="iconClass === undefined ? {} : { iconClass }"
      />
      <DetailMetricCard
        label="Square Footage"
        :value="formatSqft(properties.squareFootage)"
        :icon="Building2"
        v-bind="iconClass === undefined ? {} : { iconClass }"
      />
    </div>

    <DetailCard
      title="General Information"
      :fields="generalInfoFields"
      v-bind="accentClass === undefined ? {} : { accentClass }"
    />
  </div>
</template>
