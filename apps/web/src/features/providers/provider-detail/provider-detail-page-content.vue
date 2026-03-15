<script setup lang="ts">
  import type { ProviderTableRow } from "@map-migration/http-contracts/table-contracts";
  import { ref } from "vue";
  import { RouterLink } from "vue-router";
  import Badge from "@/components/ui/badge/badge.vue";
  import Tabs from "@/components/ui/tabs/tabs.vue";
  import TabsContent from "@/components/ui/tabs/tabs-content.vue";
  import TabsList from "@/components/ui/tabs/tabs-list.vue";
  import TabsTrigger from "@/components/ui/tabs/tabs-trigger.vue";
  import DetailPageHeader from "@/components/detail/detail-page-header.vue";
  import ProviderOverviewTab from "./provider-overview-tab.vue";
  import ProviderFacilitiesTab from "./provider-facilities-tab.vue";
  import ProviderMapTab from "./provider-map-tab.vue";
  import ProviderCapacityTab from "./provider-capacity-tab.vue";

  defineProps<{
    readonly providerId: string | null;
    readonly provider: ProviderTableRow | null;
    readonly providerName: string;
    readonly isLoading: boolean;
    readonly isError: boolean;
  }>();

  const activeTab = ref("overview");

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "facilities", label: "Facilities" },
    { value: "map", label: "Map" },
    { value: "capacity", label: "Capacity" },
  ] as const;
</script>

<template>
  <section class="mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-col gap-4 overflow-y-auto px-4 py-4">
    <DetailPageHeader :title="providerName" eyebrow="Provider">
      <template #breadcrumbs>
        <RouterLink to="/providers" class="hover:text-foreground">Providers</RouterLink>
        <span class="mx-1">/</span>
        <span class="text-foreground">{{ providerName }}</span>
      </template>

      <template v-if="provider" #subtitle>
        <p class="text-sm text-muted-foreground">
          <template v-if="provider.country">{{ provider.country }}</template>
          <template v-if="provider.state">, {{ provider.state }}</template>
        </p>
      </template>

      <template v-if="provider" #badges>
        <Badge v-if="provider.category" variant="secondary">{{ provider.category }}</Badge>
        <Badge v-if="provider.supportsHyperscale" variant="outline">Hyperscale</Badge>
        <Badge v-if="provider.supportsColocation" variant="outline">Colocation</Badge>
      </template>
    </DetailPageHeader>

    <div v-if="isLoading" class="space-y-3 py-8" role="status" aria-live="polite" aria-busy="true">
      <div class="h-8 w-1/3 animate-pulse rounded bg-muted/60" />
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="i in 4" :key="i" class="h-24 animate-pulse rounded-xl bg-muted/40" />
      </div>
      <div class="h-48 animate-pulse rounded-xl bg-muted/40" />
      <p class="text-xs text-muted-foreground">Loading provider detail...</p>
    </div>

    <p v-else-if="isError" class="py-8 text-sm text-muted-foreground">
      Failed to load provider detail. Please go back and try again.
    </p>

    <p v-else-if="provider === null && !isLoading" class="py-8 text-sm text-muted-foreground">
      Provider not found.
    </p>

    <template v-else-if="provider">
      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger v-for="tab in tabs" :key="tab.value" :value="tab.value">
            {{ tab.label }}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ProviderOverviewTab :provider="provider" />
        </TabsContent>

        <TabsContent value="facilities">
          <ProviderFacilitiesTab />
        </TabsContent>

        <TabsContent value="map">
          <ProviderMapTab />
        </TabsContent>

        <TabsContent value="capacity">
          <ProviderCapacityTab />
        </TabsContent>
      </Tabs>
    </template>
  </section>
</template>
