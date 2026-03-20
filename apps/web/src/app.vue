<script setup lang="ts">
  import { computed } from "vue";
  import { useRoute } from "vue-router";
  import ErrorBoundary from "@/components/error-boundary.vue";
  import Separator from "@/components/ui/separator/separator.vue";
  import { readMapContextTransferFromRoute } from "@/features/map-context-transfer/map-context-transfer.service";
  import {
    appNavigationItems,
    buildFacilitiesPageRoute,
    buildGlobalMapRoute,
    buildMarketsPageRoute,
    buildProvidersPageRoute,
  } from "@/features/navigation/navigation.service";
  import type { AppNavigationId } from "@/features/navigation/navigation.types";

  const route = useRoute();

  const activeNavigationIds = computed(() => {
    return new Set(
      route.matched
        .map((item) => item.meta.navigationId)
        .filter((navigationId): navigationId is AppNavigationId => typeof navigationId === "string")
    );
  });

  const currentMapContext = computed(() => readMapContextTransferFromRoute({ route }) ?? undefined);

  const navigationTargets = computed(() =>
    appNavigationItems.map((item) => {
      switch (item.navigationId) {
        case "map":
          return { ...item, to: buildGlobalMapRoute(currentMapContext.value) };
        case "markets":
          return { ...item, to: buildMarketsPageRoute(currentMapContext.value) };
        case "providers":
          return { ...item, to: buildProvidersPageRoute(currentMapContext.value) };
        case "facilities":
          return { ...item, to: buildFacilitiesPageRoute(currentMapContext.value) };
      }
    })
  );

  const routerViewKey = computed(() => {
    const activeNavigationId = route.meta.navigationId;
    return activeNavigationId === "map" ? route.path : String(route.name ?? route.path);
  });

  function isNavItemActive(navigationId: AppNavigationId): boolean {
    return activeNavigationIds.value.has(navigationId);
  }
</script>

<template>
  <div class="flex h-full min-h-0 w-full flex-col">
    <header class="border-b border-border/80 bg-card/95 backdrop-blur-md">
      <div class="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-3">
        <div class="flex items-center">
          <img src="/dch-logo.svg" alt="datacenterHawk" class="h-7 w-auto">
        </div>

        <Separator orientation="vertical" class="hidden h-6 md:block" />

        <nav class="flex flex-wrap items-center gap-2" aria-label="Primary">
          <RouterLink v-for="item in navigationTargets" :key="item.routeName" :to="item.to" custom>
            <template #default="{ href, navigate }">
              <a
                :href="href"
                class="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors"
                :class="
                  isNavItemActive(item.navigationId)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                "
                @click="navigate"
              >
                {{ item.label }}
              </a>
            </template>
          </RouterLink>
        </nav>
      </div>
    </header>

    <main class="min-h-0 flex-1">
      <ErrorBoundary>
        <RouterView v-slot="{ Component }">
          <component :is="Component" :key="routerViewKey" />
        </RouterView>
      </ErrorBoundary>
    </main>
  </div>
</template>
