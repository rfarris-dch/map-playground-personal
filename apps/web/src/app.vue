<script setup lang="ts">
  import { computed } from "vue";
  import { useRoute } from "vue-router";
  import Separator from "@/components/ui/separator/separator.vue";
  import { appNavigationItems } from "@/features/navigation/navigation.service";

  const route = useRoute();

  const activeRouteNames = computed(() => {
    return new Set(
      route.matched
        .map((item) => item.name)
        .filter((name): name is string => typeof name === "string")
    );
  });

  function isNavItemActive(routeName: string): boolean {
    return activeRouteNames.value.has(routeName);
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
          <RouterLink v-for="item in appNavigationItems" :key="item.routeName" :to="item.to" custom>
            <template #default="{ href, navigate }">
              <a
                :href="href"
                class="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors"
                :class="
                  isNavItemActive(item.routeName)
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

    <main class="min-h-0 flex-1"><RouterView /></main>
  </div>
</template>
