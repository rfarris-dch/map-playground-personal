<script setup lang="ts">
  import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
  import type { PointGeometry } from "@map-migration/geo-kernel/geometry";
  import type { FacilitiesDetailResponse } from "@map-migration/http-contracts/facilities-http";
  import { ref } from "vue";
  import { RouterLink } from "vue-router";
  import DetailPageHeader from "@/components/detail/detail-page-header.vue";
  import Badge from "@/components/ui/badge/badge.vue";
  import Tabs from "@/components/ui/tabs/tabs.vue";
  import TabsContent from "@/components/ui/tabs/tabs-content.vue";
  import TabsList from "@/components/ui/tabs/tabs-list.vue";
  import TabsTrigger from "@/components/ui/tabs/tabs-trigger.vue";
  import type { FacilityDetailPayload } from "@/features/facilities/facility-detail/detail.types";
  import { buildProviderDetailPageRoute } from "@/features/navigation/navigation.service";
  import FacilityCapacityTab from "./facility-capacity-tab.vue";
  import FacilityInfrastructureTab from "./facility-infrastructure-tab.vue";
  import FacilityOverviewTab from "./facility-overview-tab.vue";
  import FacilityPowerGridTab from "./facility-power-grid-tab.vue";
  import FacilityPricingTab from "./facility-pricing-tab.vue";
  import FacilityRelationshipsTab from "./facility-relationships-tab.vue";
  import FacilitySatelliteTab from "./facility-satellite-tab.vue";
  import FacilityTaxIncentivesTab from "./facility-tax-incentives-tab.vue";
  import FacilityUtilityPricingTab from "./facility-utility-pricing-tab.vue";

  type DetailProperties = FacilitiesDetailResponse["feature"]["properties"];

  defineProps<{
    readonly facilityId: string | null;
    readonly perspective: FacilityPerspective | null;
    readonly detail: FacilityDetailPayload | null;
    readonly properties: DetailProperties | null;
    readonly geometry: PointGeometry | null;
    readonly facilityName: string;
    readonly isLoading: boolean;
    readonly isError: boolean;
  }>();

  const activeTab = ref("overview");

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "infrastructure", label: "Infrastructure" },
    { value: "capacity", label: "Capacity" },
    { value: "relationships", label: "Relationships" },
    { value: "satellite", label: "Satellite" },
    { value: "power-grid", label: "Power Grid" },
    { value: "pricing", label: "Pricing" },
    { value: "utility-pricing", label: "Utility Pricing" },
    { value: "tax-incentives", label: "Tax Incentives" },
  ] as const;
</script>

<template>
  <section
    class="mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-col gap-4 overflow-y-auto px-4 py-4"
  >
    <DetailPageHeader
      :title="facilityName"
      :eyebrow="perspective ? `${perspective} facility` : 'Facility'"
    >
      <template #breadcrumbs>
        <RouterLink to="/facilities" class="hover:text-foreground">Facilities</RouterLink>
        <span class="mx-1">/</span>
        <span v-if="perspective" class="capitalize">{{ perspective }}</span>
        <span class="mx-1">/</span>
        <span class="text-foreground">{{ facilityName }}</span>
      </template>

      <template v-if="properties" #subtitle>
        <p class="text-sm text-muted-foreground">
          <template v-if="properties.address">{{ properties.address }}, </template>
          <template v-if="properties.city">{{ properties.city }}, </template>
          <template v-if="properties.state">{{ properties.state }}</template>
        </p>
      </template>

      <template v-if="properties" #badges>
        <Badge v-if="properties.commissionedSemantic" variant="secondary">
          {{ properties.commissionedSemantic }}
        </Badge>
        <Badge v-if="properties.leaseOrOwn" variant="outline"> {{ properties.leaseOrOwn }} </Badge>
        <Badge v-if="properties.statusLabel" variant="outline">
          {{ properties.statusLabel }}
        </Badge>
      </template>

      <template v-if="properties" #actions>
        <RouterLink
          :to="buildProviderDetailPageRoute({ providerId: properties.providerId })"
          class="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          View Provider
        </RouterLink>
      </template>
    </DetailPageHeader>

    <div v-if="isLoading" class="space-y-3 py-8" role="status" aria-live="polite" aria-busy="true">
      <div class="h-8 w-1/3 animate-pulse rounded bg-muted/60" />
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="i in 4" :key="i" class="h-24 animate-pulse rounded-xl bg-muted/40" />
      </div>
      <div class="h-48 animate-pulse rounded-xl bg-muted/40" />
      <p class="text-xs text-muted-foreground">Loading facility detail...</p>
    </div>

    <p v-else-if="isError" class="py-8 text-sm text-muted-foreground">
      Failed to load facility detail. Please go back and try again.
    </p>

    <template v-else-if="properties">
      <Tabs v-model="activeTab">
        <TabsList class="flex-wrap">
          <TabsTrigger v-for="tab in tabs" :key="tab.value" :value="tab.value">
            {{ tab.label }}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <FacilityOverviewTab :properties="properties" :geometry="geometry" />
        </TabsContent>

        <TabsContent value="infrastructure"> <FacilityInfrastructureTab /> </TabsContent>

        <TabsContent value="capacity">
          <FacilityCapacityTab :properties="properties" />
        </TabsContent>

        <TabsContent value="relationships"> <FacilityRelationshipsTab /> </TabsContent>

        <TabsContent value="satellite"> <FacilitySatelliteTab /> </TabsContent>

        <TabsContent value="power-grid"> <FacilityPowerGridTab /> </TabsContent>

        <TabsContent value="pricing"> <FacilityPricingTab /> </TabsContent>

        <TabsContent value="utility-pricing"> <FacilityUtilityPricingTab /> </TabsContent>

        <TabsContent value="tax-incentives"> <FacilityTaxIncentivesTab /> </TabsContent>
      </Tabs>
    </template>
  </section>
</template>
