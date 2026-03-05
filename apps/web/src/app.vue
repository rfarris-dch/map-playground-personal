<script setup lang="ts">
  import { computed } from "vue";
  import { useRoute } from "vue-router";
  import Badge from "@/components/ui/badge/badge.vue";
  import Button from "@/components/ui/button/button.vue";
  import Separator from "@/components/ui/separator/separator.vue";
  import { appNavigationItems } from "@/features/navigation/navigation.service";

  const route = useRoute();

  function isActiveRoute(routeName: string): boolean {
    return route.matched.some((matchedRoute) => matchedRoute.name === routeName);
  }

  const currentPageLabel = computed(() => {
    const matchedItem = appNavigationItems.find((item) => isActiveRoute(item.routeName));
    return matchedItem?.label ?? "Workspace";
  });
</script>

<template>
  <div class="flex h-full min-h-0 w-full flex-col">
    <header class="border-b border-border/80 bg-card/95 backdrop-blur-md">
      <div class="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold tracking-wide text-foreground">Platform</span>
          <Badge variant="secondary">Scaffold</Badge>
        </div>

        <Separator orientation="vertical" class="hidden h-6 md:block" />

        <nav class="flex flex-wrap items-center gap-2" aria-label="Primary">
          <RouterLink v-for="item in appNavigationItems" :key="item.routeName" :to="item.to" custom>
            <template #default="{ navigate }">
              <Button
                size="sm"
                :variant="isActiveRoute(item.routeName) ? 'default' : 'ghost'"
                @click="navigate"
              >
                {{ item.label }}
              </Button>
            </template>
          </RouterLink>
        </nav>

        <div class="ml-auto text-xs text-muted-foreground">
          Current page:
          <span class="font-medium text-foreground">{{ currentPageLabel }}</span>
        </div>
      </div>
    </header>

    <main class="min-h-0 flex-1"><RouterView /></main>
  </div>
</template>
