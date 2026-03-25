<script setup lang="ts">
  import type { ProviderTableRow } from "@map-migration/http-contracts/table-contracts";
  import { Building2, Globe, MapPin, Zap } from "lucide-vue-next";
  import { computed } from "vue";
  import type { DetailField } from "@/components/detail/detail-card.vue";
  import DetailCard from "@/components/detail/detail-card.vue";
  import DetailMetricCard from "@/components/detail/detail-metric-card.vue";

  const props = defineProps<{
    readonly provider: ProviderTableRow;
  }>();

  function formatCapabilities(row: ProviderTableRow): string {
    const capabilities = [
      row.supportsHyperscale ? "Hyperscale" : null,
      row.supportsColocation ? "Colocation" : null,
    ].filter((value) => value !== null);

    if (capabilities.length === 0) {
      return "--";
    }

    return capabilities.join(", ");
  }

  const profileFields = computed<readonly DetailField[]>(() => [
    { label: "Name", value: props.provider.name },
    { label: "Category", value: props.provider.category },
    { label: "Country", value: props.provider.country },
    { label: "State", value: props.provider.state },
    { label: "Capabilities", value: formatCapabilities(props.provider) },
    { label: "Listings", value: props.provider.listingCount },
  ]);
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <DetailMetricCard
        label="Listings"
        :value="provider.listingCount == null ? '--' : provider.listingCount.toLocaleString()"
        :icon="Building2"
        icon-class="text-primary"
      />
      <DetailMetricCard
        label="Category"
        :value="provider.category ?? '--'"
        :icon="Zap"
        icon-class="text-primary"
      />
      <DetailMetricCard
        label="Location"
        :value="[provider.state, provider.country].filter(Boolean).join(', ') || '--'"
        :icon="MapPin"
        icon-class="text-primary"
      />
      <DetailMetricCard
        label="Capabilities"
        :value="formatCapabilities(provider)"
        :icon="Globe"
        icon-class="text-primary"
      />
    </div>

    <DetailCard
      title="Company Profile"
      :fields="profileFields"
      accent-class="border-l-2 border-l-primary"
    />
  </div>
</template>
