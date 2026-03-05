<script setup lang="ts">
  import { computed } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import Badge from "@/components/ui/badge/badge.vue";
  import Tabs from "@/components/ui/tabs/tabs.vue";
  import TabsList from "@/components/ui/tabs/tabs-list.vue";
  import TabsTrigger from "@/components/ui/tabs/tabs-trigger.vue";
  import { facilityNavigationItems } from "@/features/navigation/navigation.service";

  type FacilityTab = "hyperscale" | "colocation";

  const route = useRoute();
  const router = useRouter();

  const activeTab = computed<FacilityTab>(() =>
    route.name === "facilities-colocation" ? "colocation" : "hyperscale"
  );

  function isFacilityTab(value: string): value is FacilityTab {
    return value === "hyperscale" || value === "colocation";
  }

  async function setFacilityTab(nextTab: string): Promise<void> {
    if (!isFacilityTab(nextTab)) {
      return;
    }

    const routePath =
      nextTab === "hyperscale" ? "/facilities/hyperscale" : "/facilities/colocation";
    await router.push(routePath);
  }
</script>

<template>
  <section class="mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-col gap-3 px-4 py-4">
    <header class="space-y-2">
      <Badge>Facilities</Badge>
      <h1 class="text-2xl font-semibold tracking-tight">Facilities</h1>
      <p class="text-sm text-muted-foreground">
        Live facilities tables split into hyperscale and colocation.
      </p>
    </header>

    <Tabs :model-value="activeTab" @update:model-value="setFacilityTab">
      <TabsList>
        <TabsTrigger
          v-for="facilityNavItem in facilityNavigationItems"
          :key="facilityNavItem.routeName"
          :value="facilityNavItem.routeName === 'facilities-colocation' ? 'colocation' : 'hyperscale'"
        >
          {{ facilityNavItem.label }}
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <div class="min-h-0 flex-1"><RouterView /></div>
  </section>
</template>
