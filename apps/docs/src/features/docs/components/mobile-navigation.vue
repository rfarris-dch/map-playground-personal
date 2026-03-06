<script setup lang="ts">
  import { Dialog, DialogPanel } from "@headlessui/vue";
  import { shallowRef, watch } from "vue";
  import { useRoute } from "vue-router";
  import LogoMark from "@/features/docs/components/logo-mark.vue";
  import NavigationTree from "@/features/docs/components/navigation-tree.vue";
  import type { DocsNavigationGroup } from "@/features/docs/docs-content.types";

  defineProps<{
    groups: readonly DocsNavigationGroup[];
    currentSlug: string;
  }>();

  const isOpen = shallowRef(false);
  const route = useRoute();

  watch(
    () => route.fullPath,
    () => {
      isOpen.value = false;
    }
  );
</script>

<template>
  <button
    type="button"
    class="relative lg:hidden"
    aria-label="Open navigation"
    @click="isOpen = true"
  >
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke-width="2"
      stroke-linecap="round"
      class="h-6 w-6 stroke-slate-500"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  </button>

  <Dialog
    :open="isOpen"
    class="fixed inset-0 z-50 flex items-start overflow-y-auto bg-slate-900/50 pr-10 backdrop-blur-sm lg:hidden"
    @close="isOpen = false"
  >
    <DialogPanel
      class="min-h-full w-full max-w-xs bg-white px-4 pt-5 pb-12 sm:px-6 dark:bg-slate-900"
    >
      <div class="flex items-center">
        <button type="button" aria-label="Close navigation" @click="isOpen = false">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke-width="2"
            stroke-linecap="round"
            class="h-6 w-6 stroke-slate-500"
          >
            <path d="M5 5l14 14M19 5l-14 14" />
          </svg>
        </button>
        <RouterLink to="/" class="ml-6" aria-label="Home page"> <LogoMark /> </RouterLink>
      </div>
      <NavigationTree
        :groups="groups"
        :current-slug="currentSlug"
        class="mt-5 px-1"
        @navigate="isOpen = false"
      />
    </DialogPanel>
  </Dialog>
</template>
