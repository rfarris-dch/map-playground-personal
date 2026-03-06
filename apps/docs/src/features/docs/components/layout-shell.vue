<script setup lang="ts">
  import { computed, defineAsyncComponent, onMounted, onUnmounted, shallowRef } from "vue";
  import HeroSection from "@/features/docs/components/hero-section.vue";
  import LogoMark from "@/features/docs/components/logo-mark.vue";
  import MobileNavigation from "@/features/docs/components/mobile-navigation.vue";
  import NavigationTree from "@/features/docs/components/navigation-tree.vue";
  import ThemeSelector from "@/features/docs/components/theme-selector.vue";
  import { useDocsContent } from "@/features/docs/composables/use-docs-content";

  const SearchDialog = defineAsyncComponent(
    () => import("@/features/docs/components/search-dialog.vue")
  );
  const { currentPage, currentSlug, groups } = useDocsContent();
  const isScrolled = shallowRef(false);

  const isHomePage = computed(() => currentPage.value?.slug === "/");

  function updateScrollState(): void {
    isScrolled.value = window.scrollY > 0;
  }

  onMounted(() => {
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
  });

  onUnmounted(() => {
    window.removeEventListener("scroll", updateScrollState);
  });
</script>

<template>
  <div
    class="flex min-h-screen w-full flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-white"
  >
    <header
      class="sticky top-0 z-50 bg-white shadow-md shadow-slate-900/5 transition duration-500 dark:shadow-none"
      :class="isScrolled ? 'dark:bg-slate-900/95 dark:backdrop-blur-sm dark:[@supports(backdrop-filter:blur(0))]:bg-slate-900/75' : 'dark:bg-transparent'"
    >
      <div
        class="mx-auto flex w-full max-w-[110rem] items-center justify-between px-4 py-5 sm:px-6 lg:px-8 xl:px-12 2xl:px-16"
      >
        <div class="mr-6 flex lg:hidden">
          <MobileNavigation :groups="groups" :current-slug="currentSlug" />
        </div>
        <div class="relative flex grow basis-0 items-center">
          <RouterLink to="/" aria-label="Home page"> <LogoMark /> </RouterLink>
        </div>
        <div class="-my-5 mr-6 sm:mr-8 md:mr-0"><SearchDialog /></div>
        <div class="relative flex basis-0 justify-end gap-6 sm:gap-8 md:grow">
          <ThemeSelector class="relative z-10" />
          <a
            href="https://github.com/datacenterHawk/playground.git"
            class="group"
            aria-label="Repository"
            target="_blank"
            rel="noreferrer"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              class="h-6 w-6 fill-slate-400 group-hover:fill-slate-500 dark:group-hover:fill-slate-300"
            >
              <path
                d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z"
              />
            </svg>
          </a>
        </div>
      </div>
    </header>

    <HeroSection v-if="isHomePage" />

    <div
      class="relative mx-auto flex w-full max-w-[110rem] flex-auto justify-center sm:px-2 lg:px-8 xl:px-12 2xl:px-16"
    >
      <div class="hidden lg:relative lg:block lg:flex-none">
        <div class="absolute inset-y-0 right-0 w-[50vw] bg-slate-50 dark:hidden" />
        <div
          class="absolute top-16 right-0 bottom-0 hidden h-12 w-px bg-linear-to-t from-slate-800 dark:block"
        />
        <div class="absolute top-28 right-0 bottom-0 hidden w-px bg-slate-800 dark:block" />
        <div
          class="sticky top-19 -ml-0.5 h-[calc(100vh-4.75rem)] w-64 overflow-x-hidden overflow-y-auto py-16 pr-8 pl-0.5 xl:w-72 xl:pr-16"
        >
          <NavigationTree :groups="groups" :current-slug="currentSlug" />
        </div>
      </div>
      <slot />
    </div>
  </div>
</template>
